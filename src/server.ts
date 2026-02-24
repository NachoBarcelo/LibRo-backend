import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const port = Number(process.env.PORT ?? 4000);

const server = app.listen(port, () => {
  console.log(`LibRo API listening on port ${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    console.log("Server closed after SIGTERM");
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});
