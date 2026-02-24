import { Status } from "@prisma/client";
import prisma from "../lib/prisma";
import { AppError } from "../middlewares/error.middleware";

interface UpsertUserBookInput {
  bookId: string;
  status: Status;
}

export async function upsertUserBook(data: UpsertUserBookInput) {
  const book = await prisma.book.findUnique({ where: { id: data.bookId } });
  if (!book) {
    throw new AppError("Book not found", 404);
  }

  return prisma.userBook.upsert({
    where: {
      bookId: data.bookId,
    },
    update: { status: data.status },
    create: data,
    include: { book: true },
  });
}

export async function getUserBooks(status?: Status) {
  return prisma.userBook.findMany({
    where: {
      ...(status ? { status } : {}),
    },
    include: {
      book: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteUserBook(userBookId: string) {
  const existing = await prisma.userBook.findUnique({ where: { id: userBookId } });
  if (!existing) {
    throw new AppError("User book entry not found", 404);
  }

  await prisma.userBook.delete({ where: { id: userBookId } });
}
