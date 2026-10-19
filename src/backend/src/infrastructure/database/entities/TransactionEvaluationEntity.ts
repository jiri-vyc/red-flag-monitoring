import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";

import { AML_RISK_SCORES, type AmlRiskScore } from "../../../domain/client";
import { VERDICTS, type Verdict } from "../../../domain/evaluation";
import { MAX_SCORE, MIN_SCORE } from "../../../domain/score";
import { isBetween, isOneOf } from "../sqlChecks";
import { ClientEntity } from "./ClientEntity";
import { EvaluationRunEntity } from "./EvaluationRunEntity";
import { TransactionEntity } from "./TransactionEntity";

// TypeORM index decorators cannot express DESC, so the migration creates the max_score index by hand.
@Entity({ name: "transaction_evaluations" })
@Unique("transaction_evaluations_run_id_transaction_id_key", ["runId", "transactionId"])
@Index("transaction_evaluations_run_id_verdict_idx", ["runId", "verdict"])
@Index("transaction_evaluations_run_id_max_score_idx", { synchronize: false })
@Index("transaction_evaluations_transaction_id_idx", ["transactionId"])
@Check("transaction_evaluations_source_row_no_check", `"source_row_no" > 0`)
@Check("transaction_evaluations_client_risk_profile_check", isOneOf("client_risk_profile", AML_RISK_SCORES))
@Check("transaction_evaluations_verdict_check", isOneOf("verdict", VERDICTS))
@Check("transaction_evaluations_max_score_check", isBetween("max_score", MIN_SCORE, MAX_SCORE))
@Check("transaction_evaluations_hit_count_check", `"hit_count" >= 0`)
export class TransactionEvaluationEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "transaction_evaluations_pkey" })
  id!: string;

  @Column({ name: "run_id", type: "uuid" })
  runId!: string;

  @ManyToOne(() => EvaluationRunEntity, { nullable: false })
  @JoinColumn({ name: "run_id", foreignKeyConstraintName: "transaction_evaluations_run_id_fkey" })
  run!: EvaluationRunEntity;

  @Column({ name: "transaction_id", type: "text" })
  transactionId!: string;

  @ManyToOne(() => TransactionEntity, { nullable: false })
  @JoinColumn({
    name: "transaction_id",
    referencedColumnName: "transactionId",
    foreignKeyConstraintName: "transaction_evaluations_transaction_id_fkey",
  })
  transaction!: TransactionEntity;

  // Denormalised from transactions so run screens filter by client without a join.
  @Column({ name: "client_id", type: "text" })
  clientId!: string;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({
    name: "client_id",
    referencedColumnName: "clientId",
    foreignKeyConstraintName: "transaction_evaluations_client_id_fkey",
  })
  client!: ClientEntity;

  @Column({ name: "source_row_no", type: "integer" })
  sourceRowNo!: number;

  // V9: snapshot, the client's profile can change after the run.
  @Column({ name: "client_risk_profile", type: "text" })
  clientRiskProfile!: AmlRiskScore;

  @Column({ name: "verdict", type: "text" })
  verdict!: Verdict;

  @Column({ name: "max_score", type: "integer", default: 0 })
  maxScore!: number;

  @Column({ name: "hit_count", type: "integer", default: 0 })
  hitCount!: number;

  @Column({ name: "evaluated_at", type: "timestamptz", default: () => "now()" })
  evaluatedAt!: Date;
}
