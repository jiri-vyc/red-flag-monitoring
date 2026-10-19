import type { RuleContent, RuleType } from "@/features/rules/types";

import type { MockCheckKind } from "../evaluation/ruleChecks";

type KeywordMapping = {
  keywords: RegExp;
  checkKind: MockCheckKind;
  codeCondition: string;
  explanation: string;
};

// Stand-in for LLM generation: picks a template by keywords in the rule description.
const DETERMINISTIC_TEMPLATES: KeywordMapping[] = [
  {
    keywords: /pep|politick/i,
    checkKind: "pep_outgoing",
    codeCondition: 'client.isPep && transaction.type !== "incoming payment" && toCzk(transaction) > 100_000',
    explanation: "Pravidlo označí odchozí platbu politicky exponované osoby vyšší než 100 000 CZK.",
  },
  {
    keywords: /zem|country|jurisdik|fatf/i,
    checkKind: "high_risk_jurisdiction",
    codeCondition:
      "[transaction.payerCountry, transaction.payeeCountry, client.country].some(isHighRiskCountry) && toCzk(transaction) > 10_000",
    explanation: "Pravidlo označí transakci nad 10 000 CZK, které se účastní vysoce riziková země.",
  },
  {
    keywords: /noc|night/i,
    checkKind: "night_activity",
    codeCondition: "transaction.time.getHours() < 5 && toCzk(transaction) > 50_000",
    explanation: "Pravidlo označí transakci nad 50 000 CZK provedenou mezi 00:00 a 05:00.",
  },
  {
    keywords: /struktur|rozděl|pod limit/i,
    checkKind: "threshold_structuring",
    codeCondition: "toCzk(transaction) >= 340_000 && toCzk(transaction) < 375_000",
    explanation: "Pravidlo označí platbu těsně pod hranicí 15 000 EUR.",
  },
  {
    keywords: /remit/i,
    checkKind: "high_risk_remittance",
    codeCondition: 'transaction.type === "remittance" && client.riskProfile === "high"',
    explanation: "Pravidlo označí remitenci klienta s vysokým AML risk profilem.",
  },
];

const DEFAULT_DETERMINISTIC_TEMPLATE: KeywordMapping = {
  keywords: /.*/,
  checkKind: "large_amount",
  codeCondition: "toCzk(transaction) > 500_000",
  explanation: "Pravidlo označí transakci vyšší než 500 000 CZK.",
};

export type GeneratedRuleDraft = { content: RuleContent; checkKind: MockCheckKind };

function findDeterministicTemplate(description: string): KeywordMapping {
  return (
    DETERMINISTIC_TEMPLATES.find((template) => template.keywords.test(description)) ??
    DEFAULT_DETERMINISTIC_TEMPLATE
  );
}

function buildCode({ codeCondition, description }: { codeCondition: string; description: string }): string {
  return `// Vygenerováno z popisu: ${description.slice(0, 80)}
export function evaluate({ transaction, client }) {
  const isMatch = ${codeCondition};
  return {
    score: isMatch ? 80 : 0,
    trace: [{ condition: ${JSON.stringify(description.slice(0, 60))}, isMet: isMatch }],
  };
}`;
}

export function generateRuleDraft({
  description,
  type,
}: {
  description: string;
  type: RuleType;
}): GeneratedRuleDraft {
  if (type === "agentic") {
    return {
      checkKind: "agentic_context",
      content: {
        type: "agentic",
        ruleText: `${description.trim()} Zohledni risk profil klienta, PEP status, zemi a historii transakcí. Vrať skóre 0–100 a odůvodnění s odkazy na konkrétní transakce a data, ze kterých vycházíš.`,
      },
    };
  }
  const template = findDeterministicTemplate(description);
  return {
    checkKind: template.checkKind,
    content: {
      type: "deterministic",
      code: buildCode({ codeCondition: template.codeCondition, description }),
      explanation: `${template.explanation} (Návrh vytvořený z popisu: „${description.trim()}“.)`,
    },
  };
}

export function deriveRuleName(description: string): string {
  const firstSentence = description.trim().split(/[.\n]/)[0] ?? description;
  return firstSentence.length > 70 ? `${firstSentence.slice(0, 67)}…` : firstSentence;
}
