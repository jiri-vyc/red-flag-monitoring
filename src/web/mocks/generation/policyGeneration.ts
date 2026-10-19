import type { Jurisdiction } from "@/features/regulations/types";
import type { RegulationSource } from "@/features/wizard/types";
import { assertUnreachable } from "@/lib/assertUnreachable";

import type { MockPolicyRecord, MockRegulationRecord } from "../store/mockDatabase";

function describeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const lastPathSegment = parsedUrl.pathname.split("/").filter(Boolean).at(-1);
    return lastPathSegment
      ? `${parsedUrl.hostname}/${decodeURIComponent(lastPathSegment)}`
      : parsedUrl.hostname;
  } catch {
    return url;
  }
}

export function describeRegulationSource(source: RegulationSource): string {
  switch (source.kind) {
    case "file":
      return source.file.name;
    case "url":
      return describeUrl(source.url);
    case "text":
      return "Vložený text regulace";
    default:
      return assertUnreachable(source);
  }
}

function inferJurisdiction(sourceLabel: string): Jurisdiction {
  if (/eur-lex|\(EU\)|EBA/i.test(sourceLabel)) {
    return "EU";
  }
  if (/fatf/i.test(sourceLabel)) {
    return "INTL";
  }
  return "CZ";
}

export function buildGeneratedRegulation({
  id,
  source,
  regulationName,
  now,
}: {
  id: string;
  source: RegulationSource;
  regulationName: string;
  now: string;
}): MockRegulationRecord {
  const sourceLabel = describeRegulationSource(source);
  const name = regulationName.trim() || sourceLabel;
  return {
    id,
    name,
    shortName: name.length > 28 ? `${name.slice(0, 26)}…` : name,
    jurisdiction: inferJurisdiction(`${name} ${sourceLabel}`),
    description: "Regulace přidaná přes wizard. Povinnosti byly extrahovány automaticky a čekají na ověření.",
    sourceUrl: source.kind === "url" ? source.url : "",
    version: `Nahráno ${now.slice(0, 10)}`,
    lastCheckedAt: now,
    keyProvisions: [
      "čl. 1 Předmět úpravy",
      "čl. 3 Povinnost monitoringu transakcí",
      "čl. 5 Oznamovací povinnost",
    ],
  };
}

export const GENERAL_PROVISIONS_REF = "Obecná ustanovení";

export function buildGeneratedPolicy({
  id,
  regulation,
  now,
}: {
  id: string;
  regulation: MockRegulationRecord;
  now: string;
}): MockPolicyRecord {
  const provisionRef = regulation.keyProvisions[1] ?? regulation.keyProvisions[0] ?? GENERAL_PROVISIONS_REF;
  return {
    id,
    name: `Interní předpis: ${regulation.shortName}`,
    // M3: the wizard drafts the policy from one regulation, so it cites just that one.
    legalBases: [{ regulationId: regulation.id, ref: provisionRef }],
    status: "draft",
    origin: "generated",
    text: [
      `1. Účel. Tento předpis provádí povinnosti z regulace „${regulation.name}“, zejména ${provisionRef} (${regulation.shortName}).`,
      "2. Monitoring. Instituce průběžně sleduje transakce klientů a porovnává je s jejich rizikovým profilem.",
      "3. Vysoce rizikové země. Transakce nad 10 000 CZK s účastí vysoce rizikové země se předávají k posouzení.",
      "4. PEP. Odchozí platby politicky exponovaných osob nad 100 000 CZK se posuzují jednotlivě.",
      "5. Neobvyklé chování. Transakce neodpovídající profilu klienta posuzuje analytik s podporou AI agenta.",
      "6. Záznamy. Každé rozhodnutí se zaznamenává do auditního logu s odůvodněním.",
    ].join("\n"),
    createdAt: now,
    updatedAt: now,
    approvedBy: null,
    approvedAt: null,
  };
}

type GeneratedRuleBlueprint = { description: string; type: "deterministic" | "agentic"; sensitivity: number };

export const WIZARD_RULE_BLUEPRINTS: readonly GeneratedRuleBlueprint[] = [
  {
    description: "Transakce nad 10 000 CZK s účastí vysoce rizikové země",
    type: "deterministic",
    sensitivity: 90,
  },
  { description: "Odchozí platba PEP nad 100 000 CZK", type: "deterministic", sensitivity: 100 },
  {
    description:
      "Posuď, zda transakce odpovídá profilu a historii klienta a zda nevykazuje znaky neobvyklého chování.",
    type: "agentic",
    sensitivity: 70,
  },
];
