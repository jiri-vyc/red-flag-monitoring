import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { EvaluationRunEntity } from "./EvaluationRunEntity";
import { RuleVersionEntity } from "./RuleVersionEntity";

// V5: the rule versions a run was started with.
@Entity({ name: "run_rule_versions" })
@Index("run_rule_versions_rule_version_id_idx", ["ruleVersionId"])
export class RunRuleVersionEntity {
  @PrimaryColumn({ name: "run_id", type: "uuid", primaryKeyConstraintName: "run_rule_versions_pkey" })
  runId!: string;

  @ManyToOne(() => EvaluationRunEntity, { nullable: false })
  @JoinColumn({ name: "run_id", foreignKeyConstraintName: "run_rule_versions_run_id_fkey" })
  run!: EvaluationRunEntity;

  @PrimaryColumn({
    name: "rule_version_id",
    type: "uuid",
    primaryKeyConstraintName: "run_rule_versions_pkey",
  })
  ruleVersionId!: string;

  @ManyToOne(() => RuleVersionEntity, { nullable: false })
  @JoinColumn({ name: "rule_version_id", foreignKeyConstraintName: "run_rule_versions_rule_version_id_fkey" })
  ruleVersion!: RuleVersionEntity;
}
