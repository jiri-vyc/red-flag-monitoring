import { FINDING_KINDS, type FindingKind, type RuleReviewFinding } from "./ruleReviewReport";

export type FindingCounts = {
  total: number;
  byKind: Record<FindingKind, number>;
  ruleAdjustments: { proposals: number; recalibrations: number };
  associationClients: number;
};

export function countFindings(findings: readonly RuleReviewFinding[]): FindingCounts {
  const ruleAdjustments = findings.filter((finding) => finding.kind === "rule_adjustment");

  return {
    total: findings.length,
    byKind: Object.fromEntries(
      FINDING_KINDS.map((kind) => [kind, findings.filter((finding) => finding.kind === kind).length]),
    ) as Record<FindingKind, number>,
    ruleAdjustments: {
      proposals: ruleAdjustments.filter((finding) => finding.growth?.capExceeded !== true).length,
      recalibrations: ruleAdjustments.filter((finding) => finding.growth?.capExceeded === true).length,
    },
    associationClients: findings
      .filter((finding) => finding.kind === "association")
      .reduce((sum, finding) => sum + finding.clients.length, 0),
  };
}

// The numbers the summary model is given: the counts, each finding's proposal, growth and client count, and
// whatever numbers its explanation states.
export function collectSummaryInputNumbers(input: {
  findings: readonly RuleReviewFinding[];
  explanationSummaries: readonly string[];
}): number[] {
  return [
    ...collectNumbers(countFindings(input.findings)),
    ...input.findings.flatMap((finding) => [
      ...collectNumbers(finding.proposal),
      ...collectNumbers(finding.growth),
      finding.clients.length,
    ]),
    ...input.explanationSummaries.flatMap((summary) => extractNumbers(summary).map((number) => number.value)),
  ];
}

export function findUnverifiedNumbers(text: string, allowedNumbers: readonly number[]): string[] {
  return extractNumbers(text)
    .filter((number) => !allowedNumbers.some((allowed) => matches(number, allowed)))
    .map((number) => number.text);
}

type StatedNumber = { text: string; value: number; tolerance: number; isPercent: boolean };

const SCALES: [RegExp, number][] = [
  [/^mil/i, 1_000_000],
  [/^tis/i, 1_000],
];

// A number that is part of a code (R-04, K004510, SVZ-03, Z9) or of a provision reference (čl. 11.2, § 18) is not
// a stated quantity, so the lookbehind skips it.
const NUMBER_PATTERN =
  /(?<![\p{L}\p{N}\-–/.,])(?<!(?:čl\.|§|odst\.|písm\.)\s?)(\d{1,3}(?:[  ]\d{3})+|\d+)(?:,(\d+))?(?![\p{N}])(\s?%|\s?(?:mil\p{L}*|tis\p{L}*))?/gu;

function extractNumbers(text: string): StatedNumber[] {
  return [...text.matchAll(NUMBER_PATTERN)].map((match) => {
    const [whole, integerPart = "", decimalPart = "", suffix = ""] = match;
    const decimals = decimalPart.length;
    const trimmedSuffix = suffix.trim();
    const scale = SCALES.find(([pattern]) => pattern.test(trimmedSuffix))?.[1] ?? 1;
    const value = Number(`${integerPart.replace(/[  ]/g, "")}.${decimalPart || "0"}`) * scale;

    return {
      text: whole.trim(),
      value,
      tolerance: 0.5 * 10 ** -decimals * scale,
      isPercent: trimmedSuffix === "%",
    };
  });
}

function matches(number: StatedNumber, allowed: number): boolean {
  const candidates = number.isPercent ? [allowed, allowed * 100] : [allowed];

  return candidates.some((candidate) => Math.abs(candidate - number.value) <= number.tolerance + 1e-9);
}

function collectNumbers(value: unknown): number[] {
  if (typeof value === "number") {
    return [value];
  }

  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(collectNumbers);
  }

  return [];
}
