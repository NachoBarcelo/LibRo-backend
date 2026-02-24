import prisma from "../lib/prisma";
import { AppError } from "../middlewares/error.middleware";

interface CreateReviewInput {
  bookId: string;
  title: string;
  content: string;
  rating: number;
}

interface UpdateReviewInput {
  title?: string;
  content?: string;
  rating?: number;
}

export async function createReview(data: CreateReviewInput) {
  const book = await prisma.book.findUnique({ where: { id: data.bookId } });
  if (!book) {
    throw new AppError("Book not found", 404);
  }

  return prisma.review.create({
    data,
    include: {
      book: true,
    },
  });
}

export async function getAllReviews() {
  return prisma.review.findMany({
    include: {
      book: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReviewById(id: string) {
  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      book: true,
    },
  });

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  return review;
}

export async function getReviewsByBookId(bookId: string) {
  return prisma.review.findMany({
    where: { bookId },
    include: {
      book: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateReview(id: string, data: UpdateReviewInput) {
  const existing = await prisma.review.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError("Review not found", 404);
  }

  return prisma.review.update({
    where: { id },
    data,
    include: {
      book: true,
    },
  });
}

export async function deleteReview(id: string) {
  const existing = await prisma.review.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError("Review not found", 404);
  }

  await prisma.review.delete({ where: { id } });
}
