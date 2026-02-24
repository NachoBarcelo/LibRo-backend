import prisma from "../lib/prisma";
import { AppError } from "../middlewares/error.middleware";
import { BookDto } from "../dtos/book.dto";

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
  first_publish_year?: number;
  isbn?: string[];
  cover_edition_key?: string;
  edition_key?: string[];
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_COVER_BY_ISBN_URL = "https://covers.openlibrary.org/b/isbn";
const OPEN_LIBRARY_COVER_BY_OLID_URL = "https://covers.openlibrary.org/b/olid";
const OPEN_LIBRARY_TIMEOUT_MS = 6000;
const MAX_BOOK_RESULTS = 20;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

interface SearchCacheEntry {
  data: BookDto[];
  expiresAt: number;
}

export class BookService {
  private readonly searchCache = new Map<string, SearchCacheEntry>();

  async createBookIfMissing(data: CreateBookInput) {
    const existing = await prisma.book.findUnique({ where: { externalId: data.externalId } });

    if (existing) {
      return { book: existing, created: false };
    }

    const created = await prisma.book.create({ data });
    return { book: created, created: true };
  }

  async getAllBooks() {
    return prisma.book.findMany({ orderBy: { createdAt: "desc" } });
  }

  async searchOpenLibraryBooks(query: string): Promise<BookDto[]> {
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
      const response = await fetch(endpoint, { signal: abortController.signal });

      if (!response.ok) {
        throw new AppError("Open Library returned an error", 502, { status: response.status });
      }

      const payload = (await response.json()) as OpenLibrarySearchResponse;

      if (!payload.docs?.length) {
        this.setCachedSearchResult(cacheKey, []);
        return [];
      }

      const mappedBooks = payload.docs
        .map((doc) => this.mapOpenLibraryDocToDto(doc))
        .filter((book): book is BookDto => book !== null)
        .slice(0, MAX_BOOK_RESULTS);

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

  private mapOpenLibraryDocToDto(doc: OpenLibrarySearchDoc): BookDto | null {
    const title = doc.title?.trim();
    const author = doc.author_name?.filter(Boolean).join(", ").trim();
    const isbn = doc.isbn?.find((code) => code?.trim())?.trim();
    const olid = doc.cover_edition_key ?? doc.edition_key?.find((key) => key?.trim());
    const coverUrl = this.buildCoverUrl(isbn, olid);

    if (!title || !author || !coverUrl) {
      return null;
    }

    return {
      title,
      author,
      ...(doc.first_publish_year ? { year: doc.first_publish_year } : {}),
      ...(isbn ? { isbn } : {}),
      coverUrl,
    };
  }

  private buildCoverUrl(isbn?: string, olid?: string): string | null {
    if (isbn) {
      return `${OPEN_LIBRARY_COVER_BY_ISBN_URL}/${encodeURIComponent(isbn)}-L.jpg`;
    }

    if (olid) {
      return `${OPEN_LIBRARY_COVER_BY_OLID_URL}/${encodeURIComponent(olid)}-L.jpg`;
    }

    return null;
  }

  private normalizeQuery(query: string): string {
    return query.replace(/\s+/g, " ").trim().toLowerCase();
  }

  private getCachedSearchResult(cacheKey: string): BookDto[] | null {
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

  private setCachedSearchResult(cacheKey: string, data: BookDto[]): void {
    this.searchCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    });
  }
}

export const bookService = new BookService();

export async function createBookIfMissing(data: CreateBookInput) {
  return bookService.createBookIfMissing(data);
}

export async function getAllBooks() {
  return bookService.getAllBooks();
}

export async function searchOpenLibraryBooks(query: string): Promise<BookDto[]> {
  return bookService.searchOpenLibraryBooks(query);
}
