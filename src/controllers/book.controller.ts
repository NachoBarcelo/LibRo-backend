import { NextFunction, Request, Response } from "express";
import { createBookIfMissing, getAllBooks, searchOpenLibraryBooks } from "../services/book.service";

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

export async function searchBooks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = String(req.query.query ?? "");
    const books = await searchOpenLibraryBooks(query);
    res.status(200).json(books);
  } catch (error) {
    next(error);
  }
}
