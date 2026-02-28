import { NextFunction, Request, Response } from "express";
import {
  createBookIfMissing,
  getOpenLibraryWorkEditions,
  getAllBooks,
  getBookDetailsById,
  searchOpenLibraryBookDetails,
  searchOpenLibraryBooks,
} from "../services/book.service";

export async function createBook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await createBookIfMissing(req.body);
    res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      data: result.book,
    });
  } catch (error) {
    next(error);
  }
}

export async function listBooks(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const books = await getAllBooks();
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    next(error);
  }
}

export async function getBook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const book = await getBookDetailsById(String(req.params.id));
    res.status(200).json({ success: true, data: book });
  } catch (error) {
    next(error);
  }
}

export async function searchBooks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = String(req.query.query ?? "");
    const books = await searchOpenLibraryBooks(query);
    res.status(200).json(books);
  } catch (error) {
    next(error);
  }
}

export async function searchBookDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = String(req.query.query ?? "");
    const book = await searchOpenLibraryBookDetails(query);
    res.status(200).json(book);
  } catch (error) {
    next(error);
  }
}

export async function listBookEditions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workId = String(req.params.workId ?? "");
    const editions = await getOpenLibraryWorkEditions(workId);
    res.status(200).json(editions);
  } catch (error) {
    next(error);
  }
}
