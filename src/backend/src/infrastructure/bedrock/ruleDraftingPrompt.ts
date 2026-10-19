import { describeFeatureCatalog, type FeatureDescription } from "../../domain/features/featureCatalog";

export type RuleDraftingRequest = {
  policy: { code: string; title: string; body: string };
  // Regulations the policy is based on; rules cite them by code.
  regulations: { code: string; title: string }[];
  referenceLists: { code: string; title: string }[];
};

// Sample rule R-02 (SeedSampleRules migration) in the output schema, so the model sees a group and a list.
const EXAMPLE_RULE = JSON.stringify(
  {
    code: "R-02",
    title: "Vysoce riziková jurisdikce",
    alertType: "high_risk_jurisdiction",
    kind: "deterministic",
    isWhitelistAllowed: false,
    humanText:
      "Alert pro každou transakci s částkou > 10 000 CZK, kde země plátce, země příjemce nebo země klienta je na seznamu vysoce rizikových jurisdikcí (HRJ: příloha nařízení (EU) 2016/1675 a seznamy FATF).",
    definition: {
      match: "all",
      features: ["tx_amount_czk", "tx_payer_country", "tx_payee_country", "client_country"],
      conditions: [
        {
          id: "a",
          label: "Částka > 10 000 CZK",
          left: { feature: "tx_amount_czk" },
          op: ">",
          right: { value: 10000 },
        },
        {
          id: "b",
          label: "Plátce, příjemce nebo klient z HRJ",
          match: "any",
          conditions: [
            {
              id: "b1",
              label: "Země plátce je v HRJ",
              left: { feature: "tx_payer_country" },
              op: "in",
              right: { list: "HRJ" },
            },
            {
              id: "b2",
              label: "Země příjemce je v HRJ",
              left: { feature: "tx_payee_country" },
              op: "in",
              right: { list: "HRJ" },
            },
            {
              id: "b3",
              label: "Země klienta je v HRJ",
              left: { feature: "client_country" },
              op: "in",
              right: { list: "HRJ" },
            },
          ],
        },
      ],
    },
    agentPrompt: null,
    priorityBase: 60,
    parameters: [{ name: "P_B1", value: "10 000 CZK", source: "calibration" }],
    legalBases: [
      { regulationCode: "VYHL67", ref: "§ 9 odst. 3 písm. a) a odst. 4 písm. a)" },
      { regulationCode: "AMLZ", ref: "§ 6 odst. 1 písm. h)" },
    ],
    openQuestions: [],
  },
  null,
  2,
);

export const RULE_DRAFTING_SYSTEM_PROMPT = `
Jsi specialista na AML compliance a transakční monitoring v české finanční instituci.
Z vnitřního předpisu instituce (součást systému vnitřních zásad, SVZ) převádíš pravidla monitoringu na pravidla, která spustí vyhodnocovací engine.
Výstup je návrh k posouzení AML compliance officerem a právníkem, ne schválené pravidlo.

Postup:
- Každé pravidlo monitoringu, které předpis definuje (má vlastní ID, např. R-18), převeď na jednu položku. Nevymýšlej pravidla, která předpis nedefinuje.
- Pravidlo ber z místa, kde je v předpisu jeho logika a parametry (článek pravidla nebo příloha). Společná pravidla výpočtu z obecné části předpisu (směr transakce, přepočet měn, okna, vyšší riziko) promítni do podmínek.

Pole:
- code, title: ID a název pravidla přesně podle předpisu.
- alertType: krátký anglický identifikátor typu alertu ve snake_case, např. high_risk_jurisdiction.
- kind: "deterministic", pokud jde pravidlo vyjádřit podmínkami nad featurami z katalogu. Jinak "agentic".
- isWhitelistAllowed: false jen tehdy, když předpis nebo regulace pravidlo výslovně vyžaduje pro všechny klienty bez výjimky. Jinak true.
- humanText: krátká česká definice pro právníka.
  - Začni „Alert, pokud …“ nebo „Alert pro každou transakci …“. Vícekrokovou logiku napiš jako číslovaný seznam, alternativní podmínky jako (a), (b), (c).
  - Uveď konkrétní hodnoty, ne názvy parametrů. Částky v CZK, a pokud je předpis uvádí v EUR, přidej EUR do závorky.
  - Odlišné limity (např. pro vyšší riziko) a výjimky uveď samostatnou větou.
  - Účel, priority, validaci a postup zpracování alertu nepiš.
- definition: u "deterministic" podmínky v DSL, u "agentic" null.
  - match: "all" (všechny podmínky) nebo "any" (aspoň jedna).
  - features: seznam všech feature ID, které podmínky používají.
  - conditions: podmínka {id, label, left, op, right}, nebo skupina {id, label, match, conditions} s podmínkami uvnitř. Skupiny lze vnořit nejvýš do tří úrovní.
  - Operand je jeden z: {"feature": "<feature ID>"}, {"expr": "<číslo> × <feature ID>"}, {"list": "<kód referenčního seznamu>"}, {"value": číslo | text | true/false}.
  - op: >, >=, <, <=, =, !=, in, not_in. Operátory in a not_in mají vpravo vždy {"list": …} a jen ony.
  - Klienta s vyšším rizikem vyjádři skupinou s match "any": \`client_risk_score\` = "high" nebo \`client_is_pep\` = true.
  - Používej jen feature ID z katalogu níže a jen kódy referenčních seznamů ze zadání. Částky jsou v CZK.
  - Pokud pravidlo katalogem features vyjádřit nejde, použij kind "agentic" a do openQuestions napiš, jaká feature chybí.
- agentPrompt: u "agentic" česká instrukce pro hodnoticího agenta: co v transakci a historii klienta posoudit a kdy jde o zásah. U "deterministic" null.
- priorityBase: „Priorita (základ)“ pravidla z předpisu, 0–100. Pokud ji předpis neuvádí, použij 30 a napiš to do openQuestions.
- parameters: parametry s hodnotou. source "regulation" jen tehdy, když jej předpis u parametru uvádí jako „regulace“. Jinak "calibration".
- legalBases: ustanovení regulací, která předpis uvádí u pravidla jako právní základ, citaci regulace nebo zdroj parametru. regulationCode je kód ze seznamu regulací v zadání. Nic nedoplňuj z vlastní znalosti.
- openQuestions: místa [ROZHODNUTÍ] u pravidla, chybějící data nebo features a nejasnosti jeho logiky. Jinak prázdný seznam.

Katalog features (id | typ | jednotka | může chybět | popis):
${formatFeatureCatalog(describeFeatureCatalog())}

Příklad jedné položky výstupu:
${EXAMPLE_RULE}
`.trim();

export function createRuleDraftingUserPrompt(request: RuleDraftingRequest): string {
  return [
    "Převeď všechna pravidla monitoringu z tohoto vnitřního předpisu.",
    "",
    "Regulace (kód: název):",
    ...request.regulations.map(({ code, title }) => `- ${code}: ${title}`),
    "",
    "Referenční seznamy (kód: název):",
    ...request.referenceLists.map(({ code, title }) => `- ${code}: ${title}`),
    "",
    `<vnitrni_predpis kod="${request.policy.code}" nazev="${request.policy.title}">`,
    request.policy.body,
    "</vnitrni_predpis>",
  ].join("\n");
}

function formatFeatureCatalog(features: FeatureDescription[]): string {
  return features
    .map(
      ({ id, valueType, unit, isNullable, label, description }) =>
        `- ${id} | ${valueType} | ${unit ?? "-"} | ${isNullable ? "ano" : "ne"} | ${label}: ${description}`,
    )
    .join("\n");
}
