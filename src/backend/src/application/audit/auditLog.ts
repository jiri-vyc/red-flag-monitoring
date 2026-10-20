import type { JsonValue } from "../../domain/json";

export type AuditEntityType =
  | "regulation"
  | "internal_policy"
  | "rule"
  | "reference_list"
  | "whitelist_entry"
  | "evaluation_run"
  | "drafting_job"
  | "aml_event"
  | "llm_call";

export type AuditEvent = {
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  // null when the API takes no actor, e.g. enabling a rule.
  actorId: string | null;
  payload?: Record<string, JsonValue>;
};

const NO_ACTOR = "none";

// One line per event, searchable with the saved Logs Insights query in deploy/roles.sh. The API's log group wraps
// stdout in a JSON envelope and the drafting worker writes plain text, so the query parses this line with a regex:
// keep the key order, keep values free of spaces and keep the payload last, closed by [/audit].
export function formatAuditLine(event: AuditEvent): string {
  return (
    `[audit] action=${event.action} entity_type=${event.entityType} entity_id=${toToken(event.entityId)} ` +
    `actor_id=${toToken(event.actorId ?? NO_ACTOR)} payload=${JSON.stringify(event.payload ?? {})} [/audit]`
  );
}

// Best effort: the line is written after the change succeeded and is not part of its database transaction.
export function recordAuditEvent(event: AuditEvent): void {
  console.log(formatAuditLine(event));
}

function toToken(value: string): string {
  return value.replace(/\s+/g, "_");
}
