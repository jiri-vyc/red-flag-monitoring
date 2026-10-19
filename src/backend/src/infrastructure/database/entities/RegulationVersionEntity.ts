import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { RegulationEntity } from "./RegulationEntity";

@Entity({ name: "regulation_versions" })
@Index("regulation_versions_regulation_id_idx", ["regulationId"])
export class RegulationVersionEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "regulation_versions_pkey" })
  id!: string;

  @Column({ name: "regulation_id", type: "uuid" })
  regulationId!: string;

  @ManyToOne(() => RegulationEntity, { nullable: false })
  @JoinColumn({ name: "regulation_id", foreignKeyConstraintName: "regulation_versions_regulation_id_fkey" })
  regulation!: RegulationEntity;

  @Column({ name: "label", type: "text" })
  label!: string;

  @Column({ name: "full_text", type: "text" })
  fullText!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
