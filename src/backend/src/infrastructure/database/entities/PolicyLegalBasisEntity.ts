import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { InternalPolicyVersionEntity } from "./InternalPolicyVersionEntity";
import { RegulationVersionEntity } from "./RegulationVersionEntity";

@Entity({ name: "policy_legal_bases" })
@Index("policy_legal_bases_policy_version_id_idx", ["policyVersionId"])
@Index("policy_legal_bases_regulation_version_id_idx", ["regulationVersionId"])
export class PolicyLegalBasisEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "policy_legal_bases_pkey" })
  id!: string;

  @Column({ name: "policy_version_id", type: "uuid" })
  policyVersionId!: string;

  @ManyToOne(() => InternalPolicyVersionEntity, { nullable: false })
  @JoinColumn({
    name: "policy_version_id",
    foreignKeyConstraintName: "policy_legal_bases_policy_version_id_fkey",
  })
  policyVersion!: InternalPolicyVersionEntity;

  @Column({ name: "regulation_version_id", type: "uuid" })
  regulationVersionId!: string;

  @ManyToOne(() => RegulationVersionEntity, { nullable: false })
  @JoinColumn({
    name: "regulation_version_id",
    foreignKeyConstraintName: "policy_legal_bases_regulation_version_id_fkey",
  })
  regulationVersion!: RegulationVersionEntity;

  @Column({ name: "ref", type: "text", nullable: true })
  ref!: string | null;
}
