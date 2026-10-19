import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { ReferenceListVersionEntity } from "./ReferenceListVersionEntity";

@Entity({ name: "reference_list_items" })
export class ReferenceListItemEntity {
  @PrimaryColumn({
    name: "list_version_id",
    type: "uuid",
    primaryKeyConstraintName: "reference_list_items_pkey",
  })
  listVersionId!: string;

  @ManyToOne(() => ReferenceListVersionEntity, { nullable: false })
  @JoinColumn({
    name: "list_version_id",
    foreignKeyConstraintName: "reference_list_items_list_version_id_fkey",
  })
  listVersion!: ReferenceListVersionEntity;

  @PrimaryColumn({ name: "value", type: "text", primaryKeyConstraintName: "reference_list_items_pkey" })
  value!: string;
}
