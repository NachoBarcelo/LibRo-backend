import cors from "cors";
import express from "express";
import bookRoutes from "./routes/book.routes";
import bookSearchRoutes from "./routes/bookSearch.routes";
import userBookRoutes from "./routes/userBook.routes";
import reviewRoutes from "./routes/review.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "LibRo API is running" });
});

app.use("/books", bookRoutes);
app.use("/api/books", bookSearchRoutes);
app.use("/user-books", userBookRoutes);
app.use("/reviews", reviewRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
