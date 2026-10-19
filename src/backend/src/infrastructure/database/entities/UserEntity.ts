import { Check, Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

import { USER_ROLES, type UserRole } from "../../../domain/user";
import { isSubsetOf } from "../sqlChecks";

@Entity({ name: "users" })
@Unique("users_email_key", ["email"])
@Check("users_roles_check", isSubsetOf("roles", USER_ROLES))
@Check("users_roles_not_empty_check", `cardinality("roles") > 0`)
export class UserEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id", primaryKeyConstraintName: "users_pkey" })
  id!: string;

  @Column({ name: "name", type: "text" })
  name!: string;

  @Column({ name: "email", type: "text" })
  email!: string;

  @Column({ name: "roles", type: "text", array: true })
  roles!: UserRole[];
}
