// Expected failures of use cases. delivery/http/errorHandler.ts maps them to HTTP status codes.

export class NotFoundError extends Error {
  constructor(entityName: string, id: string) {
    super(`${entityName} ${id} not found`);
  }
}

// The request clashes with the current state: a duplicate key or a version no longer in the expected status.
export class ConflictError extends Error {}

export class BusinessRuleViolationError extends Error {}

// A step of the flow that exists in the API but has no implementation yet.
export class NotImplementedError extends Error {}

// The request points at a row that does not exist, e.g. an unknown user or regulation version.
export class MissingReferenceError extends Error {}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
