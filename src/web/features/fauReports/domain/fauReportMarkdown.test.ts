import { cs } from "@/i18n/cs";

import { buildTestReport } from "../testing/fauReportFixtures";
import { buildFauReportMarkdown, fauReportMarkdownFileName } from "./fauReportMarkdown";

describe("buildFauReportMarkdown", () => {
  it("is structured by sections I to VI with the draft note first", () => {
    const markdown = buildFauReportMarkdown(buildTestReport());
    const sections = Object.values(cs.fauReports.sections);

    expect(markdown.startsWith("# Oznámení podezřelého obchodu (OPO): OPO-2026-0001")).toBe(true);
    expect(markdown).toContain(`> ${cs.fauReports.exportNote}`);
    const sectionPositions = sections.map((title) => markdown.indexOf(`## ${title}`));
    expect(sectionPositions.every((position) => position > 0)).toBe(true);
    expect([...sectionPositions].sort((left, right) => left - right)).toEqual(sectionPositions);
  });

  it("marks every KYC field for completion and never fills it", () => {
    const markdown = buildFauReportMarkdown(buildTestReport());

    for (const label of Object.values(cs.fauReports.kycFields)) {
      expect(markdown).toContain(`- **${label}:** _[${cs.fauReports.kycMarker}]_`);
    }
  });

  it("carries the report content and the filing once submitted", () => {
    const report = buildTestReport({
      status: "submitted",
      submission: {
        channel: "moneyweb",
        fauReferenceNumber: "FAU-123/2026",
        submittedAt: "2026-10-16T10:00:00.000Z",
        submittedBy: { id: "user-contact", name: "Kontaktní osoba" },
      },
    });
    const markdown = buildFauReportMarkdown(report);

    expect(markdown).toContain(report.description);
    expect(markdown).toContain(cs.fauReports.reportType.money_laundering);
    expect(markdown).toContain(
      `- **${cs.fauReports.executionStatusLabel}:** ${cs.fauReports.executionStatus.executed}`,
    );
    expect(markdown).toContain("- **Číslo jednací FAÚ:** FAU-123/2026");
    expect(markdown).toContain("- **IČO:** 00000000");
  });
});

describe("fauReportMarkdownFileName", () => {
  it("names the file after the OPO number", () => {
    expect(fauReportMarkdownFileName(buildTestReport())).toBe("OPO-2026-0001-koncept.md");
  });
});
