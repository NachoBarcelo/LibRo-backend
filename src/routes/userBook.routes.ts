import { Router } from "express";
import { z } from "zod";
import { addUserBook, listUserBooks, removeUserBook } from "../controllers/userBook.controller";
import { validate } from "../middlewares/validate.middleware";

const router = Router();

const statusEnum = z.enum(["FAVORITE", "TO_READ", "READ"]);

const createUserBookSchema = z.object({
  bookId: z.string().uuid(),
  status: statusEnum,
});

const querySchema = z.object({
  status: statusEnum.optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

router.post("/", validate(createUserBookSchema), addUserBook);
router.get("/", validate(querySchema, "query"), listUserBooks);
router.delete("/:id", validate(idParamSchema, "params"), removeUserBook);

export default router;
