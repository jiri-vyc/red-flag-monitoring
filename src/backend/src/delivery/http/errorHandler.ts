import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: "Not found" });
};

// Single place where unexpected errors become HTTP responses. Map expected
// application errors to 4xx here once they exist.
export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};
