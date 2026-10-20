import { z } from "zod";

import { ApiError, type ApiErrorKind } from "./apiError";

// The backend rejects invalid input (400), conflicting state (409) and business rule violations (422).
const VALIDATION_STATUSES = [400, 409, 422];
// 501: the endpoint exists but the backend has no implementation yet (NotImplementedError).
const NOT_IMPLEMENTED_STATUS = 501;

// A 400 from request validation also lists the zod issues (backend errorHandler.ts, RequestValidationError).
// A JSON path element that was a symbol arrives as null, hence `unknown`.
const backendErrorIssueSchema = z.object({ path: z.array(z.unknown()).default([]), message: z.string() });
type BackendErrorIssue = z.infer<typeof backendErrorIssueSchema>;

// Malformed issues must not hide the error message itself or the valid issues, so each is parsed on its own.
const backendErrorBodySchema = z.object({
  error: z.string(),
  issues: z.array(z.unknown()).optional().catch(undefined),
});

function parseValidIssues(issues: unknown[]): BackendErrorIssue[] {
  return issues.flatMap((issue) => {
    const parseResult = backendErrorIssueSchema.safeParse(issue);
    return parseResult.success ? [parseResult.data] : [];
  });
}

type RequestOptions<TSchema extends z.ZodType> = {
  path: string;
  schema: TSchema;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  jsonBody?: unknown;
  formBody?: FormData;
};

function buildRequestInit({
  method = "GET",
  jsonBody,
  formBody,
}: Omit<RequestOptions<z.ZodType>, "path" | "schema">) {
  if (formBody) {
    return { method, body: formBody };
  }
  if (jsonBody !== undefined) {
    return { method, body: JSON.stringify(jsonBody), headers: { "Content-Type": "application/json" } };
  }
  return { method };
}

async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api${path}`, init);
  } catch (cause) {
    throw new ApiError({
      kind: "network",
      message: `Could not reach the backend at /api${path}: ${cause instanceof Error ? cause.message : "unknown error"}`,
    });
  }
}

/** One issue as `field.path: message`; an issue of the whole body has no path. */
function formatIssue({ path, message }: BackendErrorIssue): string {
  return path.length === 0 ? message : `${path.map(String).join(".")}: ${message}`;
}

/**
 * The backend error handler answers `{ error }`, a validation error adds `issues`, which are appended so the
 * user sees which field is wrong instead of a bare "Invalid request". Anything else (e.g. a proxy error page)
 * yields null.
 */
async function readBackendErrorMessage(response: Response): Promise<string | null> {
  const responseBody: unknown = await response.json().catch(() => undefined);
  const parseResult = backendErrorBodySchema.safeParse(responseBody);
  if (!parseResult.success) {
    return null;
  }
  const { error, issues: rawIssues = [] } = parseResult.data;
  const issues = parseValidIssues(rawIssues);
  return issues.length === 0 ? error : `${error}: ${issues.map(formatIssue).join("; ")}`;
}

function findErrorKind(status: number): ApiErrorKind {
  if (status === NOT_IMPLEMENTED_STATUS) {
    return "unsupported";
  }
  return VALIDATION_STATUSES.includes(status) ? "validation" : "http";
}

/** Calls the backend through the /api proxy and validates the response DTO. Never falls back to mock data. */
export async function requestJson<TSchema extends z.ZodType>(
  options: RequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const response = await sendRequest(options.path, buildRequestInit(options));

  if (response.status === 404) {
    throw new ApiError({ kind: "not_found", status: 404, message: `Not found: /api${options.path}` });
  }
  if (!response.ok) {
    const backendMessage = await readBackendErrorMessage(response);
    throw new ApiError({
      kind: findErrorKind(response.status),
      status: response.status,
      message: `Backend responded ${response.status} ${response.statusText} for /api${options.path}${backendMessage ? `: ${backendMessage}` : ""}`,
    });
  }

  const responseBody: unknown = await response.json().catch(() => undefined);
  const parseResult = options.schema.safeParse(responseBody);
  if (!parseResult.success) {
    throw new ApiError({
      kind: "invalid_response",
      message: `Unexpected response shape from /api${options.path}: ${parseResult.error.message}`,
    });
  }
  return parseResult.data;
}
