import type { EntityManager } from "typeorm";

import type { NewRule, NewRuleVersion } from "../../../application/rules/ruleRepository";
import { RuleEntity } from "../entities/RuleEntity";
import { RuleLegalBasisEntity } from "../entities/RuleLegalBasisEntity";
import { RuleVersionEntity } from "../entities/RuleVersionEntity";
import { toNextVersionNo } from "./versionWrites";

export function insertRule(manager: EntityManager, rule: NewRule): Promise<RuleEntity> {
  return manager.save(
    manager.create(RuleEntity, {
      policyId: rule.policyId,
      code: rule.code,
      alertType: rule.alertType,
      kind: rule.kind,
      whitelistAllowed: rule.isWhitelistAllowed,
    }),
  );
}

// Call inside a transaction: the version and its legal bases are written together.
export async function insertRuleVersion(
  manager: EntityManager,
  version: NewRuleVersion,
): Promise<RuleVersionEntity> {
  const { legalBases, ...columns } = version;
  const maxVersionNo = await manager.maximum(RuleVersionEntity, "versionNo", { ruleId: version.ruleId });
  const saved = await manager.save(
    manager.create(RuleVersionEntity, { ...columns, versionNo: toNextVersionNo(maxVersionNo) }),
  );

  await manager.insert(
    RuleLegalBasisEntity,
    legalBases.map((legalBasis) => ({ ...legalBasis, ruleVersionId: saved.id })),
  );

  return saved;
}
