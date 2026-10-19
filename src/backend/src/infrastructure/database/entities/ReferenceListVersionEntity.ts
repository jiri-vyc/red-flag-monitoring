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

import { ReferenceListEntity } from "./ReferenceListEntity";

@Entity({ name: "reference_list_versions" })
@Unique("reference_list_versions_list_id_version_no_key", ["listId", "versionNo"])
@Check("reference_list_versions_version_no_check", `"version_no" > 0`)
export class ReferenceListVersionEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "reference_list_versions_pkey" })
  id!: string;

  @Column({ name: "list_id", type: "uuid" })
  listId!: string;

  @ManyToOne(() => ReferenceListEntity, { nullable: false })
  @JoinColumn({ name: "list_id", foreignKeyConstraintName: "reference_list_versions_list_id_fkey" })
  list!: ReferenceListEntity;

  @Column({ name: "version_no", type: "integer" })
  versionNo!: number;

  @Column({ name: "source_note", type: "text", nullable: true })
  sourceNote!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
