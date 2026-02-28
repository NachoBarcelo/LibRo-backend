import prisma from "../lib/prisma";
import { AppError } from "../middlewares/error.middleware";
import { BookEditionDto, BookSearchDetailDto, BookSearchListItemDto } from "../dtos/book.dto";

interface CreateBookInput {
  externalId: string;
  title: string;
  author: string;
  coverImage: string;
  publishedYear?: number;
}

interface OpenLibrarySearchDoc {
  title?: string;
  author_name?: string[];
  cover_i?: number;
  key?: string;
}

interface SearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

interface OpenLibraryWorkDescriptionObject {
  value?: string;
}

interface WorkDetailsResponse {
  title?: string;
  description?: string | OpenLibraryWorkDescriptionObject;
  subjects?: string[];
  covers?: number[];
  authors?: Array<{
    author?: {
      key?: string;
    };
  }>;
}

interface OpenLibraryAuthorResponse {
  name?: string;
}

interface OpenLibraryEditionLanguage {
  key?: string;
}

interface OpenLibraryEditionEntry {
  key?: string;
  languages?: OpenLibraryEditionLanguage[] | null;
  isbn_13?: string[];
  isbn_10?: string[];
  publish_date?: string;
  publishers?: string[];
  covers?: number[];
}

interface OpenLibraryEditionsResponse {
  entries?: OpenLibraryEditionEntry[];
}

interface OpenLibraryBookDetails {
  key: string;
  title: string | null;
  author: string | null;
  image: string | null;
  synopsis: string | null;
  genres: string[];
  raw: WorkDetailsResponse;
}

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_COVER_BY_ID_URL = "https://covers.openlibrary.org/b/id";
const OPEN_LIBRARY_BOOKS_API_URL = "https://openlibrary.org/api/books";
const OPEN_LIBRARY_BOOK_JSON_URL = "https://openlibrary.org/books";
const OPEN_LIBRARY_TIMEOUT_MS = 6000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

interface SearchCacheEntry {
  data: BookSearchListItemDto[];
  expiresAt: number;
}

interface SearchDetailCacheEntry {
  data: BookSearchDetailDto;
  expiresAt: number;
}

export class BookService {
  private readonly searchCache = new Map<string, SearchCacheEntry>();
  private readonly searchDetailCache = new Map<string, SearchDetailCacheEntry>();

  async createBookIfMissing(data: CreateBookInput) {
    const normalizedExternalId = await this.resolveExternalIdForStorage(
      data.externalId,
      data.title,
      data.author
    );

    const existing = await prisma.book.findUnique({ where: { externalId: normalizedExternalId } });

    if (existing) {
      return { book: existing, created: false };
    }

    const created = await prisma.book.create({
      data: {
        ...data,
        externalId: normalizedExternalId,
      },
    });
    return { book: created, created: true };
  }

  async getAllBooks() {
    return prisma.book.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getBookDetailsById(id: string) {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        userBooks: {
          orderBy: { createdAt: "desc" },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!book) {
      throw new AppError("Book not found", 404);
    }

    let openLibrary = await this.fetchOpenLibraryDetails(book.externalId);

    if (!openLibrary) {
      openLibrary = await this.fetchOpenLibraryDetailsByTitleAuthor(book.title, book.author);
    }

    const resolvedDetails = openLibrary as Partial<OpenLibraryBookDetails> | null;
    const synopsis = resolvedDetails?.synopsis ?? null;
    const genres = Array.isArray(resolvedDetails?.genres) ? resolvedDetails.genres : [];

    return {
      ...book,
      synopsis,
      genres,
      openLibrary,
    };
  }

  async searchOpenLibraryBooks(query: string): Promise<BookSearchListItemDto[]> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      throw new AppError("Query is required", 400);
    }

    const cacheKey = this.normalizeQuery(trimmedQuery);
    const cached = this.getCachedSearchResult(cacheKey);
    if (cached) {
      return cached;
    }

    const endpoint = `${OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(trimmedQuery)}`;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), OPEN_LIBRARY_TIMEOUT_MS);

    try {
      const payload = await this.requestJson<SearchResponse>(endpoint, abortController.signal);

      if (!payload.docs?.length) {
        this.setCachedSearchResult(cacheKey, []);
        return [];
      }

      const mappedBooks = payload.docs.map((doc) => this.mapOpenLibraryDocToListItem(doc));

      this.setCachedSearchResult(cacheKey, mappedBooks);
      return mappedBooks;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Open Library request timeout", 504);
      }

      throw new AppError("Failed to fetch books from Open Library", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async searchOpenLibraryBookDetails(externalId: string): Promise<BookSearchDetailDto> {
    const trimmedQuery = externalId.trim();

    if (!trimmedQuery) {
      throw new AppError("Query is required", 400);
    }

    const cacheKey = this.normalizeQuery(trimmedQuery);
    const cached = this.getCachedSearchDetailResult(cacheKey);
    if (cached) {
      return cached;
    }

    const endpoint = `${OPEN_LIBRARY_SEARCH_URL}?title=${encodeURIComponent(trimmedQuery)}`;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), OPEN_LIBRARY_TIMEOUT_MS);

    try {
      const searchPayload = await this.requestJson<SearchResponse>(endpoint, abortController.signal);

      if (!searchPayload.docs?.length) {
        throw new AppError("Book not found", 404);
      }

      const firstDoc = searchPayload.docs[0];
      const workKey = firstDoc.key ? this.extractOpenLibraryWorkKey(firstDoc.key) : null;
      const titulo = firstDoc.title?.trim() || "";
      const autor = firstDoc.author_name?.find((name) => name?.trim())?.trim() || "";

      const basicResult: BookSearchDetailDto = {
        titulo,
        autor,
        idioma: "Otro",
        isbn: null,
        anio: null,
        editorial: null,
        imagen: null,
      };

      if (!workKey) {
        this.setCachedSearchDetailResult(cacheKey, basicResult);
        return basicResult;
      }

      try {
        const editionsPayload = await this.requestJson<OpenLibraryEditionsResponse>(
          `https://openlibrary.org${workKey}/editions.json`,
          abortController.signal
        );

        const selectedEdition = this.selectPreferredEdition(editionsPayload.entries ?? []);

        if (!selectedEdition) {
          this.setCachedSearchDetailResult(cacheKey, basicResult);
          return basicResult;
        }

        const mappedBook: BookSearchDetailDto = {
          titulo,
          autor,
          idioma: this.resolveEditionLanguageLabel(selectedEdition),
          isbn:
            selectedEdition.isbn_13?.find((value) => value?.trim()) ??
            selectedEdition.isbn_10?.find((value) => value?.trim()) ??
            null,
          anio: selectedEdition.publish_date?.trim() || null,
          editorial: selectedEdition.publishers?.find((value) => value?.trim()) ?? null,
          imagen: this.buildCoverByCoverId(selectedEdition.covers?.[0]),
        };

        this.setCachedSearchDetailResult(cacheKey, mappedBook);
        return mappedBook;
      } catch {
        this.setCachedSearchDetailResult(cacheKey, basicResult);
        return basicResult;
      }

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Open Library request timeout", 504);
      }

      throw new AppError("Failed to fetch books from Open Library", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getOpenLibraryWorkEditions(workId: string): Promise<BookEditionDto[]> {
    const trimmedWorkId = workId.trim();

    if (!trimmedWorkId) {
      throw new AppError("Work ID is required", 400);
    }

    const normalizedWorkKey = this.extractOpenLibraryWorkKey(trimmedWorkId);

    if (!normalizedWorkKey) {
      throw new AppError("Invalid workId. Expected OL...W or /works/OL...W", 400);
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), OPEN_LIBRARY_TIMEOUT_MS);

    try {
      const editionsPayload = await this.requestJson<OpenLibraryEditionsResponse>(
        `https://openlibrary.org${normalizedWorkKey}/editions.json`,
        abortController.signal
      );

      const entries = editionsPayload.entries ?? [];

      return entries.slice(0, 100).map((edition) => ({
        edicionId: edition.key?.trim() || null,
        idioma: this.resolveEditionLanguageLabel(edition),
        isbn: edition.isbn_13?.find((value) => value?.trim()) ?? edition.isbn_10?.find((value) => value?.trim()) ?? null,
        anio: edition.publish_date?.trim() || null,
        editorial: edition.publishers?.find((value) => value?.trim()) ?? null,
        imagen: this.buildCoverByCoverId(edition.covers?.[0]),
      }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Open Library request timeout", 504);
      }

      throw new AppError("Failed to fetch editions from Open Library", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapOpenLibraryDocToListItem(doc: OpenLibrarySearchDoc): BookSearchListItemDto {
    const titulo = doc.title?.trim() || "";
    const autor = doc.author_name?.find((name) => name?.trim())?.trim() || "";
    const imagen = doc.cover_i
      ? `${OPEN_LIBRARY_COVER_BY_ID_URL}/${encodeURIComponent(String(doc.cover_i))}-L.jpg`
      : null;
    const externalId = doc.key?.trim() || null;

    return {
      titulo,
      autor,
      imagen,
      externalId,
    };
  }

  private selectPreferredEdition(editions: OpenLibraryEditionEntry[]): OpenLibraryEditionEntry | null {
    const limitedEditions = editions.slice(0, 20);

    if (!limitedEditions.length) {
      return null;
    }

    const spanish = limitedEditions.find((edition) => this.hasLanguageKey(edition, "/languages/spa"));
    if (spanish) {
      return spanish;
    }

    const english = limitedEditions.find((edition) => this.hasLanguageKey(edition, "/languages/eng"));
    if (english) {
      return english;
    }

    return limitedEditions[0] ?? null;
  }

  private hasLanguageKey(edition: OpenLibraryEditionEntry, expected: string): boolean {
    const languages = edition.languages ?? [];
    return languages.some((language) => language.key === expected);
  }

  private resolveEditionLanguageLabel(edition: OpenLibraryEditionEntry): "Español" | "Inglés" | "Otro" {
    if (this.hasLanguageKey(edition, "/languages/spa")) {
      return "Español";
    }

    if (this.hasLanguageKey(edition, "/languages/eng")) {
      return "Inglés";
    }

    return "Otro";
  }

  private buildCoverByCoverId(coverId?: number): string | null {
    if (!coverId) {
      return null;
    }

    return `${OPEN_LIBRARY_COVER_BY_ID_URL}/${encodeURIComponent(String(coverId))}-L.jpg`;
  }

  private extractSynopsis(description?: string | OpenLibraryWorkDescriptionObject): string | null {
    if (!description) {
      return null;
    }

    if (typeof description === "string") {
      const normalized = description.trim();
      return normalized || null;
    }

    const normalized = description.value?.trim();
    return normalized || null;
  }

  private normalizeQuery(query: string): string {
    return query.replace(/\s+/g, " ").trim().toLowerCase();
  }

  private getCachedSearchResult(cacheKey: string): BookSearchListItemDto[] | null {
    const cached = this.searchCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private setCachedSearchResult(cacheKey: string, data: BookSearchListItemDto[]): void {
    this.searchCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    });
  }

  private getCachedSearchDetailResult(cacheKey: string): BookSearchDetailDto | null {
    const cached = this.searchDetailCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.searchDetailCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private setCachedSearchDetailResult(cacheKey: string, data: BookSearchDetailDto): void {
    this.searchDetailCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    });
  }

  private async requestJson<T>(url: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      if (response.status === 404) {
        throw new AppError("Book not found", 404, { status: response.status, url });
      }

      throw new AppError("Open Library returned an error", 502, { status: response.status, url });
    }

    return (await response.json()) as T;
  }

  private async fetchOpenLibraryDetails(externalId: string): Promise<unknown | null> {
    const workKey = this.extractOpenLibraryWorkKey(externalId);

    if (workKey) {
      return this.fetchOpenLibraryWorkDetailsByKey(workKey);
    }

    const olid = this.extractOpenLibraryEditionId(externalId);

    if (!olid) {
      return null;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), OPEN_LIBRARY_TIMEOUT_MS);

    try {
      const [booksApiResponse, editionResponse] = await Promise.all([
        fetch(
          `${OPEN_LIBRARY_BOOKS_API_URL}?bibkeys=OLID:${encodeURIComponent(
            olid
          )}&format=json&jscmd=data`,
          { signal: abortController.signal }
        ),
        fetch(`${OPEN_LIBRARY_BOOK_JSON_URL}/${encodeURIComponent(olid)}.json`, {
          signal: abortController.signal,
        }),
      ]);

      if (!booksApiResponse.ok || !editionResponse.ok) {
        throw new AppError("Open Library returned an error", 502, {
          booksApiStatus: booksApiResponse.status,
          editionStatus: editionResponse.status,
        });
      }

      const booksApiPayload = (await booksApiResponse.json()) as Record<string, unknown>;
      const editionPayload = await editionResponse.json();

      return {
        olid,
        byBibkey: booksApiPayload[`OLID:${olid}`] ?? null,
        edition: editionPayload,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Open Library request timeout", 504);
      }

      throw new AppError("Failed to fetch full book details from Open Library", 502);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchOpenLibraryDetailsByTitleAuthor(
    title: string,
    author: string
  ): Promise<OpenLibraryBookDetails | null> {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return null;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), OPEN_LIBRARY_TIMEOUT_MS);

    try {
      const query = `${trimmedTitle} ${author ?? ""}`.trim();
      const searchEndpoint = `${OPEN_LIBRARY_SEARCH_URL}?title=${encodeURIComponent(query)}`;
      const payload = await this.requestJson<SearchResponse>(searchEndpoint, abortController.signal);

      const firstWorkKey = payload.docs?.[0]?.key;
      const workKey = firstWorkKey ? this.extractOpenLibraryWorkKey(firstWorkKey) : null;

      if (!workKey) {
        return null;
      }

      return this.fetchOpenLibraryWorkDetailsByKey(workKey);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveExternalIdForStorage(
    externalId: string,
    title: string,
    author: string
  ): Promise<string> {
    const workKey = this.extractOpenLibraryWorkKey(externalId);
    if (workKey) {
      return workKey;
    }

    const fromTitleAuthor = await this.fetchOpenLibraryDetailsByTitleAuthor(title, author);
    if (fromTitleAuthor?.key) {
      return fromTitleAuthor.key;
    }

    return externalId;
  }

  private async fetchOpenLibraryWorkDetailsByKey(workKey: string): Promise<OpenLibraryBookDetails | null> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), OPEN_LIBRARY_TIMEOUT_MS);

    try {
      const workDetails = await this.requestJson<WorkDetailsResponse>(
        `https://openlibrary.org${workKey}.json`,
        abortController.signal
      );

      const title = workDetails.title?.trim() || null;
      const coverId = workDetails.covers?.[0];
      const image = coverId
        ? `${OPEN_LIBRARY_COVER_BY_ID_URL}/${encodeURIComponent(String(coverId))}-L.jpg`
        : null;

      let authorName: string | null = null;
      const authorKey = workDetails.authors?.[0]?.author?.key;
      if (authorKey) {
        try {
          const authorDetails = await this.requestJson<OpenLibraryAuthorResponse>(
            `https://openlibrary.org${authorKey}.json`,
            abortController.signal
          );
          authorName = authorDetails.name?.trim() || null;
        } catch {
          authorName = null;
        }
      }

      return {
        key: workKey,
        title,
        author: authorName,
        image,
        synopsis: this.extractSynopsis(workDetails.description),
        genres: (workDetails.subjects ?? []).filter(Boolean).slice(0, 5),
        raw: workDetails,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractOpenLibraryWorkKey(externalId: string): string | null {
    const normalized = externalId.trim();

    if (!normalized) {
      return null;
    }

    const directKey = normalized.match(/^(\/works\/OL\d+W)$/i);
    if (directKey?.[1]) {
      return directKey[1];
    }

    const prefixedKey = normalized.match(/^openlibrary:(\/works\/OL\d+W)$/i);
    if (prefixedKey?.[1]) {
      return prefixedKey[1];
    }

    const rawWorkId = normalized.match(/^(OL\d+W)$/i);
    if (rawWorkId?.[1]) {
      return `/works/${rawWorkId[1].toUpperCase()}`;
    }

    const embeddedWorkKey = normalized.match(/(\/works\/OL\d+W)/i);
    if (embeddedWorkKey?.[1]) {
      return embeddedWorkKey[1];
    }

    return null;
  }

  private extractOpenLibraryEditionId(externalId: string): string | null {
    const normalized = externalId.trim();

    if (!normalized) {
      return null;
    }

    const prefixedMatch = normalized.match(/^openlibrary:(OL\d+M)$/i);
    if (prefixedMatch?.[1]) {
      return prefixedMatch[1].toUpperCase();
    }

    const rawOlidMatch = normalized.match(/^(OL\d+M)$/i);
    if (rawOlidMatch?.[1]) {
      return rawOlidMatch[1].toUpperCase();
    }

    const embeddedOlidMatch = normalized.match(/(OL\d+M)/i);
    if (embeddedOlidMatch?.[1]) {
      return embeddedOlidMatch[1].toUpperCase();
    }

    return null;
  }
}

export const bookService = new BookService();

export async function createBookIfMissing(data: CreateBookInput) {
  return bookService.createBookIfMissing(data);
}

export async function getAllBooks() {
  return bookService.getAllBooks();
}

export async function getBookDetailsById(id: string) {
  return bookService.getBookDetailsById(id);
}

export async function searchOpenLibraryBooks(query: string): Promise<BookSearchListItemDto[]> {
  return bookService.searchOpenLibraryBooks(query);
}

export async function searchOpenLibraryBookDetails(query: string): Promise<BookSearchDetailDto> {
  return bookService.searchOpenLibraryBookDetails(query);
}

export async function getOpenLibraryWorkEditions(workId: string): Promise<BookEditionDto[]> {
  return bookService.getOpenLibraryWorkEditions(workId);
}
