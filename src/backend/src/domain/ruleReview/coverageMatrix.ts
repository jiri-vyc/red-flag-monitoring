import type { CoverageMatrixRow } from "./ruleReviewReport";

type IndicatorScenario = { indicator: string; label: string; declaredRuleCodes: string[] };

// Not matched by legal basis: Z3 and Z9 share § 6 odst. 1 písm. d) AMLZ, so the policy's "Detekce" column decides.
export const SVZ03_INDICATORS: readonly IndicatorScenario[] = [
  {
    indicator: "Z1",
    label: "Nápadně více operací nebo objemu, než je pro klienta obvyklé",
    declaredRuleCodes: ["R-01"],
  },
  {
    indicator: "Z2",
    label: "Prostředky neodpovídají deklarovanému rozsahu činnosti",
    declaredRuleCodes: ["R-01", "R-05"],
  },
  { indicator: "Z3", label: "Neobvykle objemná jednotlivá transakce", declaredRuleCodes: ["R-01"] },
  { indicator: "Z4", label: "Přijaté prostředky bezprostředně posílány dál", declaredRuleCodes: ["R-04"] },
  {
    indicator: "Z5",
    label: "Účet využíván v rozporu s deklarovaným účelem (sběrný účet)",
    declaredRuleCodes: ["R-06"],
  },
  { indicator: "Z6", label: "Transakce souvisí s vysoce rizikovou zemí", declaredRuleCodes: ["R-02"] },
  { indicator: "Z7", label: "Významný odchozí tok PEP", declaredRuleCodes: ["R-03"] },
  {
    indicator: "Z8",
    label: "Účet založený na dálku využit nad deklarovaný rámec",
    declaredRuleCodes: ["R-05"],
  },
  {
    indicator: "Z9",
    label: "Převody bez zřejmého ekonomického důvodu, složité řetězce plateb",
    declaredRuleCodes: [],
  },
  { indicator: "Z10", label: "Klient odmítá doložit účel nebo zdroj prostředků", declaredRuleCodes: [] },
  {
    indicator: "Z11",
    label: "Činnosti zastírající totožnost klienta (platby za třetí osoby)",
    declaredRuleCodes: [],
  },
  { indicator: "Z12", label: "Účastník na sankčním seznamu", declaredRuleCodes: [] },
];

export function buildCoverageMatrix(activeRuleCodes: readonly string[]): CoverageMatrixRow[] {
  const activeCodes = new Set(activeRuleCodes);

  return SVZ03_INDICATORS.map(({ indicator, label, declaredRuleCodes }) => ({
    indicator,
    label,
    ruleCodes: declaredRuleCodes.filter((ruleCode) => activeCodes.has(ruleCode)),
  }));
}
