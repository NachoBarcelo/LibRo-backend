import { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodTypeAny } from "zod";
import { AppError } from "./error.middleware";

type Target = "body" | "params" | "query";

export function validate(schema: ZodTypeAny, target: Target = "body"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return next(new AppError("Validation failed", 400, result.error.flatten()));
    }

    if (target === "body") {
      req.body = result.data;
    }

    if (target === "params") {
      Object.assign(req.params, result.data);
    }

    if (target === "query") {
      Object.assign(req.query, result.data);
    }

    return next();
  };
}
