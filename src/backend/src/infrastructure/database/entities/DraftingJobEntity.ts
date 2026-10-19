import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import {
  DRAFTING_JOB_KINDS,
  DRAFTING_JOB_STATUSES,
  type DraftingJobKind,
  type DraftingJobStatus,
  FINISHED_DRAFTING_JOB_STATUSES,
  REGULATION_SOURCE_KINDS,
  type RegulationSourceKind,
} from "../../../domain/draftingJob";
import { isOneOf } from "../sqlChecks";
import { InternalPolicyVersionEntity } from "./InternalPolicyVersionEntity";
import { RegulationEntity } from "./RegulationEntity";
import { RegulationVersionEntity } from "./RegulationVersionEntity";
import { UserEntity } from "./UserEntity";

@Entity({ name: "drafting_jobs" })
@Index("drafting_jobs_created_at_idx", ["createdAt"])
@Index("drafting_jobs_status_idx", ["status"])
@Index("drafting_jobs_regulation_id_idx", ["regulationId"])
@Index("drafting_jobs_policy_version_id_idx", ["policyVersionId"])
@Index("drafting_jobs_parent_job_id_idx", ["parentJobId"])
@Check("drafting_jobs_kind_check", isOneOf("kind", DRAFTING_JOB_KINDS))
@Check("drafting_jobs_status_check", isOneOf("status", DRAFTING_JOB_STATUSES))
@Check("drafting_jobs_source_kind_check", isOneOf("source_kind", REGULATION_SOURCE_KINDS))
@Check(
  "drafting_jobs_input_check",
  `("kind" = 'policy_from_regulation' AND "source_kind" IS NOT NULL AND "policy_version_id" IS NULL)
    OR ("kind" = 'rules_from_policy' AND "source_kind" IS NULL AND "policy_version_id" IS NOT NULL)`,
)
@Check("drafting_jobs_source_url_check", `("source_kind" = 'url') = ("source_url" IS NOT NULL)`)
@Check(
  "drafting_jobs_pasted_source_check",
  `"source_kind" NOT IN ('text', 'markdown') OR "regulation_version_id" IS NOT NULL`,
)
@Check(
  "drafting_jobs_finished_check",
  `(${isOneOf("status", FINISHED_DRAFTING_JOB_STATUSES)}) = ("finished_at" IS NOT NULL)`,
)
@Check("drafting_jobs_error_check", `("status" = 'failed') = ("error_message" IS NOT NULL)`)
@Check("drafting_jobs_attempts_check", `"attempts" >= 0`)
export class DraftingJobEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "drafting_jobs_pkey" })
  id!: string;

  @Column({ name: "kind", type: "text" })
  kind!: DraftingJobKind;

  @Column({ name: "status", type: "text" })
  status!: DraftingJobStatus;

  @Column({ name: "parent_job_id", type: "uuid", nullable: true })
  parentJobId!: string | null;

  @ManyToOne(() => DraftingJobEntity, { nullable: true })
  @JoinColumn({ name: "parent_job_id", foreignKeyConstraintName: "drafting_jobs_parent_job_id_fkey" })
  parentJob!: DraftingJobEntity | null;

  @Column({ name: "source_kind", type: "text", nullable: true })
  sourceKind!: RegulationSourceKind | null;

  @Column({ name: "source_url", type: "text", nullable: true })
  sourceUrl!: string | null;

  @Column({ name: "scope", type: "text", nullable: true })
  scope!: string | null;

  @Column({ name: "version_label", type: "text", nullable: true })
  versionLabel!: string | null;

  @Column({ name: "regulation_id", type: "uuid", nullable: true })
  regulationId!: string | null;

  @ManyToOne(() => RegulationEntity, { nullable: true })
  @JoinColumn({ name: "regulation_id", foreignKeyConstraintName: "drafting_jobs_regulation_id_fkey" })
  regulation!: RegulationEntity | null;

  @Column({ name: "regulation_version_id", type: "uuid", nullable: true })
  regulationVersionId!: string | null;

  @ManyToOne(() => RegulationVersionEntity, { nullable: true })
  @JoinColumn({
    name: "regulation_version_id",
    foreignKeyConstraintName: "drafting_jobs_regulation_version_id_fkey",
  })
  regulationVersion!: RegulationVersionEntity | null;

  @Column({ name: "policy_version_id", type: "uuid", nullable: true })
  policyVersionId!: string | null;

  @ManyToOne(() => InternalPolicyVersionEntity, { nullable: true })
  @JoinColumn({ name: "policy_version_id", foreignKeyConstraintName: "drafting_jobs_policy_version_id_fkey" })
  policyVersion!: InternalPolicyVersionEntity | null;

  @Column({ name: "drafted_policy_version_ids", type: "uuid", array: true, default: () => "'{}'" })
  draftedPolicyVersionIds!: string[];

  @Column({ name: "drafted_rule_version_ids", type: "uuid", array: true, default: () => "'{}'" })
  draftedRuleVersionIds!: string[];

  @Column({ name: "warnings", type: "jsonb", default: () => "'[]'" })
  warnings!: string[];

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @Column({ name: "attempts", type: "integer", default: 0 })
  attempts!: number;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: "created_by", foreignKeyConstraintName: "drafting_jobs_created_by_fkey" })
  creator!: UserEntity;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "started_at", type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ name: "finished_at", type: "timestamptz", nullable: true })
  finishedAt!: Date | null;
}
