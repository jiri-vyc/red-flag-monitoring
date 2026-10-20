import { z } from "zod";

// `z.url()` alone also accepts e.g. `javascript:` URLs, which would run when a rendered link is clicked.
const httpUrlSchema = z.url({ protocol: /^https?$/ });

export function isHttpUrl(value: string): boolean {
  return httpUrlSchema.safeParse(value).success;
}

/** A URL that is safe to render as a link: an http(s) URL as is, anything else (missing, `javascript:`…) as "". */
export function toSafeSourceUrl(value: string | null | undefined): string {
  return value != null && isHttpUrl(value) ? value : "";
}
