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
  DEFAULT_HIT_THRESHOLD,
  type ImportRowError,
  RUN_STATUSES,
  type RunStatus,
} from "../../../domain/evaluation";
import { MAX_SCORE, MIN_SCORE } from "../../../domain/score";
import { isBetween, isOneOf } from "../sqlChecks";
import { UserEntity } from "./UserEntity";

const FINISHED_RUN_STATUSES = ["completed", "failed"] as const satisfies readonly RunStatus[];

@Entity({ name: "evaluation_runs" })
@Index("evaluation_runs_created_at_idx", ["createdAt"])
@Check("evaluation_runs_status_check", isOneOf("status", RUN_STATUSES))
@Check("evaluation_runs_file_sha256_check", `"file_sha256" ~ '^[0-9a-f]{64}$'`)
@Check("evaluation_runs_hit_threshold_check", isBetween("hit_threshold", MIN_SCORE, MAX_SCORE))
@Check(
  "evaluation_runs_finished_check",
  `(${isOneOf("status", FINISHED_RUN_STATUSES)}) = ("finished_at" IS NOT NULL)`,
)
export class EvaluationRunEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "evaluation_runs_pkey" })
  id!: string;

  @Column({ name: "status", type: "text" })
  status!: RunStatus;

  @Column({ name: "file_name", type: "text" })
  fileName!: string;

  @Column({ name: "file_sha256", type: "text" })
  fileSha256!: string;

  @Column({ name: "rows_total", type: "integer", default: 0 })
  rowsTotal!: number;

  @Column({ name: "rows_imported", type: "integer", default: 0 })
  rowsImported!: number;

  @Column({ name: "rows_rejected", type: "integer", default: 0 })
  rowsRejected!: number;

  @Column({ name: "import_errors", type: "jsonb", default: () => "'[]'" })
  importErrors!: ImportRowError[];

  @Column({ name: "hit_threshold", type: "integer", default: DEFAULT_HIT_THRESHOLD })
  hitThreshold!: number;

  @Column({ name: "engine_version", type: "text" })
  engineVersion!: string;

  @Column({ name: "tx_processed", type: "integer", default: 0 })
  txProcessed!: number;

  @Column({ name: "tx_passed", type: "integer", default: 0 })
  txPassed!: number;

  @Column({ name: "tx_flagged", type: "integer", default: 0 })
  txFlagged!: number;

  @Column({ name: "tx_error", type: "integer", default: 0 })
  txError!: number;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: "created_by", foreignKeyConstraintName: "evaluation_runs_created_by_fkey" })
  creator!: UserEntity;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "finished_at", type: "timestamptz", nullable: true })
  finishedAt!: Date | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;
}
