import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

import { ALERT_GRANULARITIES, type AlertGranularity } from "../../../domain/rule";
import { MAX_SCORE, MIN_SCORE } from "../../../domain/score";
import { isBetween, isOneOf } from "../sqlChecks";
import { ClientEntity } from "./ClientEntity";
import { EvaluationRunEntity } from "./EvaluationRunEntity";
import { RuleEntity } from "./RuleEntity";
import { RuleVersionEntity } from "./RuleVersionEntity";
import { TransactionEntity } from "./TransactionEntity";

// alert_type and alert_granularity are snapshots of the rule when the run grouped its hits.
@Entity({ name: "aml_events" })
@Unique("aml_events_run_id_alert_id_key", ["runId", "alertId"])
@Index("aml_events_run_id_client_id_idx", ["runId", "clientId"])
@Index("aml_events_run_id_alert_type_idx", ["runId", "alertType"])
@Check("aml_events_alert_granularity_check", isOneOf("alert_granularity", ALERT_GRANULARITIES))
@Check(
  "aml_events_transaction_id_check",
  `("alert_granularity" = 'transaction') = ("transaction_id" IS NOT NULL)`,
)
@Check(
  "aml_events_period_month_check",
  `("alert_granularity" = 'client_month') = ("period_month" IS NOT NULL)`,
)
@Check("aml_events_period_month_format_check", `"period_month" ~ '^[0-9]{4}-[0-9]{2}$'`)
@Check("aml_events_max_score_check", isBetween("max_score", MIN_SCORE, MAX_SCORE))
@Check("aml_events_hit_count_check", `"hit_count" > 0`)
export class AmlEventEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "aml_events_pkey" })
  id!: string;

  @Column({ name: "run_id", type: "uuid" })
  runId!: string;

  @ManyToOne(() => EvaluationRunEntity, { nullable: false })
  @JoinColumn({ name: "run_id", foreignKeyConstraintName: "aml_events_run_id_fkey" })
  run!: EvaluationRunEntity;

  @Column({ name: "alert_id", type: "text" })
  alertId!: string;

  @Column({ name: "rule_id", type: "uuid" })
  ruleId!: string;

  @ManyToOne(() => RuleEntity, { nullable: false })
  @JoinColumn({ name: "rule_id", foreignKeyConstraintName: "aml_events_rule_id_fkey" })
  rule!: RuleEntity;

  @Column({ name: "rule_version_id", type: "uuid" })
  ruleVersionId!: string;

  @ManyToOne(() => RuleVersionEntity, { nullable: false })
  @JoinColumn({ name: "rule_version_id", foreignKeyConstraintName: "aml_events_rule_version_id_fkey" })
  ruleVersion!: RuleVersionEntity;

  @Column({ name: "alert_type", type: "text" })
  alertType!: string;

  @Column({ name: "alert_granularity", type: "text" })
  alertGranularity!: AlertGranularity;

  @Column({ name: "client_id", type: "text" })
  clientId!: string;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({
    name: "client_id",
    referencedColumnName: "clientId",
    foreignKeyConstraintName: "aml_events_client_id_fkey",
  })
  client!: ClientEntity;

  @Column({ name: "transaction_id", type: "text", nullable: true })
  transactionId!: string | null;

  @ManyToOne(() => TransactionEntity, { nullable: true })
  @JoinColumn({
    name: "transaction_id",
    referencedColumnName: "transactionId",
    foreignKeyConstraintName: "aml_events_transaction_id_fkey",
  })
  transaction!: TransactionEntity | null;

  @Column({ name: "period_month", type: "text", nullable: true })
  periodMonth!: string | null;

  @Column({ name: "max_score", type: "integer" })
  maxScore!: number;

  @Column({ name: "hit_count", type: "integer" })
  hitCount!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
