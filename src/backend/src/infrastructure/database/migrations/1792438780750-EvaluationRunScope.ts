import { MigrationInterface, QueryRunner } from "typeorm";

export class EvaluationRunScope1792438780750 implements MigrationInterface {
  name = "EvaluationRunScope1792438780750";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "evaluation_runs"
            ADD "scope" jsonb
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "evaluation_runs" DROP COLUMN "scope"
        `);
  }
}
