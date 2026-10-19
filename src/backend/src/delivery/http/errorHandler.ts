import type { ErrorRequestHandler, RequestHandler } from "express";

import {
  BusinessRuleViolationError,
  ConflictError,
  MissingReferenceError,
  NotFoundError,
  NotImplementedError,
} from "../../application/errors";
import { RequestValidationError } from "./validation";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ error: "Not found" });
};

// Single place where errors become HTTP responses. Unexpected errors are logged and hidden behind a 500.
export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof RequestValidationError) {
    response.status(400).json({ error: error.message, issues: error.issues });
    return;
  }

  if (isMalformedJsonBody(error)) {
    response.status(400).json({ error: "Malformed JSON body" });
    return;
  }

  const expectedStatus = findExpectedErrorStatus(error);

  if (expectedStatus) {
    response.status(expectedStatus).json({ error: (error as Error).message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};

function findExpectedErrorStatus(error: unknown): number | null {
  if (error instanceof NotFoundError) {
    return 404;
  }

  if (error instanceof ConflictError) {
    return 409;
  }

  if (error instanceof BusinessRuleViolationError || error instanceof MissingReferenceError) {
    return 422;
  }

  if (error instanceof NotImplementedError) {
    return 501;
  }

  return null;
}

// express.json() rejects unparsable bodies with this marker.
function isMalformedJsonBody(error: unknown): boolean {
  return (
    error instanceof SyntaxError && (error as SyntaxError & { type?: string }).type === "entity.parse.failed"
  );
}
