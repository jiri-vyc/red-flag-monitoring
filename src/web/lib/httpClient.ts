import type { z } from "zod";

import { ApiError } from "./apiError";

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

/** Calls the backend through the /api proxy and validates the response DTO. Never falls back to mock data. */
export async function requestJson<TSchema extends z.ZodType>(
  options: RequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const response = await sendRequest(options.path, buildRequestInit(options));

  if (response.status === 404) {
    throw new ApiError({ kind: "not_found", status: 404, message: `Not found: /api${options.path}` });
  }
  if (!response.ok) {
    throw new ApiError({
      kind: "http",
      status: response.status,
      message: `Backend responded ${response.status} ${response.statusText} for /api${options.path}`,
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
