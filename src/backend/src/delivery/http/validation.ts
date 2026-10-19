import { z } from "zod";

export class RequestValidationError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super("Invalid request");
  }
}

export function parseRequest<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new RequestValidationError(result.error.issues);
  }

  return result.data;
}
