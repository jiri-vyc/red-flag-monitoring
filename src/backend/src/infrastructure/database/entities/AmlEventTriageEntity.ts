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
  MAX_PRIORITY,
  type PriorityFactor,
  TRIAGE_DECISIONS,
  TRIAGE_SOURCES,
  type TriageDecision,
  type TriageSource,
} from "../../../domain/alertTriage";
import type { JsonValue } from "../../../domain/json";
import { isBetween, isOneOf } from "../sqlChecks";
import { AlertTriageLlmCallEntity } from "./AlertTriageLlmCallEntity";
import { AmlEventEntity } from "./AmlEventEntity";

@Entity({ name: "aml_event_triages" })
@Unique("aml_event_triages_aml_event_id_source_key", ["amlEventId", "source"])
@Check("aml_event_triages_source_check", isOneOf("source", TRIAGE_SOURCES))
@Check("aml_event_triages_triage_check", isOneOf("triage", TRIAGE_DECISIONS))
@Check("aml_event_triages_priority_check", isBetween("priority", 0, MAX_PRIORITY))
@Check("aml_event_triages_llm_call_id_check", `("source" = 'llm') = ("llm_call_id" IS NOT NULL)`)
export class AmlEventTriageEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "aml_event_triages_pkey" })
  id!: string;

  @Column({ name: "aml_event_id", type: "uuid" })
  amlEventId!: string;

  @ManyToOne(() => AmlEventEntity, { nullable: false })
  @JoinColumn({ name: "aml_event_id", foreignKeyConstraintName: "aml_event_triages_aml_event_id_fkey" })
  amlEvent!: AmlEventEntity;

  @Column({ name: "source", type: "text" })
  source!: TriageSource;

  @Column({ name: "triage", type: "text" })
  triage!: TriageDecision;

  @Column({ name: "priority", type: "integer" })
  priority!: number;

  @Column({ name: "priority_factors", type: "jsonb" })
  priorityFactors!: PriorityFactor[];

  @Column({ name: "reason", type: "text" })
  reason!: string;

  @Column({ name: "log", type: "jsonb" })
  log!: JsonValue;

  @Column({ name: "llm_call_id", type: "uuid", nullable: true })
  llmCallId!: string | null;

  @ManyToOne(() => AlertTriageLlmCallEntity, { nullable: true })
  @JoinColumn({ name: "llm_call_id", foreignKeyConstraintName: "aml_event_triages_llm_call_id_fkey" })
  llmCall!: AlertTriageLlmCallEntity | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
