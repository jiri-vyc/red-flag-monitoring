import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "reference_lists" })
@Unique("reference_lists_code_key", ["code"])
export class ReferenceListEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "reference_lists_pkey" })
  id!: string;

  @Column({ name: "code", type: "text" })
  code!: string;

  @Column({ name: "title", type: "text" })
  title!: string;
}
