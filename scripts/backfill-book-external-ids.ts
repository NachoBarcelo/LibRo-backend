import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";

interface OpenLibrarySearchDoc {
  key?: string;
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

interface ScriptStats {
  total: number;
  alreadyValid: number;
  resolved: number;
  updated: number;
  skippedNoMatch: number;
  skippedConflict: number;
  failed: number;
}

function extractOpenLibraryWorkKey(value: string): string | null {
  const normalized = value.trim();

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

async function resolveWorkKeyByTitleAuthor(title: string, author: string): Promise<string | null> {
  const trimmedTitle = (title ?? "").trim();
  const trimmedAuthor = (author ?? "").trim();

  if (!trimmedTitle) {
    return null;
  }

  const candidates = [
    `${OPEN_LIBRARY_SEARCH_URL}?title=${encodeURIComponent(trimmedTitle)}`,
    `${OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(trimmedTitle)}`,
    `${OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(`${trimmedTitle} ${trimmedAuthor}`.trim())}`,
  ];

  for (const endpoint of candidates) {
    const response = await fetch(endpoint);
    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as OpenLibrarySearchResponse;
    const docs = payload.docs ?? [];

    for (const doc of docs) {
      const key = doc.key ? extractOpenLibraryWorkKey(doc.key) : null;
      if (key) {
        return key;
      }
    }
  }

  return null;
}

async function main(): Promise<void> {
  const applyChanges = process.argv.includes("--apply");

  console.log(
    applyChanges
      ? "Modo APPLY: se actualizarán externalId en la base."
      : "Modo DRY-RUN: no se escriben cambios (usa --apply para aplicar)."
  );

  const books = await prisma.book.findMany({
    select: {
      id: true,
      title: true,
      author: true,
      externalId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const stats: ScriptStats = {
    total: books.length,
    alreadyValid: 0,
    resolved: 0,
    updated: 0,
    skippedNoMatch: 0,
    skippedConflict: 0,
    failed: 0,
  };

  for (const book of books) {
    try {
      let targetExternalId = extractOpenLibraryWorkKey(book.externalId);

      if (targetExternalId) {
        if (targetExternalId === book.externalId) {
          stats.alreadyValid += 1;
          continue;
        }
      } else {
        targetExternalId = await resolveWorkKeyByTitleAuthor(book.title, book.author);
      }

      if (!targetExternalId) {
        stats.skippedNoMatch += 1;
        console.log(`[SKIP:NO_MATCH] ${book.id} | ${book.title}`);
        continue;
      }

      stats.resolved += 1;

      const conflict = await prisma.book.findFirst({
        where: {
          externalId: targetExternalId,
          NOT: { id: book.id },
        },
        select: { id: true, title: true },
      });

      if (conflict) {
        stats.skippedConflict += 1;
        console.log(
          `[SKIP:CONFLICT] ${book.id} -> ${targetExternalId} (ya usado por ${conflict.id} | ${conflict.title})`
        );
        continue;
      }

      console.log(`[UPDATE] ${book.id} | ${book.externalId} -> ${targetExternalId}`);

      if (applyChanges) {
        await prisma.book.update({
          where: { id: book.id },
          data: { externalId: targetExternalId },
        });
        stats.updated += 1;
      }
    } catch (error) {
      stats.failed += 1;
      const message = error instanceof Error ? error.message : "unknown error";
      console.log(`[ERROR] ${book.id} | ${book.title} | ${message}`);
    }
  }

  console.log("\nResumen:");
  console.log(`- Total libros: ${stats.total}`);
  console.log(`- Ya válidos: ${stats.alreadyValid}`);
  console.log(`- Resueltos a /works: ${stats.resolved}`);
  console.log(`- Actualizados: ${stats.updated}`);
  console.log(`- Sin match: ${stats.skippedNoMatch}`);
  console.log(`- Con conflicto: ${stats.skippedConflict}`);
  console.log(`- Errores: ${stats.failed}`);
}

main()
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
