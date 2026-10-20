import type { Finding, RuleReviewReport } from "../types";

export type FindingGroups = {
  gaps: Finding[];
  recalibrations: Finding[];
  proposedRules: Finding[];
  coverageGaps: Finding[];
  associations: Finding[];
};

export function groupFindings(findings: Finding[]): FindingGroups {
  return {
    gaps: findings.filter((finding) => finding.rule !== null && finding.growth?.capExceeded !== true),
    recalibrations: findings.filter((finding) => finding.growth?.capExceeded === true),
    proposedRules: findings.filter((finding) => finding.kind === "new_rule" && finding.rule === null),
    coverageGaps: findings.filter((finding) => finding.kind === "coverage_gap"),
    associations: findings.filter((finding) => finding.kind === "association"),
  };
}

export function selectReviewId(reviews: { id: string }[], requestedId: string | null): string | null {
  if (requestedId !== null && reviews.some((review) => review.id === requestedId)) {
    return requestedId;
  }
  return reviews[0]?.id ?? null;
}

export function countClients(report: Pick<RuleReviewReport, "findings">): number {
  return new Set(report.findings.flatMap((finding) => finding.clients.map((client) => client.clientId))).size;
}

export function parseSeedReason(reason: string): { kind: string; rule: string | null } {
  const [kind = reason, rule = null] = reason.split(":");
  return { kind, rule };
}

export function formatStepPercent(step: number): string {
  return `${Math.round(step * 1000) / 10} %`;
}
