import type { WhitelistEntry } from "@/features/rules/types";

const AML_OFFICER = "Petr Svoboda";

export const SEED_WHITELIST_ENTRIES: WhitelistEntry[] = [
  {
    ruleId: "rule-client-max-exceeded",
    clientId: "K000024",
    reason:
      "Jednorázový prodej nemovitosti doložený kupní smlouvou a výpisem z katastru, příjem z prodeje převyšuje obvyklé transakce klienta.",
    createdBy: AML_OFFICER,
    createdAt: "2026-09-22T10:30:00.000Z",
  },
  {
    ruleId: "rule-client-max-exceeded",
    clientId: "K002013",
    reason:
      "Sezónní výkup zemědělské produkce, nárazové platby dodavatelům ověřeny při posledním přezkumu klienta (KYC 08/2026).",
    createdBy: AML_OFFICER,
    createdAt: "2026-09-23T14:05:00.000Z",
  },
  {
    ruleId: "rule-manual-repeated-alerts",
    clientId: "K004318",
    reason:
      "Opakované alerty prošetřeny, jde o pravidelné platby mateřské společnosti v rámci skupiny. Přezkum výjimky naplánován na 01/2027.",
    createdBy: AML_OFFICER,
    createdAt: "2026-09-30T09:15:00.000Z",
  },
];
