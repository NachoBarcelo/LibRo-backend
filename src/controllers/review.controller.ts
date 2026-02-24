import { NextFunction, Request, Response } from "express";
import {
  createReview,
  deleteReview,
  getAllReviews,
  getReviewById,
  getReviewsByBookId,
  updateReview,
} from "../services/review.service";

export async function createReviewHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await createReview({
      bookId: req.body.bookId,
      title: req.body.title,
      content: req.body.content,
      rating: req.body.rating,
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
}

export async function listReviews(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reviews = await getAllReviews();
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
}

export async function getReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await getReviewById(String(req.params.id));
    res.status(200).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
}

export async function getBookReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reviews = await getReviewsByBookId(String(req.params.bookId));
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
}

export async function editReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await updateReview(String(req.params.id), req.body);
    res.status(200).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
}

export async function removeReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteReview(String(req.params.id));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
