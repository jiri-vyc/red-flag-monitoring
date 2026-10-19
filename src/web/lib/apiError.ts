export type ApiErrorKind = "network" | "http" | "invalid_response" | "not_found" | "validation" | "storage";

// Single error type thrown by every service (live and mock) so the UI can render one consistent error state.
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor({
    kind,
    message,
    status = null,
  }: {
    kind: ApiErrorKind;
    message: string;
    status?: number | null;
  }) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
