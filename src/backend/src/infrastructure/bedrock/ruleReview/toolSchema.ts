import { z } from "zod";

import type { ModelTool } from "./modelCall";

// The "$schema" meta keyword is not part of a tool input schema, so only the schema body is sent.
export function toToolInputSchema(schema: z.ZodObject): ModelTool["input_schema"] {
  const body = Object.entries(z.toJSONSchema(schema)).filter(([keyword]) => keyword !== "$schema");

  return { ...Object.fromEntries(body), type: "object" };
}

export const NO_INPUT_SCHEMA: ModelTool["input_schema"] = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
