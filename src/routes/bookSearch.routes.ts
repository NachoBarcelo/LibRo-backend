import { Router } from "express";
import { z } from "zod";
import { searchBooks } from "../controllers/book.controller";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

const searchBooksQuerySchema = z.object({
  query: z.string().trim().min(1),
});

router.get("/search", validate(searchBooksQuerySchema, "query"), searchBooks);

export default router;