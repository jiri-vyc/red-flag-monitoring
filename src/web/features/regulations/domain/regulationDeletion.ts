import type { LegalBasis } from "../types";

export type RegulationDeletionBlocker = "cited_by_policy" | "cited_by_rule";

// Only the legal bases are read, so a Policy or Rule (or a mock record) fits as is.
type CitingVersion = { legalBases: LegalBasis[] };
type CitingPolicy = { legalBases: LegalBasis[]; versions: CitingVersion[] };
type CitingRule = { versions: CitingVersion[] };

function citesRegulation(legalBases: LegalBasis[], regulationId: string): boolean {
  return legalBases.some((legalBasis) => legalBasis.regulationId === regulationId);
}

/**
 * Why a regulation cannot be deleted, or null when it can. Every version counts, not only the current one:
 * versions are immutable (M17), so even an old citation would lose its legal basis (M3, M5).
 */
export function findRegulationDeletionBlocker(
  regulationId: string,
  { policies, rules }: { policies: CitingPolicy[]; rules: CitingRule[] },
): RegulationDeletionBlocker | null {
  const isCitedByPolicy = policies.some(
    (policy) =>
      citesRegulation(policy.legalBases, regulationId) ||
      policy.versions.some((version) => citesRegulation(version.legalBases, regulationId)),
  );
  if (isCitedByPolicy) {
    return "cited_by_policy";
  }
  const isCitedByRule = rules.some((rule) =>
    rule.versions.some((version) => citesRegulation(version.legalBases, regulationId)),
  );
  return isCitedByRule ? "cited_by_rule" : null;
}
