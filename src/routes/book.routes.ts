import { Router } from "express";
import { createBook, listBooks } from "../controllers/book.controller";
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

router.post("/", validate(createBookSchema), createBook);
router.get("/", listBooks);

export default router;
