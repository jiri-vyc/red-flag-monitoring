import type { RuleExtractionRequest } from "../../application/extractRuleCandidates";
import { AVAILABLE_DATA_FIELDS } from "./datasetFields";

// Rule R-01 from knowledgebase/pravidla-priklady, rewritten into the output schema as the target style.
const EXAMPLE_RULE = JSON.stringify(
  {
    ruleId: "R-01",
    title: "Nesoulad s profilem klienta",
    definition: [
      "Alert, pokud v měsíci platí aspoň jedna podmínka:",
      "",
      "- (a) denní objem klienta (součet všech transakcí bez ohledu na směr) > 0,25 × očekávaný měsíční objem (`projected_monthly_volume_czk`);",
      "- (b) denní objem klienta > 3 × (`q2_volume_czk` / 91);",
      "- (c) jednotlivá transakce > 2 × `q2_max_tx_czk`.",
      "",
      "Klient bez transakcí v Q2 se posuzuje jen podle (a).",
    ].join("\n"),
    alertGranularity: "1 alert na klienta a měsíc",
    kind: "deterministic",
    parameters: [
      { name: "P_A1", value: "0,25", source: "calibration" },
      { name: "P_A2", value: "3", source: "calibration" },
      { name: "P_A3", value: "2", source: "calibration" },
    ],
    regulationSources: [
      { regulation: "Vyhláška ČNB 67/2018", provisions: "§ 9 odst. 4 písm. c) a odst. 5" },
      { regulation: "AML zákon 253/2008", provisions: "§ 6 odst. 1 písm. b), d), e)" },
    ],
    internalPolicySource: "SVZ-03, Příloha 1, R-01",
    openQuestions: [],
  },
  null,
  2,
);

export const RULE_EXTRACTION_SYSTEM_PROMPT = `
Jsi specialista na AML compliance a transakční monitoring v české finanční instituci.
Z vnitřního předpisu instituce (součást systému vnitřních zásad, SVZ) převádíš pravidla monitoringu do vyhodnotitelné podoby.
Výstup je podklad pro posouzení AML compliance officerem a právníkem, ne schválené pravidlo.

Postup:
- Každé pravidlo monitoringu, které předpis definuje (má vlastní ID, např. R-07), převeď na jednu položku výstupu. Nevymýšlej pravidla, která předpis nedefinuje.
- Pravidlo ber z místa, kde je v předpisu jeho logika a parametry (článek pravidla nebo příloha). Společná pravidla výpočtu a pojmy z obecné části předpisu (např. směr transakce, přepočet měn, okna, vyšší riziko) do definice promítni.

Pole výstupu:
- ruleId, title: ID a název pravidla přesně podle předpisu.
- definition: krátká česká definice, kterou jde přímo vyhodnotit nad daty.
  - Začni „Alert, pokud …“ nebo „Alert pro každou transakci …“. Vícekrokovou logiku napiš jako číslovaný seznam, alternativní podmínky jako seznam (a), (b), (c).
  - Datová pole piš v backtickách přesně podle seznamu polí, hodnoty bez backticků (např. \`tx_type\` = remittance).
  - Směr piš takto: příchozí (\`incoming\`), odchozí (\`outgoing\` nebo \`remittance\`).
  - Místo názvů parametrů uveď jejich konkrétní hodnoty. Částky uváděj v CZK, a pokud je předpis uvádí v EUR, přidej EUR do závorky (např. 375 000 CZK (15 000 EUR)).
  - Externí seznam (např. vysoce rizikové jurisdikce) pojmenuj a jeho zdroj uveď stručně v závorce za názvem.
  - Výjimky a odlišné limity (např. pro vyšší riziko) uveď samostatnou větou.
  - Účel, priority, validaci, obsah alertu a postup zpracování alertu do definice nepiš.
- alertGranularity: kolik alertů pravidlo vytváří, např. „1 alert na transakci“ nebo „1 alert na klienta a měsíc“. Pokud to článek pravidla neuvádí, vezmi to z přehledové tabulky pravidel v předpisu.
- kind: "deterministic", pokud jde pravidlo spočítat nad daty. "agentic", pokud vyžaduje úsudek.
- parameters: parametry pravidla s hodnotou. Má-li parametr jinou hodnotu pro vyšší riziko, uveď ji jako samostatnou položku se stejným názvem a doplňkem „(vyšší riziko)“. source převezmi ze zdroje, který u parametru uvádí předpis: „regulace“ → "regulation", „kalibrace“ → "calibration", i když předpis zároveň zmiňuje související ustanovení. Když předpis zdroj neuvádí, použij "calibration".
- regulationSources: ustanovení regulací, která předpis uvádí jako právní základ pravidla, citaci regulace u pravidla nebo zdroj jeho parametru. Ustanovení zmíněná jen v obecných výčtech nebo jinde v předpisu nepřidávej. Používej zkrácené názvy: „AML zákon 253/2008“, „Vyhláška ČNB 67/2018“, „EBA/GL/2021/02“, „Nařízení (EU) 2023/1113“. Nic nedoplňuj z vlastní znalosti.
- internalPolicySource: označení předpisu a místa pravidla, např. „SVZ-06, Čl. 12“ nebo „SVZ-03, Příloha 1, R-01“.
- openQuestions: místa [ROZHODNUTÍ] u tohoto pravidla, pole, která pravidlo potřebuje a v datech chybí, a nejasnosti jeho logiky. Poznámky, které se týkají celého předpisu, nepřidávej. Jinak prázdný seznam.

Dostupná datová pole:
${AVAILABLE_DATA_FIELDS}

Příklad jedné položky výstupu:
${EXAMPLE_RULE}
`.trim();

export function createRuleExtractionUserPrompt(request: RuleExtractionRequest): string {
  const task =
    request.ruleId === null
      ? "Převeď všechna pravidla monitoringu z tohoto vnitřního předpisu."
      : `Převeď pouze pravidlo ${request.ruleId} z tohoto vnitřního předpisu.`;

  return [
    task,
    "",
    `<vnitrni_predpis nazev="${request.policy.title}">`,
    request.policy.body,
    "</vnitrni_predpis>",
  ].join("\n");
}
