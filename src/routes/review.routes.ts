import { Router } from "express";
import { z } from "zod";
import {
  createReviewHandler,
  editReview,
  getBookReviews,
  getReview,
  listReviews,
  removeReview,
} from "../controllers/review.controller";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

const createReviewSchema = z.object({
  bookId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  rating: z.number().int().min(1).max(5),
});

const updateReviewSchema = z
  .object({
    title: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    rating: z.number().int().min(1).max(5).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const reviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

const reviewBookParamSchema = z.object({
  bookId: z.string().uuid(),
});

router.post("/", validate(createReviewSchema), createReviewHandler);
router.get("/", listReviews);
router.get("/book/:bookId", validate(reviewBookParamSchema, "params"), getBookReviews);
router.get("/:id", validate(reviewIdParamSchema, "params"), getReview);
router.put("/:id", validate(reviewIdParamSchema, "params"), validate(updateReviewSchema), editReview);
router.delete("/:id", validate(reviewIdParamSchema, "params"), removeReview);

export default router;
