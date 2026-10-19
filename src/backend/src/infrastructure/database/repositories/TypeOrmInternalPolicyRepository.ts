import { type DataSource, type EntityManager, In } from "typeorm";

import type { InternalPolicy, InternalPolicyVersion } from "../../../domain/internalPolicy";
import type { PolicyLegalBasis } from "../../../domain/regulation";
import type {
  InternalPolicyRepository,
  NewInternalPolicy,
  NewInternalPolicyVersion,
  PolicyVersionReviewRecord,
} from "../../../application/internalPolicies/internalPolicyRepository";
import type { VersionStatusChange } from "../../../application/versionReview";
import { InternalPolicyEntity } from "../entities/InternalPolicyEntity";
import { InternalPolicyVersionEntity } from "../entities/InternalPolicyVersionEntity";
import { PolicyLegalBasisEntity } from "../entities/PolicyLegalBasisEntity";
import { translateDatabaseErrors } from "../translateDatabaseErrors";
import {
  recordVersionReview,
  supersedeApprovedVersions,
  toNextVersionNo,
  updateVersionStatus,
} from "./versionWrites";

export class TypeOrmInternalPolicyRepository implements InternalPolicyRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createPolicy(policy: NewInternalPolicy): Promise<InternalPolicy> {
    const policies = this.dataSource.getRepository(InternalPolicyEntity);
    const saved = await translateDatabaseErrors(() => policies.save(policies.create(policy)));

    return toInternalPolicy(saved);
  }

  async listPolicies(): Promise<InternalPolicy[]> {
    const entities = await this.dataSource
      .getRepository(InternalPolicyEntity)
      .find({ order: { code: "ASC" } });

    return entities.map(toInternalPolicy);
  }

  async findPolicy(policyId: string): Promise<InternalPolicy | null> {
    const entity = await this.dataSource.getRepository(InternalPolicyEntity).findOneBy({ id: policyId });

    return entity ? toInternalPolicy(entity) : null;
  }

  createVersion(version: NewInternalPolicyVersion): Promise<InternalPolicyVersion> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        const { legalBases, ...columns } = version;
        const maxVersionNo = await manager.maximum(InternalPolicyVersionEntity, "versionNo", {
          policyId: version.policyId,
        });
        const saved = await manager.save(
          manager.create(InternalPolicyVersionEntity, {
            ...columns,
            versionNo: toNextVersionNo(maxVersionNo),
          }),
        );

        await insertLegalBases(manager, saved.id, legalBases);

        return toInternalPolicyVersion(saved, legalBases);
      }),
    );
  }

  async listVersions(policyId: string): Promise<InternalPolicyVersion[]> {
    const entities = await this.dataSource
      .getRepository(InternalPolicyVersionEntity)
      .find({ where: { policyId }, order: { versionNo: "ASC" } });

    return this.withLegalBases(entities);
  }

  async findVersion(versionId: string): Promise<InternalPolicyVersion | null> {
    const entity = await this.dataSource
      .getRepository(InternalPolicyVersionEntity)
      .findOneBy({ id: versionId });
    const [version] = entity ? await this.withLegalBases([entity]) : [];

    return version ?? null;
  }

  updateVersionStatus(change: VersionStatusChange): Promise<void> {
    return updateVersionStatus(this.dataSource.manager, InternalPolicyVersionEntity, change);
  }

  recordReview(record: PolicyVersionReviewRecord): Promise<void> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        await recordVersionReview(manager, InternalPolicyVersionEntity, record.versionId, record.review);
        await supersedeApprovedVersions(manager, InternalPolicyVersionEntity, record.supersededVersionIds);
      }),
    );
  }

  private async withLegalBases(entities: InternalPolicyVersionEntity[]): Promise<InternalPolicyVersion[]> {
    const legalBases = await this.dataSource.getRepository(PolicyLegalBasisEntity).find({
      where: { policyVersionId: In(entities.map((entity) => entity.id)) },
      order: { ref: "ASC" },
    });

    return entities.map((entity) =>
      toInternalPolicyVersion(
        entity,
        legalBases.filter((legalBasis) => legalBasis.policyVersionId === entity.id).map(toPolicyLegalBasis),
      ),
    );
  }
}

async function insertLegalBases(
  manager: EntityManager,
  policyVersionId: string,
  legalBases: PolicyLegalBasis[],
): Promise<void> {
  if (legalBases.length === 0) {
    return;
  }

  await manager.insert(
    PolicyLegalBasisEntity,
    legalBases.map((legalBasis) => ({ ...legalBasis, policyVersionId })),
  );
}

function toInternalPolicy(entity: InternalPolicyEntity): InternalPolicy {
  return { id: entity.id, code: entity.code, title: entity.title };
}

function toPolicyLegalBasis(entity: PolicyLegalBasisEntity): PolicyLegalBasis {
  return { regulationVersionId: entity.regulationVersionId, ref: entity.ref };
}

function toInternalPolicyVersion(
  entity: InternalPolicyVersionEntity,
  legalBases: PolicyLegalBasis[],
): InternalPolicyVersion {
  return {
    id: entity.id,
    policyId: entity.policyId,
    versionNo: entity.versionNo,
    body: entity.body,
    status: entity.status,
    createdVia: entity.createdVia,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
    reviewedBy: entity.reviewedBy,
    reviewedAt: entity.reviewedAt,
    reviewComment: entity.reviewComment,
    legalBases,
  };
}
