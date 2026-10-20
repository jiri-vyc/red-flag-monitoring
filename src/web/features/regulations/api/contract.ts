import type { Regulation } from "../types";

export interface RegulationsService {
  loadRegulations(): Promise<Regulation[]>;
  loadRegulation(regulationId: string): Promise<Regulation>;
  /** Short name by regulation id, for links. Much cheaper than `loadRegulations` (no versions, no citations). */
  loadRegulationNames(): Promise<Record<string, string>>;
}
