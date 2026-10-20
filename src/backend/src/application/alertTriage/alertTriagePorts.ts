import type {
  ClientTriageCase,
  PriorityFactor,
  TriageDecision,
  TriageProposal,
  TriageSource,
} from "../../domain/alertTriage";
import type { Client } from "../../domain/client";
import type { FxRate } from "../../domain/features/fxRates";
import type { JsonValue } from "../../domain/json";
import type { Transaction } from "../../domain/transaction";

export type StoredAlertHit = {
  transactionId: string;
  metConditionIds: string[];
  traceSummary: string | null;
};

export type StoredTriageAlert = {
  amlEventId: string;
  alertId: string;
  clientId: string;
  ruleCode: string;
  ruleVersionId: string;
  ruleText: string;
  alertType: string;
  transactionId: string | null;
  periodMonth: string | null;
  maxScore: number;
  anyConditionCount: number;
  hits: StoredAlertHit[];
};

export type TriageInputData = {
  alerts: StoredTriageAlert[];
  clients: Client[];
  transactions: Transaction[];
  fxRates: FxRate[];
  highRiskCountries: string[];
};

export type NewAlertTriage = {
  amlEventId: string;
  source: TriageSource;
  triage: TriageDecision;
  priority: number;
  priorityFactors: PriorityFactor[];
  reason: string;
  log: JsonValue;
};

export type NewTriageLlmCall = {
  runId: string;
  clientId: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  response: JsonValue;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

export interface AlertTriageRepository {
  // clientIds null loads every client with an alert in the run.
  loadTriageInput(input: { runId: string; clientIds: string[] | null }): Promise<TriageInputData>;
  listClientIdsWithLlmTriage(runId: string): Promise<string[]>;
  // An alert keeps its first proposal per source; a repeated triage of the same source is skipped.
  saveRuleTriages(triages: NewAlertTriage[]): Promise<void>;
  saveLlmTriages(input: { call: NewTriageLlmCall; triages: NewAlertTriage[] }): Promise<void>;
}

export type LlmAlertDecision = { alertId: string; triage: TriageDecision; reason: string };

export type LlmTriageResult = {
  clientAssessment: string;
  decisions: LlmAlertDecision[];
  call: Omit<NewTriageLlmCall, "runId" | "clientId">;
};

export interface AlertTriageModel {
  readonly modelId: string;
  triageClient(input: {
    triageCase: ClientTriageCase;
    proposals: TriageProposal[];
  }): Promise<LlmTriageResult>;
}

export type LlmTriageRequest = { runId: string; clientIds: string[] | null; clientLimit: number | null };

export interface AlertTriageLauncher {
  launchLlmTriage(request: LlmTriageRequest): Promise<void>;
}
