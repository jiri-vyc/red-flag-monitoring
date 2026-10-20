import { z } from "zod";

import { REGULATION_KINDS } from "../../domain/regulation";
import { REVIEW_DECISIONS, INITIAL_VERSION_STATUSES, VERSION_ORIGINS } from "../../domain/versionStatus";

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 500;

export const requiredText = z.string().trim().min(1);
export const optionalText = requiredText.nullish().transform((value) => value ?? null);

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CLIENT_ID_PATTERN = /^K[0-9]{6}$/;

// transactions.ts is a local timestamp, so the bounds are local too: "2026-07-01", "2026-07-01T10:00" or
// "2026-07-01T10:00:00", no offset. They are normalized to "YYYY-MM-DDTHH:MM:SS", which compares as text.
const LOCAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

export const localTimestampSchema = z
  .string()
  .regex(LOCAL_TIMESTAMP_PATTERN)
  .transform(normalizeLocalTimestamp)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: "Invalid date" })
  .nullish()
  .transform((value) => value ?? null);

export const newRegulationSchema = z.object({
  code: requiredText,
  title: requiredText,
  kind: z.enum(REGULATION_KINDS),
  sourceUrl: z
    .url()
    .nullish()
    .transform((value) => value ?? null),
  checkedAt: z.iso
    .datetime({ offset: true })
    .nullish()
    .transform((value) => (value ? new Date(value) : null)),
});

export const versionAuthorSchema = z.object({
  status: z.enum(INITIAL_VERSION_STATUSES).default("draft"),
  createdVia: z.enum(VERSION_ORIGINS),
  createdBy: z.uuid(),
});

export const reviewBodySchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  reviewedBy: z.uuid(),
  reviewComment: optionalText,
});

export function uniqueBy<Item>(items: Item[], toKey: (item: Item) => string): boolean {
  return new Set(items.map(toKey)).size === items.length;
}

function normalizeLocalTimestamp(value: string): string {
  const [date = "", time = "00:00"] = value.split("T");

  return `${date}T${time.length === 5 ? `${time}:00` : time}`;
}
