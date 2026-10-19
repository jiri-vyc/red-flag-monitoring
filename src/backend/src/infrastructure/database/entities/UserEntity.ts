import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

import { USER_ROLES, type UserRole } from "../../../domain/user";
import { isOneOf } from "../sqlChecks";

@Entity({ name: "users" })
@Unique("users_email_key", ["email"])
@Check("users_role_check", isOneOf("role", USER_ROLES))
export class UserEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "users_pkey" })
  id!: string;

  @Column({ name: "name", type: "text" })
  name!: string;

  @Column({ name: "email", type: "text" })
  email!: string;

  @Column({ name: "role", type: "text" })
  role!: UserRole;
}
