import { createHash } from "node:crypto";

import type { RegulationKind } from "./regulation";

// Public sources of AML regulations. Fetching any other host would let a request reach internal addresses (SSRF).
export const ALLOWED_REGULATION_SOURCE_DOMAINS = [
  "eur-lex.europa.eu",
  "e-sbirka.gov.cz",
  "zakonyprolidi.cz",
  "cnb.cz",
  "fatf-gafi.org",
] as const;

export const URL_REGULATION_KIND: RegulationKind = "guidance";

const CODE_HASH_LENGTH = 8;

export function isAllowedRegulationSourceUrl(rawUrl: string): boolean {
  if (!URL.canParse(rawUrl)) {
    return false;
  }

  const url = new URL(rawUrl);

  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    ALLOWED_REGULATION_SOURCE_DOMAINS.some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
  );
}

// Regulation codes are unique, so the code of a regulation imported from a URL is stable per URL.
export function deriveRegulationCodeFromUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const host = url.hostname.replace(/^www\./, "").toUpperCase();
  const hash = createHash("sha256").update(url.href).digest("hex").slice(0, CODE_HASH_LENGTH).toUpperCase();

  return `URL-${host}-${hash}`;
}

export function deriveUrlVersionLabel(fetchedAt: Date): string {
  return `Načteno z URL k ${fetchedAt.toISOString().slice(0, 10)}`;
}

export function derivePastedVersionLabel(createdAt: Date): string {
  return `Vloženo k ${createdAt.toISOString().slice(0, 10)}`;
}
