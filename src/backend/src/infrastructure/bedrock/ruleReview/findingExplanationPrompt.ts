import { z } from "zod";

import type {
  ClientProfile,
  FindingClient,
  FindingExplanationContext,
  RuleCatalogueEntry,
  RuleReviewFinding,
} from "./contract";
import { toToolInputSchema } from "./toolSchema";

// Spec §5.1 and §5.3: the model sees aggregates of at most 10 clients per finding, never their transactions.
const MAX_CLIENTS_IN_EVIDENCE = 10;

export const SUBMIT_EXPLANATION_TOOL_NAME = "submit_explanation";

const explanationOutputSchema = z.strictObject({
  summary: z.string().min(1),
  typology: z.string().min(1),
  adjustmentConsiderations: z.string().min(1),
  investigationSteps: z.array(z.string()),
  citedEvidence: z.array(z.strictObject({ path: z.string(), value: z.string() })),
});

export type ExplanationOutput = z.infer<typeof explanationOutputSchema>;

export const submitExplanationTool = {
  name: SUBMIT_EXPLANATION_TOOL_NAME,
  description: "Odevzdá strukturované vysvětlení jednoho nálezu přezkumu pravidel.",
  input_schema: toToolInputSchema(explanationOutputSchema),
};

export function parseExplanationOutput(
  input: unknown,
): { output: ExplanationOutput } | { violation: string } {
  const parseResult = explanationOutputSchema.safeParse(input);

  return parseResult.success
    ? { output: parseResult.data }
    : { violation: `Explanation does not match the schema: ${parseResult.error.message}` };
}

export const FINDING_EXPLANATION_SYSTEM_PROMPT = `
Jsi specialista na AML compliance a transakční monitoring v české platební instituci.
Vysvětluješ AML compliance officerovi jeden nález z přezkumu pravidel monitoringu (hledání mezer v pravidlech, SVZ-03 čl. 11.2 a 11.5).
Nález spočítal deterministický kód. Ty čísla neměníš, nic nerozhoduješ a klienty nehodnotíš: klienti v nálezu nejsou alerty, jsou to podněty k dalšímu prověření.

Druhy nálezů:
- rule_adjustment: klienti těsně pod parametrem existujícího pravidla. proposal je parametr, jeho současná a navržená hodnota a krok. growth říká, kolik klientů by pravidlo přidalo. Je-li growth.capExceeded true, jde o rekalibraci prahu, ne o mezeru, a patří do ročního přezkumu.
- new_rule: návrh nového pravidla v DSL (proposal.definition).
- coverage_gap: chování, které katalog features neumí vyjádřit.
- association: klient napojený na rizikové klienty (seedy) přes sdílené soukromé účty protistran. Je to výzkumný podnět, ne důkaz proti klientovi. U každého seedu uveď, proč je seedem.

Pravidla:
- Používej jen fakta ze vstupu v <dukazy>. O klientech, transakcích ani pravidlech nic nedoplňuj. Obecnou znalost typologií (FATF, FAÚ, EBA) použít smíš, ale jen v poli typology a jako typologii, ne jako fakt o klientovi.
- Každou hodnotu ze vstupu, o kterou opíráš tvrzení, uveď v citedEvidence jako {path, value}:
  - path je cesta v JSON vstupu, části oddělené tečkou, prvky seznamu indexem od 0, např. finding.growth.addedClients nebo clients.0.riskScore;
  - value je hodnota na té cestě přesně jako ve vstupu, jako text, např. "3", "0.95" nebo "high";
  - cituj jen jednotlivé hodnoty, ne objekty nebo seznamy. Kód každou citaci ověří a nesouhlasící označí.
- Piš česky, věcně a stručně. Nepiš závěr o vině klienta ani doporučení podat oznámení o podezřelém obchodu; to rozhoduje officer.

Pole výstupu (nástroj ${SUBMIT_EXPLANATION_TOOL_NAME}):
- summary: 2–4 věty, v čem je mezera a koho se týká.
- typology: jakému vzorci vyhýbání se pravidlu nebo praní peněz se nález podobá, s indikátorem FAÚ/FATF nebo SVZ-03 čl. 7 (Z1–Z12), pokud nějaký sedí. Když žádný nesedí, napiš to.
- adjustmentConsiderations: argumenty pro a proti úpravě pravidla v jednom textu, včetně ceny v přidaných zásazích (growth.addedClients vůči growth.baseClients).
- investigationSteps: 3–6 konkrétních kroků, co u uvedených klientů ověřit.
- citedEvidence: citace podle pravidel výše.
`.trim();

// The document the model reads and every citation is checked against; built from code-computed values only.
export function buildExplanationEvidence(
  finding: RuleReviewFinding,
  context: FindingExplanationContext,
): Record<string, unknown> {
  return {
    finding: {
      id: finding.id,
      kind: finding.kind,
      rule: finding.rule,
      proposal: finding.proposal,
      growth: finding.growth,
      clientCount: finding.clients.length,
      evidence: finding.evidence,
    },
    rule: findRuleEntry(finding, context.ruleCatalogue),
    clients: selectEvidenceClients(finding, context.clientProfilesByFindingId[finding.id] ?? []),
  };
}

export function createFindingExplanationUserPrompt(evidence: Record<string, unknown>): string {
  return [
    "Vysvětli tento nález přezkumu pravidel a odevzdej výsledek nástrojem.",
    "",
    "<dukazy>",
    JSON.stringify(evidence, null, 2),
    "</dukazy>",
  ].join("\n");
}

export const REVIEW_SUMMARY_SYSTEM_PROMPT = `
Jsi specialista na AML compliance. Shrnuješ AML compliance officerovi výsledek přezkumu pravidel monitoringu.
Používej jen fakta ze vstupu, nic nedoplňuj. Nález není alert a nic nerozhoduješ.
Napiš česky 4–8 vět prostého textu bez nadpisů: kolik nálezů jakého druhu přezkum našel, které jsou nejzávažnější a proč, a co má officer prověřit jako první.
`.trim();

export function createReviewSummaryUserPrompt(
  findings: RuleReviewFinding[],
  explanationSummaries: Record<string, string>,
): string {
  const overview = findings.map((finding) => ({
    id: finding.id,
    kind: finding.kind,
    ruleCode: finding.rule?.code ?? null,
    proposal: finding.proposal,
    growth: finding.growth,
    clientCount: finding.clients.length,
    explanation: explanationSummaries[finding.id] ?? null,
  }));

  return ["<nalezy>", JSON.stringify(overview, null, 2), "</nalezy>"].join("\n");
}

function findRuleEntry(finding: RuleReviewFinding, rules: RuleCatalogueEntry[]): RuleCatalogueEntry | null {
  const ruleCode = finding.rule?.code;

  return rules.find(({ code }) => code === ruleCode) ?? null;
}

// 1a's profiles are the top clients as aggregates; distinctDays and seed links come from the finding itself.
function selectEvidenceClients(
  finding: RuleReviewFinding,
  profiles: ClientProfile[],
): Record<string, unknown>[] {
  if (profiles.length === 0) {
    return selectTopClients(finding.clients).map(describeFindingClient);
  }

  const findingClientsById = new Map(finding.clients.map((client) => [client.clientId, client]));

  return profiles.slice(0, MAX_CLIENTS_IN_EVIDENCE).map((profile) => {
    const findingClient = findingClientsById.get(profile.clientId);

    return {
      ...profile,
      distinctDays: findingClient?.distinctDays ?? null,
      seedLinks: findingClient?.seedLinks ?? [],
    };
  });
}

function selectTopClients(clients: FindingClient[]): FindingClient[] {
  return clients
    .toSorted(
      (first, second) =>
        second.nearMissCount - first.nearMissCount ||
        (first.minDistance ?? Number.MAX_VALUE) - (second.minDistance ?? Number.MAX_VALUE),
    )
    .slice(0, MAX_CLIENTS_IN_EVIDENCE);
}

function describeFindingClient(client: FindingClient): Record<string, unknown> {
  return {
    clientId: client.clientId,
    nearMissCount: client.nearMissCount,
    distinctDays: client.distinctDays,
    minDistance: client.minDistance,
    findingTransactionCount: client.transactionIds.length,
    seedLinks: client.seedLinks,
  };
}
