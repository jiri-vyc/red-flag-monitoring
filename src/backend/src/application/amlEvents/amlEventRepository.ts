import type { NewAmlEvent, RuleHit } from "../../domain/amlEvent";

// Write side of AML events: they are created once per run from its stored hits and never edited (V14).
export interface AmlEventRepository {
  listRunRuleHits(runId: string): Promise<RuleHit[]>;
  // Inserts the events and their links to the hits in one transaction.
  createAmlEvents(input: { runId: string; amlEvents: NewAmlEvent[] }): Promise<void>;
}
