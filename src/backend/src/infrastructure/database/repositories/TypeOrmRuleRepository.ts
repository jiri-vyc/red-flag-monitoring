import { type DataSource, In, IsNull } from "typeorm";

import type { RuleLegalBasis } from "../../../domain/regulation";
import type { Rule, RuleVersion } from "../../../domain/rule";
import { ConflictError } from "../../../application/errors";
import type {
  NewRule,
  NewRuleVersion,
  RuleActivation,
  RuleRepository,
  RuleVersionReview,
} from "../../../application/rules/ruleRepository";
import type { VersionStatusChange } from "../../../application/versionReview";
import { RuleEntity } from "../entities/RuleEntity";
import { RuleLegalBasisEntity } from "../entities/RuleLegalBasisEntity";
import { RuleVersionEntity } from "../entities/RuleVersionEntity";
import { translateDatabaseErrors } from "../translateDatabaseErrors";
import { insertRule, insertRuleVersion } from "./ruleWrites";
import { recordVersionReview, supersedeApprovedVersions, updateVersionStatus } from "./versionWrites";

export class TypeOrmRuleRepository implements RuleRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createRule(rule: NewRule): Promise<Rule> {
    const saved = await translateDatabaseErrors(() => insertRule(this.dataSource.manager, rule));

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

  async createVersion(version: NewRuleVersion): Promise<RuleVersion> {
    const saved = await translateDatabaseErrors(() =>
      this.dataSource.transaction((manager) => insertRuleVersion(manager, version)),
    );

    return toRuleVersion(saved, version.legalBases);
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

  recordReview(versionId: string, { escalationRole, ...review }: RuleVersionReview): Promise<void> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        await recordVersionReview(manager, RuleVersionEntity, versionId, review);

        if (escalationRole) {
          await manager.update(RuleVersionEntity, { id: versionId }, { escalationRole });
        }
      }),
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
    escalationRole: entity.escalationRole,
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
