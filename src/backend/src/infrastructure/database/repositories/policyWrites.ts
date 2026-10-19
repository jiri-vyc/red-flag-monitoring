import type { EntityManager } from "typeorm";

import type {
  NewInternalPolicy,
  NewInternalPolicyVersion,
} from "../../../application/internalPolicies/internalPolicyRepository";
import { InternalPolicyEntity } from "../entities/InternalPolicyEntity";
import { InternalPolicyVersionEntity } from "../entities/InternalPolicyVersionEntity";
import { PolicyLegalBasisEntity } from "../entities/PolicyLegalBasisEntity";
import { toNextVersionNo } from "./versionWrites";

export function insertPolicy(
  manager: EntityManager,
  policy: NewInternalPolicy,
): Promise<InternalPolicyEntity> {
  return manager.save(manager.create(InternalPolicyEntity, policy));
}

// Call inside a transaction: the version and its legal bases are written together.
export async function insertPolicyVersion(
  manager: EntityManager,
  version: NewInternalPolicyVersion,
): Promise<InternalPolicyVersionEntity> {
  const { legalBases, ...columns } = version;
  const maxVersionNo = await manager.maximum(InternalPolicyVersionEntity, "versionNo", {
    policyId: version.policyId,
  });
  const saved = await manager.save(
    manager.create(InternalPolicyVersionEntity, { ...columns, versionNo: toNextVersionNo(maxVersionNo) }),
  );

  if (legalBases.length > 0) {
    await manager.insert(
      PolicyLegalBasisEntity,
      legalBases.map((legalBasis) => ({ ...legalBasis, policyVersionId: saved.id })),
    );
  }

  return saved;
}
