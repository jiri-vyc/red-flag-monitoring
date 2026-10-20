import type { CitedEvidence } from "../../../domain/ruleReview/ruleReviewReport";

// The model cites values as text, so the output schema needs no union type (Bedrock caps those).
export type TextCitation = { path: string; value: string };
// `reason` goes beyond 1a's CitedEvidence; the UI may show it next to the warning.
export type UnverifiedCitation = CitedEvidence & { reason: string };

// Relative tolerance for numbers: the model echoes values as text, which may drop float noise (0.1 + 0.2).
const NUMBER_TOLERANCE = 1e-9;

type PathLookup = { isFound: true; value: unknown } | { isFound: false };

// The path syntax is promised to the model in FINDING_EXPLANATION_SYSTEM_PROMPT: "clients.0.profile.riskScore".
export function findUnverifiedCitations(citations: TextCitation[], evidence: unknown): UnverifiedCitation[] {
  return citations.flatMap((citation) => {
    const reason = findCitationMismatch(citation, evidence);

    return reason === null ? [] : [{ ...citation, reason }];
  });
}

function findCitationMismatch(citation: TextCitation, evidence: unknown): string | null {
  const lookup = lookUpPath(evidence, parsePath(citation.path));

  if (!lookup.isFound) {
    return "path does not exist in the evidence";
  }

  if (typeof lookup.value === "object" && lookup.value !== null) {
    return "path points at an object or a list, not a value";
  }

  return isCitedValueEqual(lookup.value, citation.value)
    ? null
    : `evidence has ${JSON.stringify(lookup.value)}`;
}

function parsePath(path: string): string[] {
  return path
    .trim()
    .replace(/^\$\.?/, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((segment) => segment !== "");
}

function lookUpPath(evidence: unknown, segments: string[]): PathLookup {
  let current: unknown = evidence;

  for (const segment of segments) {
    if (typeof current !== "object" || current === null || !Object.hasOwn(current, segment)) {
      return { isFound: false };
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return segments.length === 0 ? { isFound: false } : { isFound: true, value: current };
}

function isCitedValueEqual(actual: unknown, cited: string): boolean {
  const citedText = cited.trim();

  if (typeof actual === "number") {
    const citedNumber = Number(citedText.replace(/\s/g, "").replace(",", "."));

    return (
      citedText !== "" && Math.abs(citedNumber - actual) <= NUMBER_TOLERANCE * Math.max(1, Math.abs(actual))
    );
  }

  return citedText === String(actual);
}
