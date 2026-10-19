import type { MigrationInterface, QueryRunner } from "typeorm";

// M12: the MVP has no auth and one admin. API calls pass this ID as createdBy / reviewedBy.
const ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001";

export class SeedAdminUser1792430445133 implements MigrationInterface {
  name = "SeedAdminUser1792430445133";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`INSERT INTO "users" ("id", "name", "email", "role") VALUES ($1, $2, $3, $4)`, [
      ADMIN_USER_ID,
      "Demo Admin",
      "admin@example.com",
      "admin",
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE "id" = $1`, [ADMIN_USER_ID]);
  }
}
