import fixtureReport from "@/mocks/seed/ruleReviewReport.json";

import { ruleReviewReportDtoSchema } from "../api/dto";
import {
  countClients,
  formatStepPercent,
  groupFindings,
  parseSeedReason,
  selectReviewId,
} from "./findingGroups";

const REPORT = ruleReviewReportDtoSchema.parse(fixtureReport);

describe("groupFindings", () => {
  it("separates gaps, recalibrations and association leads of a real local report", () => {
    const groups = groupFindings(REPORT.findings);

    expect(groups.gaps.length).toBeGreaterThan(0);
    expect(groups.gaps.every((finding) => finding.growth?.capExceeded === false)).toBe(true);
    expect(
      groups.recalibrations.every((finding) => finding.proposal === null && finding.clients.length === 0),
    ).toBe(true);
    expect(groups.associations.every((finding) => finding.rule === null)).toBe(true);
    expect(
      groups.gaps.length +
        groups.recalibrations.length +
        groups.proposedRules.length +
        groups.coverageGaps.length +
        groups.associations.length,
    ).toBe(REPORT.findings.length);
  });
});

describe("selectReviewId", () => {
  const reviews = [{ id: "newest" }, { id: "older" }];

  it("keeps a requested review that exists and falls back to the newest", () => {
    expect(selectReviewId(reviews, "older")).toBe("older");
    expect(selectReviewId(reviews, "missing")).toBe("newest");
    expect(selectReviewId([], null)).toBeNull();
  });
});

describe("helpers", () => {
  it("parses seed reasons, formats steps and counts distinct clients", () => {
    expect(parseSeedReason("rule_hit:R-04")).toEqual({ kind: "rule_hit", rule: "R-04" });
    expect(parseSeedReason("pep")).toEqual({ kind: "pep", rule: null });
    expect(formatStepPercent(0.025)).toBe("2.5 %");
    expect(countClients({ findings: [] })).toBe(0);
  });
});
