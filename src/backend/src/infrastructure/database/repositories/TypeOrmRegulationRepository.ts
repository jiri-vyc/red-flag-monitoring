import type { DataSource } from "typeorm";

import type { Regulation, RegulationVersion } from "../../../domain/regulation";
import type {
  NewRegulation,
  NewRegulationVersion,
  RegulationRepository,
  RegulationVersionSummary,
} from "../../../application/regulations/regulationRepository";
import { RegulationEntity } from "../entities/RegulationEntity";
import { RegulationVersionEntity } from "../entities/RegulationVersionEntity";
import { translateDatabaseErrors } from "../translateDatabaseErrors";

export class TypeOrmRegulationRepository implements RegulationRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createRegulation(regulation: NewRegulation): Promise<Regulation> {
    const regulations = this.dataSource.getRepository(RegulationEntity);
    const saved = await translateDatabaseErrors(() => regulations.save(regulations.create(regulation)));

    return toRegulation(saved);
  }

  async listRegulations(): Promise<Regulation[]> {
    const entities = await this.dataSource.getRepository(RegulationEntity).find({ order: { code: "ASC" } });

    return entities.map(toRegulation);
  }

  async findRegulation(regulationId: string): Promise<Regulation | null> {
    const entity = await this.dataSource.getRepository(RegulationEntity).findOneBy({ id: regulationId });

    return entity ? toRegulation(entity) : null;
  }

  async createVersion(version: NewRegulationVersion): Promise<RegulationVersion> {
    const versions = this.dataSource.getRepository(RegulationVersionEntity);
    const saved = await translateDatabaseErrors(() => versions.save(versions.create(version)));

    return toRegulationVersion(saved);
  }

  async listVersions(regulationId: string): Promise<RegulationVersionSummary[]> {
    const entities = await this.dataSource.getRepository(RegulationVersionEntity).find({
      select: { id: true, regulationId: true, label: true, createdAt: true },
      where: { regulationId },
      order: { createdAt: "ASC" },
    });

    return entities.map(({ id, label, createdAt }) => ({ id, regulationId, label, createdAt }));
  }

  async findVersion(versionId: string): Promise<RegulationVersion | null> {
    const entity = await this.dataSource.getRepository(RegulationVersionEntity).findOneBy({ id: versionId });

    return entity ? toRegulationVersion(entity) : null;
  }
}

function toRegulation(entity: RegulationEntity): Regulation {
  return {
    id: entity.id,
    code: entity.code,
    title: entity.title,
    kind: entity.kind,
    sourceUrl: entity.sourceUrl,
    checkedAt: entity.checkedAt,
  };
}

function toRegulationVersion(entity: RegulationVersionEntity): RegulationVersion {
  return {
    id: entity.id,
    regulationId: entity.regulationId,
    label: entity.label,
    fullText: entity.fullText,
    createdAt: entity.createdAt,
  };
}
