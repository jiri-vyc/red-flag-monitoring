import { type DataSource, type EntityManager, In, IsNull } from "typeorm";

import type { RuleLegalBasis } from "../../../domain/regulation";
import type { Rule, RuleVersion } from "../../../domain/rule";
import type { VersionReview } from "../../../domain/versionStatus";
import { ConflictError } from "../../../application/errors";
import type {
  NewRule,
  NewRuleVersion,
  RuleActivation,
  RuleRepository,
} from "../../../application/rules/ruleRepository";
import type { VersionStatusChange } from "../../../application/versionReview";
import { RuleEntity } from "../entities/RuleEntity";
import { RuleLegalBasisEntity } from "../entities/RuleLegalBasisEntity";
import { RuleVersionEntity } from "../entities/RuleVersionEntity";
import { translateDatabaseErrors } from "../translateDatabaseErrors";
import {
  recordVersionReview,
  supersedeApprovedVersions,
  toNextVersionNo,
  updateVersionStatus,
} from "./versionWrites";

export class TypeOrmRuleRepository implements RuleRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createRule(rule: NewRule): Promise<Rule> {
    const rules = this.dataSource.getRepository(RuleEntity);
    const saved = await translateDatabaseErrors(() =>
      rules.save(
        rules.create({
          policyId: rule.policyId,
          code: rule.code,
          alertType: rule.alertType,
          kind: rule.kind,
          whitelistAllowed: rule.isWhitelistAllowed,
        }),
      ),
    );

    return toRule(saved);
  }

  async listRules(): Promise<Rule[]> {
    const entities = await this.dataSource.getRepository(RuleEntity).find({ order: { code: "ASC" } });

    return entities.map(toRule);
  }

  async findRule(ruleId: string): Promise<Rule | null> {
    const entity = await this.dataSource.getRepository(RuleEntity).findOneBy({ id: ruleId });

    return entity ? toRule(entity) : null;
  }

  async updateRuleEnabled(ruleId: string, isEnabled: boolean): Promise<void> {
    await translateDatabaseErrors(() =>
      this.dataSource.getRepository(RuleEntity).update({ id: ruleId }, { enabled: isEnabled }),
    );
  }

  activateVersion(activation: RuleActivation): Promise<void> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        const { previousActiveVersionId } = activation;
        const result = await manager.update(
          RuleEntity,
          { id: activation.ruleId, activeVersionId: previousActiveVersionId ?? IsNull() },
          { activeVersionId: activation.versionId },
        );

        if (result.affected === 0) {
          throw new ConflictError(`Active version of rule ${activation.ruleId} changed in the meantime`);
        }

        if (previousActiveVersionId) {
          await supersedeApprovedVersions(manager, RuleVersionEntity, [previousActiveVersionId]);
        }
      }),
    );
  }

  createVersion(version: NewRuleVersion): Promise<RuleVersion> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        const { legalBases, ...columns } = version;
        const maxVersionNo = await manager.maximum(RuleVersionEntity, "versionNo", {
          ruleId: version.ruleId,
        });
        const saved = await manager.save(
          manager.create(RuleVersionEntity, { ...columns, versionNo: toNextVersionNo(maxVersionNo) }),
        );

        await insertLegalBases(manager, saved.id, legalBases);

        return toRuleVersion(saved, legalBases);
      }),
    );
  }

  async listVersions(ruleId: string): Promise<RuleVersion[]> {
    const entities = await this.dataSource
      .getRepository(RuleVersionEntity)
      .find({ where: { ruleId }, order: { versionNo: "ASC" } });

    return this.withLegalBases(entities);
  }

  async findVersion(versionId: string): Promise<RuleVersion | null> {
    const entity = await this.dataSource.getRepository(RuleVersionEntity).findOneBy({ id: versionId });
    const [version] = entity ? await this.withLegalBases([entity]) : [];

    return version ?? null;
  }

  updateVersionStatus(change: VersionStatusChange): Promise<void> {
    return updateVersionStatus(this.dataSource.manager, RuleVersionEntity, change);
  }

  recordReview(versionId: string, review: VersionReview): Promise<void> {
    return translateDatabaseErrors(() =>
      recordVersionReview(this.dataSource.manager, RuleVersionEntity, versionId, review),
    );
  }

  private async withLegalBases(entities: RuleVersionEntity[]): Promise<RuleVersion[]> {
    const legalBases = await this.dataSource.getRepository(RuleLegalBasisEntity).find({
      where: { ruleVersionId: In(entities.map((entity) => entity.id)) },
      order: { ref: "ASC" },
    });

    return entities.map((entity) =>
      toRuleVersion(
        entity,
        legalBases.filter((legalBasis) => legalBasis.ruleVersionId === entity.id).map(toRuleLegalBasis),
      ),
    );
  }
}

async function insertLegalBases(
  manager: EntityManager,
  ruleVersionId: string,
  legalBases: RuleLegalBasis[],
): Promise<void> {
  await manager.insert(
    RuleLegalBasisEntity,
    legalBases.map((legalBasis) => ({ ...legalBasis, ruleVersionId })),
  );
}

function toRule(entity: RuleEntity): Rule {
  return {
    id: entity.id,
    policyId: entity.policyId,
    code: entity.code,
    alertType: entity.alertType,
    kind: entity.kind,
    isEnabled: entity.enabled,
    activeVersionId: entity.activeVersionId,
    isWhitelistAllowed: entity.whitelistAllowed,
    createdAt: entity.createdAt,
  };
}

function toRuleLegalBasis(entity: RuleLegalBasisEntity): RuleLegalBasis {
  return { regulationVersionId: entity.regulationVersionId, ref: entity.ref };
}

function toRuleVersion(entity: RuleVersionEntity, legalBases: RuleLegalBasis[]): RuleVersion {
  return {
    id: entity.id,
    ruleId: entity.ruleId,
    versionNo: entity.versionNo,
    derivedFromPolicyVersionId: entity.derivedFromPolicyVersionId,
    definition: entity.definition,
    agentPrompt: entity.agentPrompt,
    agentModelId: entity.agentModelId,
    humanText: entity.humanText,
    thresholdRationale: entity.thresholdRationale,
    baseScore: entity.baseScore,
    sensitivity: entity.sensitivity,
    riskProfiles: entity.riskProfiles,
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
