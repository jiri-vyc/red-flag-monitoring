import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";

import {
  type LlmResponse,
  RULE_OUTCOMES,
  type RuleFeatures,
  type RuleOutcome,
  type RuleTrace,
  SCORED_RULE_OUTCOMES,
  SKIP_REASONS,
  type SkipReason,
} from "../../../domain/evaluation";
import { MAX_SCORE, MIN_SCORE } from "../../../domain/score";
import { isBetween, isOneOf } from "../sqlChecks";
import { RuleVersionEntity } from "./RuleVersionEntity";
import { TransactionEvaluationEntity } from "./TransactionEvaluationEntity";

// The checks encode the outcome table in spec/datovy-model.md: scored outcomes carry score, features and
// trace; not_applicable carries a skip reason; error carries a message.
@Entity({ name: "rule_evaluations" })
@Unique("rule_evaluations_transaction_evaluation_id_rule_version_id_key", [
  "transactionEvaluationId",
  "ruleVersionId",
])
@Index("rule_evaluations_rule_version_id_outcome_idx", ["ruleVersionId", "outcome"])
@Check("rule_evaluations_outcome_check", isOneOf("outcome", RULE_OUTCOMES))
@Check("rule_evaluations_skip_reason_check", isOneOf("skip_reason", SKIP_REASONS))
@Check("rule_evaluations_skip_check", `("outcome" = 'not_applicable') = ("skip_reason" IS NOT NULL)`)
@Check(
  "rule_evaluations_scored_check",
  `NOT (${isOneOf("outcome", SCORED_RULE_OUTCOMES)}) OR ("raw_score" IS NOT NULL AND "adjusted_score" IS NOT NULL ` +
    `AND "features" IS NOT NULL AND "trace" IS NOT NULL)`,
)
@Check("rule_evaluations_error_check", `"outcome" <> 'error' OR "error_message" IS NOT NULL`)
@Check("rule_evaluations_raw_score_check", isBetween("raw_score", MIN_SCORE, MAX_SCORE))
@Check("rule_evaluations_adjusted_score_check", isBetween("adjusted_score", MIN_SCORE, MAX_SCORE))
export class RuleEvaluationEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "rule_evaluations_pkey" })
  id!: string;

  @Column({ name: "transaction_evaluation_id", type: "uuid" })
  transactionEvaluationId!: string;

  @ManyToOne(() => TransactionEvaluationEntity, { nullable: false })
  @JoinColumn({
    name: "transaction_evaluation_id",
    foreignKeyConstraintName: "rule_evaluations_transaction_evaluation_id_fkey",
  })
  transactionEvaluation!: TransactionEvaluationEntity;

  @Column({ name: "rule_version_id", type: "uuid" })
  ruleVersionId!: string;

  @ManyToOne(() => RuleVersionEntity, { nullable: false })
  @JoinColumn({ name: "rule_version_id", foreignKeyConstraintName: "rule_evaluations_rule_version_id_fkey" })
  ruleVersion!: RuleVersionEntity;

  @Column({ name: "outcome", type: "text" })
  outcome!: RuleOutcome;

  @Column({ name: "skip_reason", type: "text", nullable: true })
  skipReason!: SkipReason | null;

  @Column({ name: "raw_score", type: "integer", nullable: true })
  rawScore!: number | null;

  @Column({ name: "adjusted_score", type: "integer", nullable: true })
  adjustedScore!: number | null;

  @Column({ name: "features", type: "jsonb", nullable: true })
  features!: RuleFeatures | null;

  @Column({ name: "trace", type: "jsonb", nullable: true })
  trace!: RuleTrace | null;

  // V8: transaction IDs the rule computed from; may be empty for pass.
  @Column({ name: "context_refs", type: "text", array: true, default: () => "'{}'" })
  contextRefs!: string[];

  @Column({ name: "llm_prompt", type: "text", nullable: true })
  llmPrompt!: string | null;

  @Column({ name: "llm_response", type: "jsonb", nullable: true })
  llmResponse!: LlmResponse | null;

  @Column({ name: "llm_model_id", type: "text", nullable: true })
  llmModelId!: string | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;
}
