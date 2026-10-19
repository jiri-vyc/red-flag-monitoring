import type { MigrationInterface, QueryRunner } from "typeorm";

// Baseline: pgcrypto provides gen_random_uuid() for UUID primary keys. Domain tables come in follow-up migrations.
export class InitialSchema1792422000000 implements MigrationInterface {
  name = "InitialSchema1792422000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pgcrypto"`);
  }
}
