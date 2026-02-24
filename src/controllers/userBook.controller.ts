import { NextFunction, Request, Response } from "express";
import { deleteUserBook, getUserBooks, upsertUserBook } from "../services/userBook.service";

export async function addUserBook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await upsertUserBook({
      bookId: req.body.bookId,
      status: req.body.status,
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listUserBooks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query.status as "FAVORITE" | "TO_READ" | "READ" | undefined;
    const data = await getUserBooks(status);

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function removeUserBook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteUserBook(String(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
