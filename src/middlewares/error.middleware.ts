import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError("Route not found", 404));
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const knownError = error instanceof AppError;
  const statusCode = knownError ? error.statusCode : 500;
  const message = knownError ? error.message : "Internal server error";

  if (!knownError) {
    console.error("Unhandled error:", error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(knownError && error.details ? { details: error.details } : {}),
  });
}
