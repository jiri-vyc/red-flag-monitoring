import {
  findDefinedRuleIds,
  findMarkdownSection,
  findRegulationQuotes,
  findUnverifiedQuotes,
} from "./policyDraftReview";

const POLICY_DRAFT = [
  "# SVZ-07 Směrnice o monitoringu plateb",
  "",
  "### Čl. 4 Přehled pravidel",
  "| Čl. 5 | R-18 | Řada malých plateb |",
  "",
  "### Čl. 5 R-18 Řada malých plateb stejnému příjemci",
  "**Citace regulace (bod 11.13 a):** „systémy pro identifikaci propojených transakcí“",
  "**Pravidlo:** Alert vznikne, pokud …",
  "",
  "### Čl. 6 R-19 Opakované platby těsně pod limitem",
  "**Citace regulace (bod 11.7 b) iv.):** „Transakce klienta se vždy pohybují těsně pod platnými limity“",
  "Klient platí „rychle“ a často.",
].join("\n");

const REGULATION = [
  "# EBA/GL/2021/02",
  "## Obecný pokyn č. 10: Odvětvový pokyn pro vydavatele elektronických peněz",
  "10.1. Text pokynu 10.",
  "## Obecný pokyn č. 11: Odvětvový pokyn pro subjekty zabývající se poukazováním peněz",
  "## Rizikové faktory",
  "11.7. Transakce klienta se vždy pohybují těsně",
  "pod platnými limity.",
  "## Opatření",
  "11.13. systémy pro identifikaci propojených transakcí",
  "## Obecný pokyn č. 12: Odvětvový pokyn týkající se správy majetku",
  "12.1. Text pokynu 12.",
].join("\n");

describe("findDefinedRuleIds", () => {
  it("returns rule IDs from rule headings only", () => {
    expect(findDefinedRuleIds(POLICY_DRAFT)).toEqual(["R-18", "R-19"]);
  });

  it("returns an empty list when the policy defines no rule", () => {
    expect(findDefinedRuleIds("# SVZ-07\n| R-18 | jen v tabulce |")).toEqual([]);
  });
});

describe("findRegulationQuotes", () => {
  it("returns quotes from regulation citation lines only", () => {
    expect(findRegulationQuotes(POLICY_DRAFT)).toEqual([
      "systémy pro identifikaci propojených transakcí",
      "Transakce klienta se vždy pohybují těsně pod platnými limity",
    ]);
  });
});

describe("findUnverifiedQuotes", () => {
  it("accepts quotes that appear verbatim, regardless of line breaks", () => {
    const quotes = ["Transakce klienta se vždy pohybují těsně pod platnými limity"];

    expect(findUnverifiedQuotes(quotes, REGULATION)).toEqual([]);
  });

  it("flags quotes that do not appear in the regulation", () => {
    const quotes = ["systémy pro identifikaci propojených transakcí", "vymyšlená citace"];

    expect(findUnverifiedQuotes(quotes, REGULATION)).toEqual(["vymyšlená citace"]);
  });
});

describe("findMarkdownSection", () => {
  it("returns the section with its subsections up to the next heading of the same level", () => {
    const section = findMarkdownSection(REGULATION, "Obecný pokyn č. 11");

    expect(section).toContain("11.13. systémy pro identifikaci propojených transakcí");
    expect(section).not.toContain("Obecný pokyn č. 12");
    expect(section).not.toContain("10.1.");
  });

  it("keeps same-level subsections that are not numbered siblings", () => {
    const section = findMarkdownSection(REGULATION, "Obecný pokyn č. 11");

    expect(section).toContain("## Rizikové faktory");
    expect(section).toContain("## Opatření");
  });

  it("ends a law provision at the next provision", () => {
    const law = [
      "## ČÁST PRVNÍ",
      "### § 6",
      "#### Podezřelý obchod",
      "(1) Text § 6.",
      "### § 7",
      "(1) Text § 7.",
    ].join("\n");

    expect(findMarkdownSection(law, "§ 6")).toBe("### § 6\n#### Podezřelý obchod\n(1) Text § 6.");
  });

  it("returns the rest of the document for the last section", () => {
    expect(findMarkdownSection(REGULATION, "Obecný pokyn č. 12")).toBe(
      "## Obecný pokyn č. 12: Odvětvový pokyn týkající se správy majetku\n12.1. Text pokynu 12.",
    );
  });

  it("returns null when no heading contains the text", () => {
    expect(findMarkdownSection(REGULATION, "Obecný pokyn č. 99")).toBeNull();
  });
});
