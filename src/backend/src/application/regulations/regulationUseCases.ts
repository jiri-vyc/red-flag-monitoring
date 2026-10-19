import type { Regulation, RegulationVersion } from "../../domain/regulation";
import { NotFoundError } from "../errors";
import type {
  NewRegulation,
  NewRegulationVersion,
  RegulationRepository,
  RegulationVersionSummary,
} from "./regulationRepository";

export class RegulationUseCases {
  constructor(private readonly regulationRepository: RegulationRepository) {}

  createRegulation(regulation: NewRegulation): Promise<Regulation> {
    return this.regulationRepository.createRegulation(regulation);
  }

  listRegulations(): Promise<Regulation[]> {
    return this.regulationRepository.listRegulations();
  }

  async getRegulation(regulationId: string): Promise<Regulation> {
    const regulation = await this.regulationRepository.findRegulation(regulationId);

    if (!regulation) {
      throw new NotFoundError("Regulation", regulationId);
    }

    return regulation;
  }

  // M1: a new wording is always a new version; existing wordings are never edited.
  async createVersion(version: NewRegulationVersion): Promise<RegulationVersion> {
    await this.getRegulation(version.regulationId);

    return this.regulationRepository.createVersion(version);
  }

  async listVersions(regulationId: string): Promise<RegulationVersionSummary[]> {
    await this.getRegulation(regulationId);

    return this.regulationRepository.listVersions(regulationId);
  }

  async getVersion(regulationId: string, versionId: string): Promise<RegulationVersion> {
    const version = await this.regulationRepository.findVersion(versionId);

    if (!version || version.regulationId !== regulationId) {
      throw new NotFoundError("Regulation version", versionId);
    }

    return version;
  }
}
