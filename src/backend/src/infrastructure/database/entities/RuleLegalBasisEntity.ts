import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { RegulationVersionEntity } from "./RegulationVersionEntity";
import { RuleVersionEntity } from "./RuleVersionEntity";

@Entity({ name: "rule_legal_bases" })
@Index("rule_legal_bases_rule_version_id_idx", ["ruleVersionId"])
@Index("rule_legal_bases_regulation_version_id_idx", ["regulationVersionId"])
export class RuleLegalBasisEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "rule_legal_bases_pkey" })
  id!: string;

  @Column({ name: "rule_version_id", type: "uuid" })
  ruleVersionId!: string;

  @ManyToOne(() => RuleVersionEntity, { nullable: false })
  @JoinColumn({ name: "rule_version_id", foreignKeyConstraintName: "rule_legal_bases_rule_version_id_fkey" })
  ruleVersion!: RuleVersionEntity;

  @Column({ name: "regulation_version_id", type: "uuid" })
  regulationVersionId!: string;

  @ManyToOne(() => RegulationVersionEntity, { nullable: false })
  @JoinColumn({
    name: "regulation_version_id",
    foreignKeyConstraintName: "rule_legal_bases_regulation_version_id_fkey",
  })
  regulationVersion!: RegulationVersionEntity;

  @Column({ name: "ref", type: "text" })
  ref!: string;
}
