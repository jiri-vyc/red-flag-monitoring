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

import {
  DEFAULT_ESCALATION_ROLE,
  ESCALATION_ROLES,
  type EscalationRole,
  RISK_PROFILES,
  type RiskProfile,
} from "../../../domain/rule";
import type { RuleDefinition } from "../../../domain/ruleDefinition";
import { MAX_SCORE, MIN_SCORE } from "../../../domain/score";
import {
  INITIAL_VERSION_STATUSES,
  VERSION_ORIGINS,
  VERSION_STATUSES,
  type VersionOrigin,
  type VersionStatus,
} from "../../../domain/versionStatus";
import { isBetween, isOneOf, isSubsetOf } from "../sqlChecks";
import { InternalPolicyVersionEntity } from "./InternalPolicyVersionEntity";
import { RuleEntity } from "./RuleEntity";
import { UserEntity } from "./UserEntity";

@Entity({ name: "rule_versions" })
@Unique("rule_versions_rule_id_version_no_key", ["ruleId", "versionNo"])
@Check("rule_versions_version_no_check", `"version_no" > 0`)
@Check("rule_versions_base_score_check", isBetween("base_score", MIN_SCORE, MAX_SCORE))
@Check("rule_versions_sensitivity_check", isBetween("sensitivity", MIN_SCORE, MAX_SCORE))
@Check("rule_versions_risk_profiles_check", isSubsetOf("risk_profiles", RISK_PROFILES))
@Check("rule_versions_risk_profiles_not_empty_check", `cardinality("risk_profiles") > 0`)
@Check(
  "rule_versions_logic_check",
  `"definition" IS NOT NULL OR ("agent_prompt" IS NOT NULL AND "agent_model_id" IS NOT NULL)`,
)
@Check("rule_versions_escalation_role_check", isOneOf("escalation_role", ESCALATION_ROLES))
@Check("rule_versions_status_check", isOneOf("status", VERSION_STATUSES))
@Check("rule_versions_created_via_check", isOneOf("created_via", VERSION_ORIGINS))
@Check(
  "rule_versions_review_check",
  `(${isOneOf("status", INITIAL_VERSION_STATUSES)}) = ("reviewed_at" IS NULL)`,
)
@Check("rule_versions_reviewer_check", `("reviewed_at" IS NULL) = ("reviewed_by" IS NULL)`)
export class RuleVersionEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "rule_versions_pkey" })
  id!: string;

  @Column({ name: "rule_id", type: "uuid" })
  ruleId!: string;

  @ManyToOne(() => RuleEntity, { nullable: false })
  @JoinColumn({ name: "rule_id", foreignKeyConstraintName: "rule_versions_rule_id_fkey" })
  rule!: Relation<RuleEntity>;

  @Column({ name: "version_no", type: "integer" })
  versionNo!: number;

  @Column({ name: "derived_from_policy_version_id", type: "uuid", nullable: true })
  derivedFromPolicyVersionId!: string | null;

  @ManyToOne(() => InternalPolicyVersionEntity, { nullable: true })
  @JoinColumn({
    name: "derived_from_policy_version_id",
    foreignKeyConstraintName: "rule_versions_derived_from_policy_version_id_fkey",
  })
  derivedFromPolicyVersion!: InternalPolicyVersionEntity | null;

  @Column({ name: "definition", type: "jsonb", nullable: true })
  definition!: RuleDefinition | null;

  @Column({ name: "agent_prompt", type: "text", nullable: true })
  agentPrompt!: string | null;

  @Column({ name: "agent_model_id", type: "text", nullable: true })
  agentModelId!: string | null;

  @Column({ name: "human_text", type: "text" })
  humanText!: string;

  @Column({ name: "threshold_rationale", type: "text", nullable: true })
  thresholdRationale!: string | null;

  @Column({ name: "base_score", type: "integer", nullable: true })
  baseScore!: number | null;

  @Column({ name: "sensitivity", type: "integer" })
  sensitivity!: number;

  @Column({ name: "risk_profiles", type: "text", array: true })
  riskProfiles!: RiskProfile[];

  @Column({ name: "escalation_role", type: "text", default: DEFAULT_ESCALATION_ROLE })
  escalationRole!: EscalationRole;

  @Column({ name: "status", type: "text" })
  status!: VersionStatus;

  @Column({ name: "created_via", type: "text" })
  createdVia!: VersionOrigin;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: "created_by", foreignKeyConstraintName: "rule_versions_created_by_fkey" })
  creator!: UserEntity;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "reviewed_by", type: "uuid", nullable: true })
  reviewedBy!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: "reviewed_by", foreignKeyConstraintName: "rule_versions_reviewed_by_fkey" })
  reviewer!: UserEntity | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: "review_comment", type: "text", nullable: true })
  reviewComment!: string | null;
}
