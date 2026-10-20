import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import type { JsonValue } from "../../../domain/json";
import { ClientEntity } from "./ClientEntity";
import { EvaluationRunEntity } from "./EvaluationRunEntity";

@Entity({ name: "alert_triage_llm_calls" })
@Index("alert_triage_llm_calls_run_id_client_id_idx", ["runId", "clientId"])
export class AlertTriageLlmCallEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "alert_triage_llm_calls_pkey" })
  id!: string;

  @Column({ name: "run_id", type: "uuid" })
  runId!: string;

  @ManyToOne(() => EvaluationRunEntity, { nullable: false })
  @JoinColumn({ name: "run_id", foreignKeyConstraintName: "alert_triage_llm_calls_run_id_fkey" })
  run!: EvaluationRunEntity;

  @Column({ name: "client_id", type: "text" })
  clientId!: string;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({
    name: "client_id",
    referencedColumnName: "clientId",
    foreignKeyConstraintName: "alert_triage_llm_calls_client_id_fkey",
  })
  client!: ClientEntity;

  @Column({ name: "model_id", type: "text" })
  modelId!: string;

  @Column({ name: "system_prompt", type: "text" })
  systemPrompt!: string;

  @Column({ name: "user_prompt", type: "text" })
  userPrompt!: string;

  @Column({ name: "response", type: "jsonb" })
  response!: JsonValue;

  @Column({ name: "input_tokens", type: "integer" })
  inputTokens!: number;

  @Column({ name: "output_tokens", type: "integer" })
  outputTokens!: number;

  @Column({ name: "duration_ms", type: "integer" })
  durationMs!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
