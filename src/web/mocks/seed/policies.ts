import type { PolicyVersion } from "@/features/policies/types";

import type { MockPolicyRecord } from "../store/mockDatabase";

const APPROVER = "Petr Svoboda";
const WIZARD_AUTHOR = "Jana Nováková";
const MANUAL_AUTHOR = "Eva Dvořáková";

type SeedPolicyRecord = Omit<MockPolicyRecord, "versions">;

/** Versions before the current one, with the time the current one was created. Policies not listed have one version. */
type SeedPolicyHistory = { previousVersions: PolicyVersion[]; currentVersionCreatedAt: string };

const HIGH_RISK_COUNTRIES_V1_TEXT =
  "1. Instituce sleduje každou transakci, kde plátce, příjemce nebo klient pochází ze země na seznamu vysoce rizikových třetích zemí EU nebo FATF.\n2. Transakce s takovou zemí se předává k posouzení AML analytikovi.";
const PEP_V1_TEXT =
  "1. U klientů, kteří jsou politicky exponovanými osobami, instituce uplatňuje zesílenou kontrolu.\n2. Odchozí platby PEP nad 100 000 CZK se posuzují jednotlivě.";

const SEED_POLICY_HISTORIES: Record<string, SeedPolicyHistory> = {
  "pol-high-risk-countries": {
    previousVersions: [
      {
        versionNumber: 1,
        state: "rejected",
        createdVia: "wizard",
        text: HIGH_RISK_COUNTRIES_V1_TEXT,
        legalBases: [{ regulationId: "reg-amld", ref: "čl. 18a" }],
        createdBy: WIZARD_AUTHOR,
        createdAt: "2026-09-02T09:00:00.000Z",
        reviewedBy: APPROVER,
        reviewedAt: "2026-09-03T10:00:00.000Z",
        reviewComment: "Chybí částkový práh pro předání analytikovi a frekvence aktualizace seznamu zemí.",
      },
    ],
    currentVersionCreatedAt: "2026-09-03T14:00:00.000Z",
  },
  "pol-pep": {
    previousVersions: [
      {
        versionNumber: 1,
        state: "superseded",
        createdVia: "manual",
        text: PEP_V1_TEXT,
        legalBases: [{ regulationId: "reg-amld", ref: "čl. 20" }],
        createdBy: MANUAL_AUTHOR,
        createdAt: "2026-08-20T10:00:00.000Z",
        reviewedBy: APPROVER,
        reviewedAt: "2026-08-20T16:00:00.000Z",
        reviewComment: null,
      },
    ],
    currentVersionCreatedAt: "2026-08-21T09:00:00.000Z",
  },
};

/** The current version matches the record's status, text and legal bases, so the history agrees with the list. */
function withVersionHistory(record: SeedPolicyRecord): MockPolicyRecord {
  const history = SEED_POLICY_HISTORIES[record.id];
  const previousVersions = history?.previousVersions ?? [];
  const isFirstVersion = previousVersions.length === 0;
  const createdVia = isFirstVersion && record.origin === "generated" ? "wizard" : "manual";
  const currentVersion: PolicyVersion = {
    versionNumber: previousVersions.length + 1,
    state: record.status === "approved" ? "approved" : "draft",
    createdVia,
    text: record.text,
    legalBases: record.legalBases,
    createdBy: record.origin === "generated" ? WIZARD_AUTHOR : MANUAL_AUTHOR,
    createdAt: history?.currentVersionCreatedAt ?? record.createdAt,
    reviewedBy: record.approvedBy,
    reviewedAt: record.approvedAt,
    reviewComment: null,
  };
  return { ...record, versions: [...previousVersions, currentVersion] };
}

// Provision references are illustrative demo values and must be verified by compliance before real use.
const SEED_POLICY_RECORDS: SeedPolicyRecord[] = [
  {
    id: "pol-high-risk-countries",
    name: "Transakce s vysoce rizikovými zeměmi",
    legalBases: [
      { regulationId: "reg-amld", ref: "čl. 18a" },
      { regulationId: "reg-fatf", ref: null },
    ],
    status: "approved",
    origin: "generated",
    text: "1. Instituce sleduje každou transakci, kde plátce, příjemce nebo klient pochází ze země na seznamu vysoce rizikových třetích zemí EU nebo FATF.\n2. Transakce nad 10 000 CZK s takovou zemí se vždy předává k posouzení AML analytikovi.\n3. Seznam zemí se aktualizuje nejméně jednou měsíčně.",
    createdAt: "2026-09-02T09:00:00.000Z",
    updatedAt: "2026-09-04T13:20:00.000Z",
    approvedBy: APPROVER,
    approvedAt: "2026-09-04T13:20:00.000Z",
  },
  {
    id: "pol-pep",
    name: "Politicky exponované osoby",
    legalBases: [
      { regulationId: "reg-amld", ref: "čl. 20" },
      { regulationId: "reg-aml-act", ref: "§ 9a" },
    ],
    status: "approved",
    origin: "manual",
    text: "1. U klientů, kteří jsou politicky exponovanými osobami, instituce uplatňuje zesílenou kontrolu.\n2. Odchozí platby PEP nad 100 000 CZK se posuzují jednotlivě. Platba s nejasným směrem se posuzuje jako odchozí.\n3. Příchozí platby ze zahraničí se posuzují s ohledem na původ prostředků.",
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-22T08:45:00.000Z",
    approvedBy: APPROVER,
    approvedAt: "2026-08-22T08:45:00.000Z",
  },
  {
    id: "pol-client-profile",
    name: "Odchylky od profilu klienta",
    legalBases: [{ regulationId: "reg-aml-act", ref: "§ 9 odst. 2" }],
    status: "approved",
    origin: "generated",
    text: "1. Instituce průběžně porovnává transakce klienta s jeho deklarovaným a historickým profilem.\n2. Jednorázová transakce vyšší než dvojnásobek maximální transakce za předchozí čtvrtletí je neobvyklá.\n3. Transakce nad 500 000 CZK se vždy zaznamenává k posouzení.",
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-03T15:00:00.000Z",
    approvedBy: APPROVER,
    approvedAt: "2026-09-03T15:00:00.000Z",
  },
  {
    id: "pol-reporting",
    name: "Oznamování podezřelých obchodů",
    legalBases: [
      { regulationId: "reg-aml-act", ref: "§ 18" },
      { regulationId: "reg-fau-methodology-4", ref: null },
    ],
    status: "approved",
    origin: "manual",
    text: "1. Podezřelý obchod oznamuje kontaktní osoba Finančnímu analytickému úřadu bez zbytečného odkladu.\n2. Opakované alerty u téhož klienta se eskalují vedoucímu AML.\n3. Každé rozhodnutí o oznámení se zaznamenává do auditního logu s odůvodněním.",
    createdAt: "2026-08-15T09:00:00.000Z",
    updatedAt: "2026-08-18T11:00:00.000Z",
    approvedBy: APPROVER,
    approvedAt: "2026-08-18T11:00:00.000Z",
  },
  {
    id: "pol-suspicious-indicators",
    name: "Indikátory podezřelého obchodu",
    legalBases: [
      { regulationId: "reg-aml-act", ref: "§ 6" },
      { regulationId: "reg-fau-methodology-4", ref: "Indikátory podezřelého obchodu" },
    ],
    status: "draft",
    origin: "generated",
    text: "1. Za indikátor podezřelého obchodu se považuje zejména rozdělování plateb pod hranicí 15 000 EUR.\n2. Indikátorem je průtokový účet: příchozí prostředky jsou do několika hodin odeslány na jiný účet.\n3. Analytik posuzuje indikátory v kontextu celé historie klienta.",
    createdAt: "2026-10-10T09:00:00.000Z",
    updatedAt: "2026-10-10T09:00:00.000Z",
    approvedBy: null,
    approvedAt: null,
  },
  {
    id: "pol-transfer-information",
    name: "Informace doprovázející převody",
    legalBases: [{ regulationId: "reg-tfr", ref: "čl. 4" }],
    status: "draft",
    origin: "generated",
    text: "1. Každý převod musí obsahovat úplné údaje o plátci a příjemci.\n2. Převod s chybějícím účtem plátce se zastaví a předá k doplnění údajů.",
    createdAt: "2026-10-14T09:00:00.000Z",
    updatedAt: "2026-10-14T09:00:00.000Z",
    approvedBy: null,
    approvedAt: null,
  },
  {
    id: "pol-risk-factors",
    name: "Rizikové faktory ML/TF",
    legalBases: [{ regulationId: "reg-eba-gl-2021-02", ref: "obecný pokyn 2 (rizikové faktory)" }],
    status: "approved",
    origin: "generated",
    text: "1. Rizikový profil klienta zohledňuje typ klienta, zemi, PEP status a chování.\n2. Remitence klientů s vysokým rizikem do zahraničí se posuzují zvlášť.\n3. Neobvyklé chování vůči profilu posuzuje agent a výsledek kontroluje analytik.",
    createdAt: "2026-09-10T09:00:00.000Z",
    updatedAt: "2026-09-12T10:00:00.000Z",
    approvedBy: APPROVER,
    approvedAt: "2026-09-12T10:00:00.000Z",
  },
  {
    id: "pol-ongoing-monitoring",
    name: "Průběžný monitoring dle AMLR",
    legalBases: [{ regulationId: "reg-amlr", ref: "průběžný monitoring obchodního vztahu" }],
    status: "draft",
    origin: "generated",
    text: "1. Příprava na AMLR (účinnost od 10. 7. 2027): monitoring musí pokrývat celý obchodní vztah.\n2. Platby do zemí, kam klient dosud neplatil, se posuzují s ohledem na jeho profil.",
    createdAt: "2026-10-16T09:00:00.000Z",
    updatedAt: "2026-10-16T09:00:00.000Z",
    approvedBy: null,
    approvedAt: null,
  },
  {
    // M3: a purely internal policy cites no regulation.
    id: "pol-internal-escalation",
    name: "Interní eskalace opakovaných alertů",
    legalBases: [],
    status: "approved",
    origin: "manual",
    text: "1. Klient s opakovanými alerty v krátkém období se posuzuje jako celek, ne po jednotlivých transakcích.\n2. Návrh eskalace předává analytik vedoucímu AML s odkazem na dotčené transakce.",
    createdAt: "2026-09-10T09:00:00.000Z",
    updatedAt: "2026-09-12T10:00:00.000Z",
    approvedBy: APPROVER,
    approvedAt: "2026-09-12T10:00:00.000Z",
  },
];

export const SEED_POLICIES: MockPolicyRecord[] = SEED_POLICY_RECORDS.map(withVersionHistory);
