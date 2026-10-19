import type { Regulation, RegulationVersion } from "../../domain/regulation";
import { ConflictError } from "../errors";
import type {
  NewRegulation,
  NewRegulationVersion,
  RegulationRepository,
  RegulationVersionSummary,
} from "../regulations/regulationRepository";

export class InMemoryRegulationRepository implements RegulationRepository {
  readonly regulations = new Map<string, Regulation>();
  readonly versions = new Map<string, RegulationVersion>();
  private nextId = 1;

  async createRegulation(regulation: NewRegulation): Promise<Regulation> {
    if ([...this.regulations.values()].some((existing) => existing.code === regulation.code)) {
      throw new ConflictError(`Regulation ${regulation.code} already exists`);
    }

    const created = { ...regulation, id: `regulation-${this.nextId++}` };
    this.regulations.set(created.id, created);

    return created;
  }

  async listRegulations(): Promise<Regulation[]> {
    return [...this.regulations.values()];
  }

  async findRegulation(regulationId: string): Promise<Regulation | null> {
    return this.regulations.get(regulationId) ?? null;
  }

  async findRegulationBySourceUrl(sourceUrl: string): Promise<Regulation | null> {
    return [...this.regulations.values()].find((regulation) => regulation.sourceUrl === sourceUrl) ?? null;
  }

  async createVersion(version: NewRegulationVersion): Promise<RegulationVersion> {
    const created = { ...version, id: `regulation-version-${this.nextId++}`, createdAt: new Date(0) };
    this.versions.set(created.id, created);

    return created;
  }

  async listVersions(regulationId: string): Promise<RegulationVersionSummary[]> {
    return [...this.versions.values()]
      .filter((version) => version.regulationId === regulationId)
      .map(({ fullText: _fullText, ...summary }) => summary);
  }

  async findVersion(versionId: string): Promise<RegulationVersion | null> {
    return this.versions.get(versionId) ?? null;
  }
}
