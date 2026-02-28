import { Router } from "express";
import { createBook, getBook, listBookEditions, listBooks } from "../controllers/book.controller";
import { validate } from "../middlewares/validate.middleware";
import { z } from "zod";

const router = Router();

const createBookSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  coverImage: z.string().url(),
  publishedYear: z.number().int().positive().optional(),
});

const getBookParamsSchema = z.object({
  id: z.string().uuid(),
});

const getBookEditionsParamsSchema = z.object({
  workId: z.string().trim().regex(/^(OL\d+W|\/works\/OL\d+W)$/i),
});

router.post("/", validate(createBookSchema), createBook);
router.get("/", listBooks);
router.get("/:workId/editions", validate(getBookEditionsParamsSchema, "params"), listBookEditions);
router.get("/:id", validate(getBookParamsSchema, "params"), getBook);

export default router;
