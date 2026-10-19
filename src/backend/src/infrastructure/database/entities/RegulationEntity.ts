import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

import { REGULATION_KINDS, type RegulationKind } from "../../../domain/regulation";
import { isOneOf } from "../sqlChecks";

@Entity({ name: "regulations" })
@Unique("regulations_code_key", ["code"])
@Check("regulations_kind_check", isOneOf("kind", REGULATION_KINDS))
export class RegulationEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "regulations_pkey" })
  id!: string;

  @Column({ name: "code", type: "text" })
  code!: string;

  @Column({ name: "title", type: "text" })
  title!: string;

  @Column({ name: "kind", type: "text" })
  kind!: RegulationKind;

  @Column({ name: "source_url", type: "text", nullable: true })
  sourceUrl!: string | null;

  @Column({ name: "checked_at", type: "timestamptz", nullable: true })
  checkedAt!: Date | null;
}
