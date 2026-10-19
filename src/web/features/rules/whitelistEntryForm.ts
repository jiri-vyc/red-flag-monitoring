import { z } from "zod";

import type { AddWhitelistEntryInput } from "./types";

/** Error messages are dictionary keys under `whitelist`, so the form can show them in the current language. */
export type WhitelistEntryFormErrorKey = "validationClientId" | "validationReason";

export type WhitelistEntryFormValues = { clientId: string; reason: string };

export type WhitelistEntryFormResult =
  | { isValid: true; input: Omit<AddWhitelistEntryInput, "ruleId"> }
  | { isValid: false; errors: Partial<Record<keyof WhitelistEntryFormValues, WhitelistEntryFormErrorKey>> };

export const CLIENT_ID_PATTERN = /^K\d{6}$/;

const whitelistEntryFormSchema = z.object({
  clientId: z.string().trim().toUpperCase().regex(CLIENT_ID_PATTERN, "validationClientId"),
  reason: z.string().trim().min(1, "validationReason"),
});

function isErrorKey(message: string): message is WhitelistEntryFormErrorKey {
  return message === "validationClientId" || message === "validationReason";
}

export function validateWhitelistEntryForm(values: WhitelistEntryFormValues): WhitelistEntryFormResult {
  const parseResult = whitelistEntryFormSchema.safeParse(values);
  if (parseResult.success) {
    return { isValid: true, input: parseResult.data };
  }
  const errors: Extract<WhitelistEntryFormResult, { isValid: false }>["errors"] = {};
  for (const issue of parseResult.error.issues) {
    const fieldName = issue.path[0];
    if ((fieldName === "clientId" || fieldName === "reason") && isErrorKey(issue.message)) {
      errors[fieldName] = issue.message;
    }
  }
  return { isValid: false, errors };
}
