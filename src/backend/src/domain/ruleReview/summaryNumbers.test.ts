import type { RuleReviewFinding } from "./ruleReviewReport";
import { collectSummaryInputNumbers, countFindings, findUnverifiedNumbers } from "./summaryNumbers";

function finding(
  overrides: Partial<RuleReviewFinding> & Pick<RuleReviewFinding, "id" | "kind">,
): RuleReviewFinding {
  return { rule: null, proposal: null, growth: null, clients: [], evidence: {}, ...overrides };
}

function clients(count: number): RuleReviewFinding["clients"] {
  return Array.from({ length: count }, (_, index) => ({
    clientId: `K${index}`,
    transactionIds: [],
    nearMissCount: 0,
    distinctDays: 0,
    minDistance: null,
    seedLinks: [],
  }));
}

const FINDINGS: RuleReviewFinding[] = [
  ...Array.from({ length: 22 }, (_, index) =>
    finding({
      id: `adjustment-${index}`,
      kind: "rule_adjustment",
      growth: { baseClients: 1077, addedClients: 12, capExceeded: false },
      proposal: {
        parameter: "condition:a",
        parameterType: "ratio",
        currentValue: 0.8,
        proposedValue: 0.78,
        step: 0.025,
      },
      clients: clients(12),
    }),
  ),
  ...Array.from({ length: 2 }, (_, index) =>
    finding({
      id: `recalibration-${index}`,
      kind: "rule_adjustment",
      growth: { baseClients: 16, addedClients: 89, capExceeded: true },
    }),
  ),
  ...Array.from({ length: 38 }, (_, index) =>
    finding({ id: `association-${index}`, kind: "association", clients: clients(1) }),
  ),
  finding({ id: "coverage_gap:H-7", kind: "coverage_gap" }),
  finding({ id: "coverage_gap:H-8", kind: "coverage_gap" }),
];

const ALLOWED = collectSummaryInputNumbers({
  findings: FINDINGS,
  explanationSummaries: ["Klient K002538 odeslal 79,9 % přijaté částky, 3,3 milionu Kč."],
});

describe("countFindings", () => {
  it("counts findings by kind and splits rule adjustments into proposals and recalibrations", () => {
    expect(countFindings(FINDINGS)).toEqual({
      total: 64,
      byKind: { rule_adjustment: 24, new_rule: 0, coverage_gap: 2, association: 38 },
      ruleAdjustments: { proposals: 22, recalibrations: 2 },
      associationClients: 38,
    });
  });
});

describe("findUnverifiedNumbers", () => {
  it("flags counts the model got wrong in the first e2e run", () => {
    const summary =
      "Přezkum identifikoval celkem 67 nálezů, z toho 25 návrhů na úpravu pravidel a 42 asociačních podnětů.";

    expect(findUnverifiedNumbers(summary, ALLOWED)).toEqual(["67", "25", "42"]);
  });

  it("accepts numbers from the input in Czech formats", () => {
    const summary =
      "Přezkum našel 64 nálezů: 24 úprav pravidel a 38 asociačních podnětů. Pravidlo R-04 má 1 077 klientů, " +
      "návrh je 0,8 → 0,78 (krok 2,5 %) a přidá 12 klientů. Klient K002538 odeslal 79,9 %, přes 3,3 milionu Kč.";

    expect(findUnverifiedNumbers(summary, ALLOWED)).toEqual([]);
  });

  it("ignores rule codes, client IDs, indicators and provision references", () => {
    const summary = "Pravidla R-06 a R-10, klient K004510, znak Z9, SVZ-03 čl. 11.2 a § 18 AML zákona.";

    expect(findUnverifiedNumbers(summary, ALLOWED)).toEqual([]);
  });
});
