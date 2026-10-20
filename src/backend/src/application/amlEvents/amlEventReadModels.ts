import type { PriorityFactor, TriageDecision, TriageSource } from "../../domain/alertTriage";
import type { AmlEvent } from "../../domain/amlEvent";
import type { JsonValue } from "../../domain/json";
import type { Client } from "../../domain/client";
import type { RuleEvaluation } from "../../domain/evaluation";
import type { EscalationRole, RuleKind } from "../../domain/rule";
import type { Transaction } from "../../domain/transaction";

export type AmlEventFilter = {
  runId: string;
  alertType: string | null;
  clientId: string | null;
};

// The current proposal: the model's when there is one, the rule-based one otherwise.
export type AmlEventTriageSummary = {
  source: TriageSource;
  triage: TriageDecision;
  priority: number;
  reason: string;
};

export type AmlEventTriageRecord = AmlEventTriageSummary & {
  priorityFactors: PriorityFactor[];
  log: JsonValue;
  llmCallId: string | null;
  createdAt: Date;
};

export type TriageLlmCall = {
  id: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  response: JsonValue;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  createdAt: Date;
};

export type AmlEventListItem = AmlEvent & { ruleCode: string; triage: AmlEventTriageSummary | null };

export type AmlEventHit = {
  transaction: Transaction;
  ruleEvaluation: RuleEvaluation;
};

export type AmlEventReference = Pick<AmlEvent, "id" | "alertId" | "alertType"> & {
  triage: AmlEventTriageSummary | null;
};

export type AmlEventDetail = {
  amlEvent: AmlEvent;
  rule: { id: string; code: string; alertType: string; kind: RuleKind };
  ruleVersion: { id: string; versionNo: number; humanText: string; escalationRole: EscalationRole };
  client: Client;
  hits: AmlEventHit[];
  otherClientAmlEvents: AmlEventReference[];
  triage: AmlEventTriageSummary | null;
  // Oldest first.
  triageHistory: AmlEventTriageRecord[];
  triageLlmCall: TriageLlmCall | null;
};

export type AmlEventCsvRow = {
  alertId: string;
  alertType: string;
  clientId: string;
  transactionId: string | null;
  triage: TriageDecision | null;
  priority: number | null;
  reason: string | null;
  log: JsonValue | null;
};
