import type { Regulation, RegulationVersion } from "../../domain/regulation";

export type NewRegulation = Omit<Regulation, "id">;
export type NewRegulationVersion = Omit<RegulationVersion, "id" | "createdAt">;
export type RegulationVersionSummary = Omit<RegulationVersion, "fullText">;

export interface RegulationRepository {
  createRegulation(regulation: NewRegulation): Promise<Regulation>;
  listRegulations(): Promise<Regulation[]>;
  findRegulation(regulationId: string): Promise<Regulation | null>;
  createVersion(version: NewRegulationVersion): Promise<RegulationVersion>;
  listVersions(regulationId: string): Promise<RegulationVersionSummary[]>;
  findVersion(versionId: string): Promise<RegulationVersion | null>;
}
