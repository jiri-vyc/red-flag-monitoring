import type { AmlEvent } from "../../domain/amlEvent";
import type { Client } from "../../domain/client";
import type { RuleEvaluation } from "../../domain/evaluation";
import type { EscalationRole, RuleKind } from "../../domain/rule";
import type { Transaction } from "../../domain/transaction";

export type AmlEventFilter = {
  runId: string;
  alertType: string | null;
  clientId: string | null;
};

export type AmlEventListItem = AmlEvent & { ruleCode: string };

export type AmlEventHit = {
  transaction: Transaction;
  ruleEvaluation: RuleEvaluation;
};

export type AmlEventReference = Pick<AmlEvent, "id" | "alertId" | "alertType">;

export type AmlEventDetail = {
  amlEvent: AmlEvent;
  rule: { id: string; code: string; alertType: string; kind: RuleKind };
  ruleVersion: { id: string; versionNo: number; humanText: string; escalationRole: EscalationRole };
  client: Client;
  hits: AmlEventHit[];
  otherClientAmlEvents: AmlEventReference[];
};
