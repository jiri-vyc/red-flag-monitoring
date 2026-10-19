import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { EvaluationRunEntity } from "./EvaluationRunEntity";
import { ReferenceListVersionEntity } from "./ReferenceListVersionEntity";

// V5: the reference list versions a run was started with.
@Entity({ name: "run_reference_list_versions" })
@Index("run_reference_list_versions_list_version_id_idx", ["listVersionId"])
export class RunReferenceListVersionEntity {
  @PrimaryColumn({
    name: "run_id",
    type: "uuid",
    primaryKeyConstraintName: "run_reference_list_versions_pkey",
  })
  runId!: string;

  @ManyToOne(() => EvaluationRunEntity, { nullable: false })
  @JoinColumn({ name: "run_id", foreignKeyConstraintName: "run_reference_list_versions_run_id_fkey" })
  run!: EvaluationRunEntity;

  @PrimaryColumn({
    name: "list_version_id",
    type: "uuid",
    primaryKeyConstraintName: "run_reference_list_versions_pkey",
  })
  listVersionId!: string;

  @ManyToOne(() => ReferenceListVersionEntity, { nullable: false })
  @JoinColumn({
    name: "list_version_id",
    foreignKeyConstraintName: "run_reference_list_versions_list_version_id_fkey",
  })
  listVersion!: ReferenceListVersionEntity;
}
