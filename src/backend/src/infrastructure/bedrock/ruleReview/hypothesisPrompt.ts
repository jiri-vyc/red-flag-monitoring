import { z } from "zod";

import { describeFeatureCatalog, type FeatureDescription } from "../../../domain/features/featureCatalog";
import { flatRuleDefinitionSchema } from "../flatRuleDefinition";
import type { BacktestCaps, LlmBudget } from "../../../domain/ruleReview/ruleReviewParams";
import { formatPercent } from "./hypothesisScreening";
import type { ModelTool } from "./modelCall";
import { NO_INPUT_SCHEMA, toToolInputSchema } from "./toolSchema";

export const HYPOTHESIS_TOOL_NAMES = {
  getRuleCatalogue: "get_rule_catalogue",
  getFeatureCatalogue: "get_feature_catalogue",
  getCoverageMatrix: "get_coverage_matrix",
  getGapFindings: "get_gap_findings",
  getSegmentProfiles: "get_segment_profiles",
  getCounterpartyStructure: "get_counterparty_structure",
  backtestRule: "backtest_rule",
  proposeHypothesis: "propose_hypothesis",
  reportCoverageGap: "report_coverage_gap",
  addCritique: "add_critique",
} as const;

export const backtestRuleInputSchema = z.strictObject({ definition: flatRuleDefinitionSchema });

export const proposeHypothesisInputSchema = z.strictObject({
  descriptionCs: z.string().min(1),
  rationale: z.string().min(1),
  indicator: z.string().min(1),
  suggestedLegalBasis: z.string().min(1),
  definition: flatRuleDefinitionSchema,
});

export const reportCoverageGapInputSchema = z.strictObject({
  descriptionCs: z.string().min(1),
  rationale: z.string().min(1),
  indicator: z.string().min(1),
  missingFeature: z.string().min(1),
});

export const addCritiqueInputSchema = z.strictObject({ findingId: z.string(), comment: z.string().min(1) });

export const HYPOTHESIS_TOOLS: ModelTool[] = [
  {
    name: HYPOTHESIS_TOOL_NAMES.getRuleCatalogue,
    description: "Aktivní pravidla: kód, název, česká definice, právní základy a parametry.",
    input_schema: NO_INPUT_SCHEMA,
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.getFeatureCatalogue,
    description: "Katalog features, které smí DSL používat (totéž co v systémovém promptu).",
    input_schema: NO_INPUT_SCHEMA,
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.getCoverageMatrix,
    description:
      "Indikátory SVZ-03 čl. 7 (Z1–Z12) a pravidla, která je pokrývají. Prázdný seznam pravidel = nepokrytý indikátor.",
    input_schema: NO_INPUT_SCHEMA,
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.getGapFindings,
    description:
      "Deterministické nálezy tohoto přezkumu bez seznamů klientů (id, druh, pravidlo, návrh, růst, důkazy).",
    input_schema: NO_INPUT_SCHEMA,
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.getSegmentProfiles,
    description:
      "Agregované profily skupin klientů (typ klienta × rizikové skóre): rozdělení a extrémy, žádné řádky.",
    input_schema: NO_INPUT_SCHEMA,
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.getCounterpartyStructure,
    description: "Agregáty sítě protistran: stupně účtů, vazby přes soukromé účty, toky přes prostředníky.",
    input_schema: NO_INPUT_SCHEMA,
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.backtestRule,
    description:
      "Ověří pravidlo v DSL nad celým datasetem: chyby validace, nebo počet zásahů a klientů, překryv s aktivními pravidly, rozdělení podle rizika a typu klienta a nejvýše 10 ukázkových ID klientů. Nic neukládá.",
    input_schema: toToolInputSchema(backtestRuleInputSchema),
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.proposeHypothesis,
    description:
      "Předloží hypotézu nového pravidla. Kód ji sám backtestuje a zahodí, pokud neprojde validací DSL, nezasáhne žádného klienta, zasáhne víc než povolený podíl klientů nebo se příliš překrývá s aktivním pravidlem. Vrátí, zda byla přijata.",
    input_schema: toToolInputSchema(proposeHypothesisInputSchema),
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.reportCoverageGap,
    description:
      "Zaznamená mezeru v pokrytí: hypotézu, kterou katalog features neumí vyjádřit, s chybějící feature.",
    input_schema: toToolInputSchema(reportCoverageGapInputSchema),
  },
  {
    name: HYPOTHESIS_TOOL_NAMES.addCritique,
    description:
      "Připojí komentář k deterministickému nálezu (např. pravděpodobný kalendářní artefakt). Nález nemění.",
    input_schema: toToolInputSchema(addCritiqueInputSchema),
  },
];

export function createHypothesisSystemPrompt(budget: LlmBudget, backtestCaps: BacktestCaps): string {
  return `
Jsi specialista na AML compliance a transakční monitoring v české platební instituci.
Doplňuješ deterministický přezkum pravidel monitoringu (SVZ-03 čl. 11.5): hledáš chování, které žádné aktivní pravidlo nepokrývá, a navrhuješ nová pravidla v DSL.
Nic nerozhoduješ. Každá hypotéza je návrh, o kterém rozhodne AML compliance officer. Klienti z backtestu nejsou alerty.

Data máš jen přes nástroje a jen jako agregáty. Neodhaduj čísla, která ti nástroj nevrátil.

Postup:
1. V prvním kroku zavolej najednou ${HYPOTHESIS_TOOL_NAMES.getRuleCatalogue}, ${HYPOTHESIS_TOOL_NAMES.getCoverageMatrix}, ${HYPOTHESIS_TOOL_NAMES.getGapFindings}, ${HYPOTHESIS_TOOL_NAMES.getSegmentProfiles} a ${HYPOTHESIS_TOOL_NAMES.getCounterpartyStructure}. Katalog features máš níže, ${HYPOTHESIS_TOOL_NAMES.getFeatureCatalogue} nevolej.
2. Najdi nepokryté indikátory a chování, které agregáty ukazují a pravidla nezachytí.
3. Hypotézu předlož nástrojem ${HYPOTHESIS_TOOL_NAMES.proposeHypothesis}; ten ji sám backtestuje. ${HYPOTHESIS_TOOL_NAMES.backtestRule} použij jen tehdy, když chceš variantu porovnat před předložením.
   Kód hypotézu zahodí, pokud neprojde validací DSL, nezasáhne žádného klienta, zasáhne víc než ${formatPercent(backtestCaps.maxClientShare)} klientů nebo má s některým aktivním pravidlem překryv ${formatPercent(backtestCaps.maxOverlapWithExistingRule)} a víc (podíl jejích klientů, které pravidlo už zasahuje). Po zamítnutí můžeš předložit upravenou verzi.
4. Když hypotézu katalog features vyjádřit neumí, zaznamenej ji nástrojem ${HYPOTHESIS_TOOL_NAMES.reportCoverageGap}.
5. Když je deterministický nález podle agregátů pravděpodobně artefakt (kalendář, malý základ, jeden klient), napiš k němu komentář nástrojem ${HYPOTHESIS_TOOL_NAMES.addCritique}. Komentář nález nemění.
6. Skonči krátkým českým shrnutím v textu, bez volání nástroje.

Rozpočet hlídá kód a po vyčerpání tě zastaví: nejvýše ${budget.maxToolCalls} volání nástrojů celkem, nejvýše ${budget.maxHypotheses} přijatých hypotéz. Šetři voláními.

Pole hypotézy:
- descriptionCs: česká definice pro právníka, začni „Alert, pokud …“, uveď konkrétní hodnoty.
- rationale: proč toto chování pravidla nepokrývají a co v agregátech na něj ukazuje.
- indicator: indikátor SVZ-03 čl. 7 (Z1–Z12) nebo FAÚ/FATF, který pravidlo pokrývá.
- suggestedLegalBasis: navržený právní základ jako text „<kód regulace> <ustanovení>“, např. „AMLZ § 6 odst. 1 písm. g)“; kód regulace ber z právních základů v katalogu pravidel. Je to návrh k posouzení právníkem.

DSL (definition):
- match: "all" (všechny podmínky) nebo "any" (aspoň jedna). features: všechna feature ID, která podmínky používají.
- groups: skupiny {id, label, parentGroupId, match}. conditions: podmínky {id, label, parentGroupId, left, op, right}.
- parentGroupId je id nadřazené skupiny, nebo "root" pro nejvyšší úroveň. Každá skupina má aspoň jeden uzel. Všechna id jsou unikátní.
- Operand je {kind, value}, value je vždy text:
  - kind "feature": feature ID z katalogu;
  - kind "expr": "<číslo> × <feature ID>", např. "2 × client_q2_max_tx_czk";
  - kind "list": kód referenčního seznamu (HRJ = vysoce rizikové jurisdikce, EEA = země EHP);
  - kind "number": číslo bez mezer s desetinnou tečkou, např. "187500" nebo "0.8";
  - kind "text": textová hodnota, např. "high";
  - kind "boolean": "true" nebo "false".
- op: >, >=, <, <=, =, !=, in, not_in. in a not_in mají vpravo vždy kind "list" a jen ony.
- Klienta s vyšším rizikem vyjádři skupinou s match "any": client_risk_score = "high" (kind "text") nebo client_is_pep = "true" (kind "boolean").
- Pravidlo se vyhodnocuje pro každou transakci zvlášť nad historií klienta bez pohledu do budoucna. Částky jsou v CZK.

Katalog features (id | typ | jednotka | může chybět | popis):
${formatFeatureCatalog(describeFeatureCatalog())}
`.trim();
}

export const HYPOTHESIS_USER_PROMPT =
  "Prověř pokrytí pravidel tohoto přezkumu a navrhni nová pravidla podle postupu. Začni voláním informačních nástrojů.";

function formatFeatureCatalog(features: FeatureDescription[]): string {
  return features
    .map(
      ({ id, valueType, unit, isNullable, label, description }) =>
        `- ${id} | ${valueType} | ${unit ?? "-"} | ${isNullable ? "ano" : "ne"} | ${label}: ${description}`,
    )
    .join("\n");
}
