import { type DataSource, In } from "typeorm";

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
import { insertDraftingJob } from "./draftingJobWrites";
import { insertPolicy, insertPolicyVersion } from "./policyWrites";
import { recordVersionReview, supersedeApprovedVersions, updateVersionStatus } from "./versionWrites";

export class TypeOrmInternalPolicyRepository implements InternalPolicyRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createPolicy(policy: NewInternalPolicy): Promise<InternalPolicy> {
    const saved = await translateDatabaseErrors(() => insertPolicy(this.dataSource.manager, policy));

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

  async createVersion(version: NewInternalPolicyVersion): Promise<InternalPolicyVersion> {
    const saved = await translateDatabaseErrors(() =>
      this.dataSource.transaction((manager) => insertPolicyVersion(manager, version)),
    );

    return toInternalPolicyVersion(saved, version.legalBases);
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

  recordReview(record: PolicyVersionReviewRecord): Promise<string | null> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        await recordVersionReview(manager, InternalPolicyVersionEntity, record.versionId, record.review);
        await supersedeApprovedVersions(manager, InternalPolicyVersionEntity, record.supersededVersionIds);

        return record.rulesJob ? (await insertDraftingJob(manager, record.rulesJob)).id : null;
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
