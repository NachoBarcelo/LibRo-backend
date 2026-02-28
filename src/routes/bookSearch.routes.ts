import { Router } from "express";
import { z } from "zod";
import { searchBookDetails, searchBooks } from "../controllers/book.controller";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

const searchBooksQuerySchema = z.object({
  query: z.string().trim().min(1),
});

const searchBookDetailsQuerySchema = z.object({
  query: z.string().trim().min(1),
});

router.get("/search", validate(searchBooksQuerySchema, "query"), searchBooks);
router.get("/search/detail", validate(searchBookDetailsQuerySchema, "query"), searchBookDetails);

export default router;