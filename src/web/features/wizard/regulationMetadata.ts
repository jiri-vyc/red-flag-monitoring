import type { RegulationKind } from "@/features/regulations/api/dto";
import type { Regulation } from "@/features/regulations/types";

import { isHttpUrl, type SourceFormValues } from "./sourceForm";

/** Regulation metadata found in the header of an uploaded or pasted regulation text. */
export type DetectedRegulationMetadata = {
  title?: string;
  kind?: RegulationKind;
  code?: string;
  sourceUrl?: string;
  versionLabel?: string;
};

/** The form fields a detected metadata value can fill, in the order the suggestion lists them. */
export const METADATA_FORM_FIELDS = ["title", "regulationKind", "code", "sourceUrl", "versionLabel"] as const;
export type MetadataFormField = (typeof METADATA_FORM_FIELDS)[number];
export type MetadataFormChanges = Partial<Pick<SourceFormValues, MetadataFormField>>;

// The metadata sits in the document header; the rest of a full regulation text is not scanned.
const SCANNED_LINE_COUNT = 60;
const MAX_PLAIN_TEXT_TITLE_LENGTH = 250;
const MAX_ABBREVIATION_LENGTH = 40;
const MAX_ABBREVIATION_WORDS = 3;
const MAX_CODE_LENGTH = 40;

const MARKDOWN_H1_PATTERN = /^#\s+(.+)$/;
const URL_PATTERN = /https?:\/\/[^\s<>"'`\])]+/gi;
const TRAILING_URL_PUNCTUATION_PATTERN = /[.,;:!?]+$/;
const DATE_PATTERN_SOURCE = String.raw`(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})`;
// A wording line ("Znění: … účinné od 11. 1. 2026", "… účinnost od …") is preferred; elsewhere only "účinné od"
// counts, so a note such as "S účinností od 10. 7. 2027 ji nahrazuje AMLR" is not taken for the wording date.
const WORDING_EFFECTIVE_FROM_PATTERN = new RegExp(
  String.raw`znění.*účinn\p{L}*\s+od\s+${DATE_PATTERN_SOURCE}`,
  "iu",
);
const EFFECTIVE_FROM_PATTERN = new RegExp(String.raw`účinné\s+od\s+${DATE_PATTERN_SOURCE}`, "iu");
const PARENTHESISED_PATTERN = /\(([^()]+)\)/g;
// A "word" boundary that also works for Czech letters, which `\b` does not.
const WORD_END = String.raw`(?!\p{L})`;

/** Act types are named by the first word of the title; a plain Czech "Směrnice" (an internal directive) is not an EU act. */
const ACT_KIND_PATTERNS: readonly { kind: RegulationKind; pattern: RegExp }[] = [
  { kind: "law", pattern: new RegExp(String.raw`^zákon${WORD_END}`, "iu") },
  { kind: "decree", pattern: new RegExp(String.raw`^vyhláška${WORD_END}`, "iu") },
  { kind: "eu_reg", pattern: /^nařízení\s+(?:\(EU\)|evropského\s+parlamentu)/iu },
  { kind: "eu_dir", pattern: /^směrnice\s+(?:\(EU\)|evropského\s+parlamentu)/iu },
];
const GUIDANCE_PATTERN = new RegExp(
  String.raw`(?:obecné pokyny|guidelines|metodický pokyn|metodika|doporučení|recommendations|benchmark)${WORD_END}`,
  "iu",
);

/** Official act numbers that identify a regulation when the title has no abbreviation. */
const ACT_NUMBER_CODES: readonly { pattern: RegExp; toCode: (match: RegExpExecArray) => string }[] = [
  {
    pattern: /zákon\p{L}*\s+(?:ČNB\s+)?č\.\s*(\d+)\/(\d{4})/iu,
    toCode: (match) => `Z-${match[1]}-${match[2]}`,
  },
  {
    pattern: /vyhlášk\p{L}*\s+(?:ČNB\s+)?č\.\s*(\d+)\/(\d{4})/iu,
    toCode: (match) => `V-${match[1]}-${match[2]}`,
  },
  { pattern: /\(EU\)\s*(?:č\.\s*)?(\d{4})\/(\d+)/iu, toCode: (match) => `EU-${match[1]}-${match[2]}` },
  { pattern: /EBA\/GL\/(\d{4})\/(\d+)/i, toCode: (match) => `EBA-GL-${match[1]}-${match[2]}` },
];

/** The header line the knowledge base uses for the text source (`> **Zdroj textu:** https://…`) wins over others. */
const SOURCE_LINE_PATTERNS: readonly RegExp[] = [
  /zdroj textu/i,
  /^[>\s*_]*(?:zdroj|source)(?!\p{L})/iu,
  /(?:zdroj|source)/i,
];

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Removes markdown emphasis and quote markers from a header line. */
function stripMarkdown(line: string): string {
  return line
    .replace(/^[>\s#]+/, "")
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .trim();
}

function findTitle(lines: string[]): string | undefined {
  for (const line of lines) {
    const heading = MARKDOWN_H1_PATTERN.exec(line.trim());
    if (heading) {
      return stripMarkdown(heading[1]) || undefined;
    }
  }
  const firstLine = lines.map((line) => line.trim()).find((line) => line !== "");
  if (firstLine === undefined || firstLine.length >= MAX_PLAIN_TEXT_TITLE_LENGTH) {
    return undefined;
  }
  return stripMarkdown(firstLine) || undefined;
}

function findKind(title: string): RegulationKind | undefined {
  const actKind = ACT_KIND_PATTERNS.find(({ pattern }) => pattern.test(title))?.kind;
  if (actKind) {
    return actKind;
  }
  return GUIDANCE_PATTERN.test(title) ? "guidance" : undefined;
}

/** ASCII upper case with dashes, e.g. "AML zákon" → "AML-ZAKON". */
export function toRegulationCode(value: string): string {
  return stripDiacritics(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_CODE_LENGTH)
    .replace(/-+$/, "");
}

/** An abbreviation such as "(AMLR)" or "(AML zákon)", not "(EU)" or a lower-case remark such as "(kryptoaktiva)". */
function isAbbreviation(value: string): boolean {
  const trimmedValue = value.trim();
  return (
    trimmedValue.length <= MAX_ABBREVIATION_LENGTH &&
    trimmedValue.split(/\s+/).length <= MAX_ABBREVIATION_WORDS &&
    /\p{Lu}/u.test(trimmedValue) &&
    trimmedValue.toUpperCase() !== "EU"
  );
}

function findAbbreviationCode(title: string): string | undefined {
  // The abbreviation usually closes the title, e.g. "…, kterou se mění směrnice (EU) 2015/849 (AMLD5)".
  const abbreviation = [...title.matchAll(PARENTHESISED_PATTERN)]
    .map((match) => match[1])
    .filter(isAbbreviation)
    .at(-1);
  return abbreviation === undefined ? undefined : toRegulationCode(abbreviation) || undefined;
}

/** The act number that appears first in the title names the act itself, not the acts it amends. */
function findActNumberCode(title: string): string | undefined {
  const firstMatch = ACT_NUMBER_CODES.flatMap(({ pattern, toCode }) => {
    const match = pattern.exec(title);
    return match ? [{ index: match.index, code: toCode(match) }] : [];
  }).toSorted((left, right) => left.index - right.index)[0];
  return firstMatch?.code;
}

function findCode(title: string): string | undefined {
  return findAbbreviationCode(title) ?? findActNumberCode(title);
}

function findHttpUrls(line: string): string[] {
  return [...line.matchAll(URL_PATTERN)]
    .map((match) => match[0].replace(TRAILING_URL_PUNCTUATION_PATTERN, ""))
    .filter(isHttpUrl);
}

function findSourceUrl(lines: string[]): string | undefined {
  for (const sourceLinePattern of SOURCE_LINE_PATTERNS) {
    const sourceUrl = lines
      .filter((line) => sourceLinePattern.test(line))
      .flatMap(findHttpUrls)
      .at(0);
    if (sourceUrl) {
      return sourceUrl;
    }
  }
  return lines.flatMap(findHttpUrls).at(0);
}

function findVersionLabel(lines: string[]): string | undefined {
  for (const pattern of [WORDING_EFFECTIVE_FROM_PATTERN, EFFECTIVE_FROM_PATTERN]) {
    const match = lines.map((line) => pattern.exec(line)).find((lineMatch) => lineMatch !== null);
    if (match) {
      const [, day, month, year] = match;
      return `Znění od ${Number(day)}. ${Number(month)}. ${year}`;
    }
  }
  return undefined;
}

/** Reads the regulation metadata from the header (the first lines) of a Markdown or plain regulation text. */
export function detectRegulationMetadata(text: string): DetectedRegulationMetadata {
  const lines = text.split(/\r?\n/).slice(0, SCANNED_LINE_COUNT);
  const title = findTitle(lines);
  const detected: DetectedRegulationMetadata = {
    title,
    kind: title === undefined ? undefined : findKind(title),
    code: title === undefined ? undefined : findCode(title),
    sourceUrl: findSourceUrl(lines),
    versionLabel: findVersionLabel(lines),
  };
  return Object.fromEntries(
    Object.entries(detected).filter(([, value]) => value !== undefined),
  ) as DetectedRegulationMetadata;
}

function normalizeTitle(title: string): string {
  return stripDiacritics(title)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[\s.,;:]+$/, "")
    .trim();
}

/** Ignores the scheme, `www.`, a trailing slash and the fragment, which do not change the document. */
function normalizeUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url.trim());
    const host = parsedUrl.host.toLowerCase().replace(/^www\./, "");
    const path = parsedUrl.pathname.replace(/\/+$/, "");
    return `${host}${path}${parsedUrl.search}`;
  } catch {
    return null;
  }
}

/**
 * The existing regulation the detected metadata describes: by code first, then source URL, then title.
 * Adding the text as its new wording avoids creating a duplicate (the backend rejects a duplicate code).
 */
export function findMatchingRegulation(
  detected: DetectedRegulationMetadata,
  regulations: Regulation[],
): Regulation | null {
  const { code, sourceUrl, title } = detected;
  const detectedUrl = sourceUrl === undefined ? null : normalizeUrl(sourceUrl);
  const byCode =
    code === undefined
      ? undefined
      : regulations.find((regulation) => toRegulationCode(regulation.shortName) === toRegulationCode(code));
  const byUrl =
    detectedUrl === null
      ? undefined
      : regulations.find(
          (regulation) => regulation.sourceUrl !== "" && normalizeUrl(regulation.sourceUrl) === detectedUrl,
        );
  const byTitle =
    title === undefined
      ? undefined
      : regulations.find((regulation) => normalizeTitle(regulation.name) === normalizeTitle(title));
  return byCode ?? byUrl ?? byTitle ?? null;
}

/**
 * The form values the detected metadata fills. A wording of an existing regulation takes only the
 * version label, since the regulation fields are hidden then.
 */
export function toMetadataFormChanges(
  detected: DetectedRegulationMetadata,
  { isNewRegulation }: { isNewRegulation: boolean },
): MetadataFormChanges {
  const changes: MetadataFormChanges = { versionLabel: detected.versionLabel };
  if (isNewRegulation) {
    Object.assign(changes, {
      title: detected.title,
      regulationKind: detected.kind,
      code: detected.code,
      sourceUrl: detected.sourceUrl,
    });
  }
  return Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as MetadataFormChanges;
}

/** Fields whose own value (neither empty nor the untouched default) the changes would replace. */
export function findOverwrittenFields(
  values: Pick<SourceFormValues, MetadataFormField>,
  changes: MetadataFormChanges,
  initialValues: Pick<SourceFormValues, MetadataFormField>,
): MetadataFormField[] {
  return METADATA_FORM_FIELDS.filter((field) => {
    const change = changes[field];
    const currentValue = values[field];
    return (
      change !== undefined &&
      currentValue.trim() !== "" &&
      currentValue !== change &&
      currentValue !== initialValues[field]
    );
  });
}

/** The current values of the fields the changes touch, so filling them can be undone. */
export function pickMetadataValues(
  values: Pick<SourceFormValues, MetadataFormField>,
  changes: MetadataFormChanges,
): MetadataFormChanges {
  return Object.fromEntries(
    METADATA_FORM_FIELDS.filter((field) => changes[field] !== undefined).map((field) => [
      field,
      values[field],
    ]),
  ) as MetadataFormChanges;
}
