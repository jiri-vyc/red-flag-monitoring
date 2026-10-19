import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "internal_policies" })
@Unique("internal_policies_code_key", ["code"])
export class InternalPolicyEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "internal_policies_pkey" })
  id!: string;

  @Column({ name: "code", type: "text" })
  code!: string;

  @Column({ name: "title", type: "text" })
  title!: string;
}
