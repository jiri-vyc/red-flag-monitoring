import { Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from "typeorm";

import { AmlEventEntity } from "./AmlEventEntity";
import { RuleEvaluationEntity } from "./RuleEvaluationEntity";

@Entity({ name: "aml_event_hits" })
@Unique("aml_event_hits_rule_evaluation_id_key", ["ruleEvaluationId"])
export class AmlEventHitEntity {
  @PrimaryColumn({ name: "aml_event_id", type: "uuid", primaryKeyConstraintName: "aml_event_hits_pkey" })
  amlEventId!: string;

  @ManyToOne(() => AmlEventEntity, { nullable: false })
  @JoinColumn({ name: "aml_event_id", foreignKeyConstraintName: "aml_event_hits_aml_event_id_fkey" })
  amlEvent!: AmlEventEntity;

  @PrimaryColumn({
    name: "rule_evaluation_id",
    type: "uuid",
    primaryKeyConstraintName: "aml_event_hits_pkey",
  })
  ruleEvaluationId!: string;

  @ManyToOne(() => RuleEvaluationEntity, { nullable: false })
  @JoinColumn({
    name: "rule_evaluation_id",
    foreignKeyConstraintName: "aml_event_hits_rule_evaluation_id_fkey",
  })
  ruleEvaluation!: RuleEvaluationEntity;
}
