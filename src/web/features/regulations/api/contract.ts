import type { Regulation } from "../types";

/** What the active implementation supports. The UI hides actions that are false instead of letting them fail. */
export type RegulationsCapabilities = {
  /** Delete a regulation no policy or rule version cites (see findRegulationDeletionBlocker). */
  canDeleteRegulation: boolean;
};

/** The actor is recorded in the audit trail of the deletion. */
export type DeleteRegulationInput = { regulationId: string; deletedBy: string };

export interface RegulationsService {
  readonly capabilities: RegulationsCapabilities;
  loadRegulations(): Promise<Regulation[]>;
  loadRegulation(regulationId: string): Promise<Regulation>;
  /** Short name by regulation id, for links. Much cheaper than `loadRegulations` (no versions, no citations). */
  loadRegulationNames(): Promise<Record<string, string>>;
  /** Removes the regulation with its versions and texts; refused while a policy or rule version cites it. */
  deleteRegulation(input: DeleteRegulationInput): Promise<void>;
}
