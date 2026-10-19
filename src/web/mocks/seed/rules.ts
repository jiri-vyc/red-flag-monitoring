import type { RuleLegalBasis } from "@/features/regulations/types";
import type {
  RiskProfile,
  Rule,
  RuleConfig,
  RuleContent,
  RuleType,
  RuleVersion,
  RuleVersionState,
} from "@/features/rules/types";

import type { MockCheckKind } from "../evaluation/ruleChecks";

const REVIEWER = "Petr Svoboda";
const AUTHOR = "RedFlag AI (návrh)";
const ALL_PROFILES: RiskProfile[] = ["high", "medium", "low", "unknown"];

type SeedVersion = {
  content: RuleContent;
  state: RuleVersionState;
  changeNote: string;
  createdAt: string;
  /** Overrides the rule's default seed config for this version only. */
  configChanges?: Partial<RuleConfig>;
  /** Overrides the rule's default legal basis for this version only (M5). */
  legalBases?: RuleLegalBasis[];
};

type SeedRuleInput = Omit<
  Rule,
  "versions" | "createdAt" | "updatedAt" | "origin" | "type" | "whitelistAllowed"
> & {
  type: RuleType;
  /** Defaults to true. Regulatory-mandatory rules set false (M16). */
  whitelistAllowed?: boolean;
  /** Default config shared by every seed version unless a version overrides it. */
  config: RuleConfig;
  /** Default legal basis shared by every seed version unless a version overrides it. */
  legalBases: RuleLegalBasis[];
  versions: SeedVersion[];
  checkKind: MockCheckKind;
};

export type SeedRule = { rule: Rule; checkKind: MockCheckKind };

const REVIEWED_STATES: readonly RuleVersionState[] = ["approved", "superseded", "rejected"];

type SeedVersionDefaults = { config: RuleConfig; legalBases: RuleLegalBasis[] };

function buildSeedVersion(
  seedVersion: SeedVersion,
  versionIndex: number,
  { config, legalBases }: SeedVersionDefaults,
): RuleVersion {
  const isReviewed = REVIEWED_STATES.includes(seedVersion.state);
  return {
    versionNumber: versionIndex + 1,
    state: seedVersion.state,
    content: seedVersion.content,
    config: { ...config, ...seedVersion.configChanges },
    // Mock checks score each transaction differently, so seeded rules have no fixed base score.
    baseScore: null,
    changeNote: seedVersion.changeNote,
    createdAt: seedVersion.createdAt,
    createdBy: AUTHOR,
    reviewedBy: isReviewed ? REVIEWER : null,
    reviewedAt: isReviewed ? seedVersion.createdAt.replace("T09", "T15") : null,
    legalBases: seedVersion.legalBases ?? legalBases,
  };
}

function buildSeedRule({
  versions,
  checkKind,
  config,
  legalBases,
  whitelistAllowed = true,
  ...ruleFields
}: SeedRuleInput): SeedRule {
  const ruleVersions = versions.map((seedVersion, versionIndex) =>
    buildSeedVersion(seedVersion, versionIndex, { config, legalBases }),
  );
  const firstVersion = ruleVersions[0];
  const lastVersion = ruleVersions.at(-1);
  return {
    checkKind,
    rule: {
      ...ruleFields,
      origin: ruleFields.id.startsWith("rule-manual") ? "manual" : "wizard",
      versions: ruleVersions,
      whitelistAllowed,
      createdAt: firstVersion?.createdAt ?? "2026-09-01T09:00:00.000Z",
      updatedAt: lastVersion?.reviewedAt ?? lastVersion?.createdAt ?? "2026-09-01T09:00:00.000Z",
    },
  };
}

function deterministic(code: string, explanation: string): RuleContent {
  return { type: "deterministic", code, explanation };
}

function agentic(ruleText: string): RuleContent {
  return { type: "agentic", ruleText };
}

const HIGH_RISK_CODE_V1 = `export function evaluate({ transaction, client }) {
  const countries = [transaction.payerCountry, transaction.payeeCountry, client.country];
  const isHighRisk = countries.some((country) => HIGH_RISK_COUNTRIES.includes(country));
  return { score: isHighRisk ? 90 : 0, trace: [{ condition: "high-risk country", isMet: isHighRisk }] };
}`;

const HIGH_RISK_CODE_V2 = `export function evaluate({ transaction, client, config }) {
  const countries = [transaction.payerCountry, transaction.payeeCountry, client.country];
  const highRiskCountry = countries.find((country) => config.highRiskCountries.includes(country));
  const isAboveLimit = toCzk(transaction) > 10_000;
  const trace = [
    { condition: "Země na seznamu vysoce rizikových zemí", isMet: Boolean(highRiskCountry) },
    { condition: "Částka > 10 000 CZK", isMet: isAboveLimit },
  ];
  return { score: highRiskCountry && isAboveLimit ? 92 : 0, trace };
}`;

const PEP_CODE = `export function evaluate({ transaction, client }) {
  // Transakce s nejasným směrem se posuzuje jako odchozí (FINREG pravidlo B).
  const isOutgoing = transaction.type !== "incoming payment";
  const isAboveLimit = toCzk(transaction) > 100_000;
  const trace = [
    { condition: "Klient je PEP", isMet: client.isPep },
    { condition: "Odchozí nebo nejasný směr", isMet: isOutgoing },
    { condition: "Částka > 100 000 CZK", isMet: isAboveLimit },
  ];
  return { score: client.isPep && isOutgoing && isAboveLimit ? 96 : 0, trace };
}`;

const CLIENT_MAX_CODE_V1 = `export function evaluate({ transaction, client }) {
  const isAboveMax = toCzk(transaction) > client.maxTransactionQ2;
  return { score: isAboveMax ? 60 : 0, trace: [{ condition: "nad maximem Q2", isMet: isAboveMax }] };
}`;

const CLIENT_MAX_CODE_V2 = `export function evaluate({ transaction, client }) {
  const limit = client.maxTransactionQ2 * 2;
  const isAboveLimit = toCzk(transaction) > limit;
  return { score: isAboveLimit ? 72 : 0, trace: [{ condition: "Transakce > 2× maximum Q2 2026", isMet: isAboveLimit }] };
}`;

const CLIENT_MAX_CODE_V3 = `export function evaluate({ transaction, client }) {
  // Neaktivní klienti v Q2 se porovnávají jen s projektovaným objemem (FINREG pravidlo A).
  const reference = client.maxTransactionQ2 > 0 ? client.maxTransactionQ2 * 2 : client.expectedMonthlyVolume * 0.25;
  const isAboveLimit = toCzk(transaction) > reference;
  return { score: isAboveLimit ? 75 : 0, trace: [{ condition: "Transakce nad referenčním limitem klienta", isMet: isAboveLimit }] };
}`;

const LARGE_AMOUNT_CODE = `export function evaluate({ transaction }) {
  const amountCzk = toCzk(transaction);
  const isLarge = amountCzk > 500_000;
  const score = isLarge ? Math.min(100, 60 + (amountCzk / 500_000) * 10) : 0;
  return { score, trace: [{ condition: "Částka > 500 000 CZK", isMet: isLarge }] };
}`;

const REMITTANCE_CODE = `export function evaluate({ transaction, client }) {
  const trace = [
    { condition: "Typ transakce je remitence", isMet: transaction.type === "remittance" },
    { condition: "Klient má vysoký risk profil", isMet: client.riskProfile === "high" },
    { condition: "Příjemce je v zahraničí", isMet: transaction.payeeCountry !== "CZ" },
  ];
  return { score: trace.every((step) => step.isMet) ? 66 : 0, trace };
}`;

const NIGHT_CODE = `export function evaluate({ transaction }) {
  const hour = transaction.time.getHours();
  const trace = [
    { condition: "Čas mezi 00:00 a 05:00", isMet: hour < 5 },
    { condition: "Částka > 50 000 CZK", isMet: toCzk(transaction) > 50_000 },
  ];
  return { score: trace.every((step) => step.isMet) ? 48 : 0, trace };
}`;

const STRUCTURING_CODE = `export function evaluate({ transaction }) {
  const amountCzk = toCzk(transaction);
  const isJustBelow = amountCzk >= 340_000 && amountCzk < 375_000;
  return { score: isJustBelow ? 58 : 0, trace: [{ condition: "Těsně pod 15 000 EUR", isMet: isJustBelow }] };
}`;

const MISSING_PAYER_CODE = `export function evaluate({ transaction }) {
  const isMissingPayer = transaction.payerAccount.trim() === "";
  return { score: isMissingPayer ? 55 : 0, trace: [{ condition: "Chybí účet plátce", isMet: isMissingPayer }] };
}`;

const CASH_CODE = `export function evaluate({ transaction }) {
  const isCash = transaction.type === "cash deposit";
  return { score: isCash && toCzk(transaction) > 270_000 ? 70 : 0, trace: [{ condition: "Hotovost nad limit", isMet: isCash }] };
}`;

export const SEED_RULES: SeedRule[] = [
  buildSeedRule({
    id: "rule-high-risk-jurisdiction",
    whitelistAllowed: false,
    name: "Vysoce riziková jurisdikce nad 10 000 CZK",
    description: "Transakce nad 10 000 CZK, kde plátce, příjemce nebo klient je ze země na seznamu EU/FATF.",
    type: "deterministic",
    status: "active",
    config: { sensitivity: 90, riskProfiles: ALL_PROFILES },
    policyId: "pol-high-risk-countries",
    legalBases: [
      { regulationId: "reg-amld", ref: "čl. 18a odst. 1" },
      { regulationId: "reg-fatf", ref: "R.19" },
    ],
    runningVersionNumber: 2,
    checkKind: "high_risk_jurisdiction",
    versions: [
      {
        content: deterministic(
          HIGH_RISK_CODE_V1,
          "Pravidlo označí transakci, pokud se jí účastní vysoce riziková země.",
        ),
        state: "superseded",
        changeNote: "První verze z wizardu.",
        createdAt: "2026-09-05T09:00:00.000Z",
        legalBases: [{ regulationId: "reg-amld", ref: "čl. 18a" }],
      },
      {
        content: deterministic(
          HIGH_RISK_CODE_V2,
          "Pravidlo označí transakci vyšší než 10 000 CZK, pokud plátce, příjemce nebo klient pochází ze země na seznamu vysoce rizikových zemí EU nebo FATF. Seznam zemí je konfigurovatelný.",
        ),
        state: "approved",
        changeNote: "Doplněn limit 10 000 CZK podle FINREG pravidla B(a).",
        createdAt: "2026-09-20T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-pep-outgoing",
    whitelistAllowed: false,
    name: "PEP – odchozí platba nad 100 000 CZK",
    description: "Odchozí platba politicky exponované osoby nad 100 000 CZK.",
    type: "deterministic",
    status: "active",
    config: { sensitivity: 100, riskProfiles: ALL_PROFILES },
    policyId: "pol-pep",
    legalBases: [{ regulationId: "reg-amld", ref: "čl. 20 písm. b)" }],
    runningVersionNumber: 1,
    checkKind: "pep_outgoing",
    versions: [
      {
        content: deterministic(
          PEP_CODE,
          "Pravidlo označí platbu klienta, který je politicky exponovanou osobou, pokud je odchozí (nebo nemá jasný směr) a přesahuje 100 000 CZK.",
        ),
        state: "approved",
        changeNote: "První verze.",
        createdAt: "2026-08-25T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-client-max-exceeded",
    name: "Transakce nad 2× maximum klienta za Q2",
    description: "Jednorázová transakce vyšší než dvojnásobek maximální transakce klienta za Q2 2026.",
    type: "deterministic",
    status: "update_for_review",
    config: { sensitivity: 70, riskProfiles: ["high", "medium", "unknown"] },
    policyId: "pol-client-profile",
    legalBases: [{ regulationId: "reg-aml-act", ref: "§ 9 odst. 2 písm. d)" }],
    runningVersionNumber: 2,
    checkKind: "client_max_exceeded",
    versions: [
      {
        content: deterministic(
          CLIENT_MAX_CODE_V1,
          "Pravidlo označí transakci vyšší než maximum klienta za Q2.",
        ),
        state: "superseded",
        changeNote: "První verze.",
        createdAt: "2026-09-04T09:00:00.000Z",
      },
      {
        content: deterministic(
          CLIENT_MAX_CODE_V2,
          "Pravidlo označí jednorázovou transakci vyšší než dvojnásobek největší transakce klienta ve 2. čtvrtletí 2026.",
        ),
        state: "approved",
        changeNote: "Limit zvýšen na dvojnásobek podle FINREG pravidla A(c).",
        createdAt: "2026-09-18T09:00:00.000Z",
      },
      {
        content: deterministic(
          CLIENT_MAX_CODE_V3,
          "Pravidlo označí transakci vyšší než dvojnásobek největší transakce klienta ve 2. čtvrtletí 2026. Pokud klient v Q2 neměl žádné transakce, porovná se transakce se čtvrtinou projektovaného měsíčního objemu.",
        ),
        state: "pending_review",
        changeNote: "Ošetření klientů neaktivních v Q2 2026, citlivost zvýšena.",
        configChanges: { sensitivity: 75 },
        createdAt: "2026-10-17T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-large-amount",
    name: "Velká částka nad 500 000 CZK",
    description: "Každá transakce nad 500 000 CZK.",
    type: "deterministic",
    status: "active",
    config: { sensitivity: 80, riskProfiles: ALL_PROFILES },
    policyId: "pol-client-profile",
    legalBases: [{ regulationId: "reg-aml-act", ref: "§ 9 odst. 2 písm. d)" }],
    runningVersionNumber: 1,
    checkKind: "large_amount",
    versions: [
      {
        content: deterministic(
          LARGE_AMOUNT_CODE,
          "Pravidlo označí každou transakci vyšší než 500 000 CZK. Čím vyšší částka, tím vyšší skóre (maximálně 100).",
        ),
        state: "approved",
        changeNote: "První verze.",
        createdAt: "2026-09-06T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-high-risk-remittance",
    name: "Remitence klienta s vysokým rizikem",
    description: "Remitence do zahraničí u klienta s vysokým AML risk profilem.",
    type: "deterministic",
    status: "active",
    config: { sensitivity: 75, riskProfiles: ["high"] },
    policyId: "pol-risk-factors",
    legalBases: [{ regulationId: "reg-eba-gl-2021-02", ref: "obecný pokyn 2.9" }],
    runningVersionNumber: 1,
    checkKind: "high_risk_remittance",
    versions: [
      {
        content: deterministic(
          REMITTANCE_CODE,
          "Pravidlo označí remitenci do zahraničí, pokud má klient vysoký AML risk profil.",
        ),
        state: "approved",
        changeNote: "První verze.",
        createdAt: "2026-09-13T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-flow-through",
    name: "Průtokový účet (mule pattern)",
    description: "Příchozí prostředky nad 100 000 CZK odeslané do 6 hodin na jiný účet.",
    type: "agentic",
    status: "active",
    config: { sensitivity: 85, riskProfiles: ALL_PROFILES },
    policyId: "pol-suspicious-indicators",
    legalBases: [
      { regulationId: "reg-aml-act", ref: "§ 6 odst. 1 písm. b)" },
      { regulationId: "reg-fau-methodology-4", ref: "Indikátory podezřelého obchodu" },
    ],
    runningVersionNumber: 2,
    checkKind: "agentic_context",
    versions: [
      {
        content: agentic("Posuď, zda klient přijímá a rychle přeposílá prostředky."),
        state: "superseded",
        changeNote: "První verze.",
        createdAt: "2026-09-08T09:00:00.000Z",
      },
      {
        content: agentic(
          "Posuď, zda klient během 24 hodin přijal příchozí platby nad 100 000 CZK a do 6 hodin poté odeslal alespoň 80 % této částky na jiný účet, než ze kterého prostředky přišly. Zohledni risk profil, PEP status a historii klienta. Vrať skóre 0–100 a odůvodnění s odkazy na konkrétní transakce.",
        ),
        state: "approved",
        changeNote: "Upřesněna časová okna podle FINREG pravidla C.",
        createdAt: "2026-09-22T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-night-activity",
    name: "Noční aktivita s vysokými částkami",
    description: "Transakce nad 50 000 CZK mezi půlnocí a 5. hodinou ranní.",
    type: "deterministic",
    status: "inactive",
    config: { sensitivity: 50, riskProfiles: ["high", "medium"] },
    policyId: "pol-client-profile",
    legalBases: [{ regulationId: "reg-aml-act", ref: "§ 9 odst. 2 písm. d)" }],
    runningVersionNumber: 1,
    checkKind: "night_activity",
    versions: [
      {
        content: deterministic(
          NIGHT_CODE,
          "Pravidlo označí transakci nad 50 000 CZK provedenou mezi 00:00 a 05:00.",
        ),
        state: "approved",
        changeNote: "První verze. Vypnuto kvůli vysokému podílu falešně pozitivních.",
        createdAt: "2026-09-09T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-structuring",
    name: "Strukturování pod limitem 15 000 EUR",
    description: "Platby těsně pod hranicí 15 000 EUR.",
    type: "deterministic",
    status: "pending_for_review",
    config: { sensitivity: 65, riskProfiles: ALL_PROFILES },
    policyId: "pol-suspicious-indicators",
    legalBases: [{ regulationId: "reg-aml-act", ref: "§ 6 odst. 1 písm. b)" }],
    runningVersionNumber: null,
    checkKind: "threshold_structuring",
    versions: [
      {
        content: deterministic(
          STRUCTURING_CODE,
          "Pravidlo označí platbu, jejíž částka je těsně pod hranicí 15 000 EUR (340 000 až 375 000 CZK), což může znamenat úmyslné rozdělování plateb.",
        ),
        state: "pending_review",
        changeNote: "Návrh z wizardu.",
        createdAt: "2026-10-11T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-profile-anomaly-agent",
    name: "Neobvyklé chování vůči profilu (agent)",
    description: "Agent posoudí, zda transakce odpovídá typu a historii klienta.",
    type: "agentic",
    status: "pending_for_review",
    config: { sensitivity: 60, riskProfiles: ["high", "medium", "unknown"] },
    policyId: "pol-risk-factors",
    legalBases: [{ regulationId: "reg-eba-gl-2021-02", ref: "obecný pokyn 2.9" }],
    runningVersionNumber: null,
    checkKind: "agentic_context",
    versions: [
      {
        content: agentic(
          "Porovnej transakci s typem klienta (fyzická osoba, podnikatel, právnická osoba), jeho deklarovaným objemem a historií. Označ transakci, která neodpovídá obvyklému chování klienta, a uveď konkrétní důvody.",
        ),
        state: "pending_review",
        changeNote: "Návrh z wizardu.",
        createdAt: "2026-10-13T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-missing-payer",
    name: "Chybějící údaje o plátci",
    description: "Převod bez vyplněného účtu plátce.",
    type: "deterministic",
    status: "draft",
    config: { sensitivity: 70, riskProfiles: ALL_PROFILES },
    policyId: "pol-transfer-information",
    legalBases: [{ regulationId: "reg-tfr", ref: "čl. 4 odst. 1" }],
    runningVersionNumber: null,
    checkKind: "threshold_structuring",
    versions: [
      {
        content: deterministic(
          MISSING_PAYER_CODE,
          "Pravidlo označí převod, u kterého chybí číslo účtu plátce.",
        ),
        state: "draft",
        changeNote: "Rozpracováno.",
        createdAt: "2026-10-14T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-new-countries-agent",
    name: "Platby do nových zemí (agent)",
    description: "Agent posoudí platby do zemí, kam klient dosud neplatil.",
    type: "agentic",
    status: "draft",
    config: { sensitivity: 55, riskProfiles: ["high", "medium"] },
    policyId: "pol-ongoing-monitoring",
    legalBases: [{ regulationId: "reg-amlr", ref: "průběžný monitoring obchodního vztahu" }],
    runningVersionNumber: null,
    checkKind: "agentic_context",
    versions: [
      {
        content: agentic(
          "Zjisti, zda klient posílá prostředky do země, kam v posledních 6 měsících neplatil. Zohledni typ klienta a účel vztahu. Vrať skóre a odůvodnění.",
        ),
        state: "draft",
        changeNote: "Rozpracováno.",
        createdAt: "2026-10-16T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-pep-incoming-agent",
    whitelistAllowed: false,
    name: "PEP – příchozí platby ze zahraničí (agent)",
    description: "Agent posoudí původ prostředků u příchozích plateb PEP ze zahraničí.",
    type: "agentic",
    status: "update_for_review",
    config: { sensitivity: 80, riskProfiles: ALL_PROFILES },
    policyId: "pol-pep",
    legalBases: [{ regulationId: "reg-amld", ref: "čl. 20" }],
    runningVersionNumber: 1,
    checkKind: "agentic_context",
    versions: [
      {
        content: agentic(
          "U klienta, který je PEP, posuď příchozí platby ze zahraničí. Zohledni zemi plátce a obvyklé objemy klienta.",
        ),
        state: "approved",
        changeNote: "První verze.",
        createdAt: "2026-09-01T09:00:00.000Z",
      },
      {
        content: agentic(
          "U klienta, který je PEP, posuď příchozí platby ze zahraničí nad 50 000 CZK. Zohledni zemi plátce, obvyklé objemy klienta a zda je plátce známou protistranou. Vyžaduj doložení původu prostředků u plateb z vysoce rizikových zemí.",
        ),
        state: "pending_review",
        changeNote: "Doplněn limit a požadavek na původ prostředků, citlivost zvýšena.",
        configChanges: { sensitivity: 90 },
        createdAt: "2026-10-18T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-manual-cash-deposit",
    name: "Hotovostní vklady nad limit",
    description: "Hotovostní vklad nad 270 000 CZK.",
    type: "deterministic",
    status: "inactive",
    config: { sensitivity: 60, riskProfiles: ALL_PROFILES },
    // M4: a manual rule may stand without a policy.
    policyId: null,
    legalBases: [{ regulationId: "reg-aml-act", ref: "§ 18" }],
    runningVersionNumber: null,
    checkKind: "large_amount",
    versions: [
      {
        content: deterministic(CASH_CODE, "Pravidlo označí hotovostní vklad vyšší než 270 000 CZK."),
        state: "rejected",
        changeNote: "Zamítnuto: dataset neobsahuje hotovostní transakce.",
        createdAt: "2026-09-15T09:00:00.000Z",
      },
    ],
  }),
  buildSeedRule({
    id: "rule-manual-repeated-alerts",
    name: "Opakované alerty klienta (agent)",
    description: "Agent posoudí klienta s více podezřelými transakcemi v krátkém období.",
    type: "agentic",
    status: "active",
    config: { sensitivity: 70, riskProfiles: ["high", "medium"] },
    policyId: "pol-internal-escalation",
    legalBases: [{ regulationId: "reg-aml-act", ref: "§ 18 odst. 1" }],
    runningVersionNumber: 1,
    checkKind: "agentic_context",
    versions: [
      {
        content: agentic(
          "Pokud má klient během 7 dnů více než dvě transakce s vyšším skóre, posuď celkový obraz klienta a navrhni eskalaci vedoucímu AML. Uveď transakce, o které se závěr opírá.",
        ),
        state: "approved",
        changeNote: "První verze.",
        createdAt: "2026-09-16T09:00:00.000Z",
      },
    ],
  }),
];
