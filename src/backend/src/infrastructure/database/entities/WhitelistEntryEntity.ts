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

import { ClientEntity } from "./ClientEntity";
import { RuleEntity } from "./RuleEntity";
import { UserEntity } from "./UserEntity";

@Entity({ name: "whitelist_entries" })
@Unique("whitelist_entries_rule_id_client_id_key", ["ruleId", "clientId"])
@Check("whitelist_entries_reason_check", `btrim("reason") <> ''`)
export class WhitelistEntryEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "whitelist_entries_pkey" })
  id!: string;

  @Column({ name: "rule_id", type: "uuid" })
  ruleId!: string;

  @ManyToOne(() => RuleEntity, { nullable: false })
  @JoinColumn({ name: "rule_id", foreignKeyConstraintName: "whitelist_entries_rule_id_fkey" })
  rule!: RuleEntity;

  @Column({ name: "client_id", type: "text" })
  clientId!: string;

  @ManyToOne(() => ClientEntity, { nullable: false })
  @JoinColumn({
    name: "client_id",
    referencedColumnName: "clientId",
    foreignKeyConstraintName: "whitelist_entries_client_id_fkey",
  })
  client!: ClientEntity;

  @Column({ name: "reason", type: "text" })
  reason!: string;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: "created_by", foreignKeyConstraintName: "whitelist_entries_created_by_fkey" })
  creator!: UserEntity;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
