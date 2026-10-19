import type { MigrationInterface, QueryRunner } from "typeorm";

// Issue #6: users hold several compliance roles (users.role → users.roles) and every rule version names the
// role its hits are escalated to (E1). The demo admin, the only user so far, gets every role.
const ALL_USER_ROLES = `ARRAY['compliance_analyst', 'compliance_officer', 'lawyer', 'contact_person', 'designated_person']::text[]`;

export class UserRolesAndRuleEscalation1792451291504 implements MigrationInterface {
  name = "UserRolesAndRuleEscalation1792451291504";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_role_check"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "roles" text array`);
    await queryRunner.query(`UPDATE "users" SET "roles" = ${ALL_USER_ROLES}`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "roles" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_roles_not_empty_check" CHECK (cardinality("roles") > 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_roles_check" CHECK ("roles" <@ ${ALL_USER_ROLES})`,
    );
    // Existing versions, e.g. the seeded R-01 to R-17, are escalated to the contact person (E2).
    await queryRunner.query(
      `ALTER TABLE "rule_versions" ADD "escalation_role" text NOT NULL DEFAULT 'contact_person'`,
    );
    await queryRunner.query(
      `ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_escalation_role_check" CHECK ("escalation_role" IN ('compliance_analyst', 'compliance_officer', 'lawyer', 'contact_person', 'designated_person'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rule_versions" DROP CONSTRAINT "rule_versions_escalation_role_check"`,
    );
    await queryRunner.query(`ALTER TABLE "rule_versions" DROP COLUMN "escalation_role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_roles_check"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_roles_not_empty_check"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "role" text`);
    await queryRunner.query(`UPDATE "users" SET "role" = 'admin'`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "roles"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('admin'))`,
    );
  }
}
