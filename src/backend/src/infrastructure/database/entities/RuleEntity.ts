import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from "typeorm";

import { ALERT_GRANULARITIES, type AlertGranularity, RULE_KINDS, type RuleKind } from "../../../domain/rule";
import { isOneOf } from "../sqlChecks";
import { InternalPolicyEntity } from "./InternalPolicyEntity";
import { RuleVersionEntity } from "./RuleVersionEntity";

@Entity({ name: "rules" })
@Unique("rules_code_key", ["code"])
@Check("rules_kind_check", isOneOf("kind", RULE_KINDS))
@Check("rules_alert_granularity_check", isOneOf("alert_granularity", ALERT_GRANULARITIES))
@Check("rules_enabled_check", `NOT "enabled" OR "active_version_id" IS NOT NULL`)
export class RuleEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "rules_pkey" })
  id!: string;

  @Column({ name: "policy_id", type: "uuid", nullable: true })
  policyId!: string | null;

  @ManyToOne(() => InternalPolicyEntity, { nullable: true })
  @JoinColumn({ name: "policy_id", foreignKeyConstraintName: "rules_policy_id_fkey" })
  policy!: InternalPolicyEntity | null;

  @Column({ name: "code", type: "text" })
  code!: string;

  @Column({ name: "alert_type", type: "text" })
  alertType!: string;

  @Column({ name: "alert_granularity", type: "text", default: "transaction" })
  alertGranularity!: AlertGranularity;

  @Column({ name: "kind", type: "text" })
  kind!: RuleKind;

  @Column({ name: "enabled", type: "boolean", default: false })
  enabled!: boolean;

  // Circular with rule_versions.rule_id: the migration adds this FK after both tables exist. That the version
  // belongs to this rule is checked in the use case.
  @Column({ name: "active_version_id", type: "uuid", nullable: true })
  activeVersionId!: string | null;

  @ManyToOne(() => RuleVersionEntity, { nullable: true })
  @JoinColumn({ name: "active_version_id", foreignKeyConstraintName: "rules_active_version_id_fkey" })
  activeVersion!: Relation<RuleVersionEntity> | null;

  @Column({ name: "whitelist_allowed", type: "boolean", default: true })
  whitelistAllowed!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
