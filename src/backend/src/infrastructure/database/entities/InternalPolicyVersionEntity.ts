import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

import {
  INITIAL_VERSION_STATUSES,
  VERSION_ORIGINS,
  VERSION_STATUSES,
  type VersionOrigin,
  type VersionStatus,
} from "../../../domain/versionStatus";
import { isOneOf } from "../sqlChecks";
import { InternalPolicyEntity } from "./InternalPolicyEntity";
import { UserEntity } from "./UserEntity";

@Entity({ name: "internal_policy_versions" })
@Unique("internal_policy_versions_policy_id_version_no_key", ["policyId", "versionNo"])
@Check("internal_policy_versions_version_no_check", `"version_no" > 0`)
@Check("internal_policy_versions_status_check", isOneOf("status", VERSION_STATUSES))
@Check("internal_policy_versions_created_via_check", isOneOf("created_via", VERSION_ORIGINS))
@Check(
  "internal_policy_versions_review_check",
  `(${isOneOf("status", INITIAL_VERSION_STATUSES)}) = ("reviewed_at" IS NULL)`,
)
@Check("internal_policy_versions_reviewer_check", `("reviewed_at" IS NULL) = ("reviewed_by" IS NULL)`)
export class InternalPolicyVersionEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "internal_policy_versions_pkey" })
  id!: string;

  @Column({ name: "policy_id", type: "uuid" })
  policyId!: string;

  @ManyToOne(() => InternalPolicyEntity, { nullable: false })
  @JoinColumn({ name: "policy_id", foreignKeyConstraintName: "internal_policy_versions_policy_id_fkey" })
  policy!: InternalPolicyEntity;

  @Column({ name: "version_no", type: "integer" })
  versionNo!: number;

  @Column({ name: "body", type: "text" })
  body!: string;

  @Column({ name: "status", type: "text" })
  status!: VersionStatus;

  @Column({ name: "created_via", type: "text" })
  createdVia!: VersionOrigin;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: "created_by", foreignKeyConstraintName: "internal_policy_versions_created_by_fkey" })
  creator!: UserEntity;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "reviewed_by", type: "uuid", nullable: true })
  reviewedBy!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: "reviewed_by", foreignKeyConstraintName: "internal_policy_versions_reviewed_by_fkey" })
  reviewer!: UserEntity | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: "review_comment", type: "text", nullable: true })
  reviewComment!: string | null;
}
