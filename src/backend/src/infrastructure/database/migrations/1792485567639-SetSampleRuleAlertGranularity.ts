import type { MigrationInterface, QueryRunner } from "typeorm";

// Alert granularity of the sample rules by "Granularita alertu" in SVZ-03 čl. 6.1 and knowledgebase/pravidla-priklady.
// R-07 (client × payee × month) and R-09 (payee account × day) are grouped per client and month: an event
// belongs to one client, and the event lists every payee in its hits.
const CLIENT_MONTH_RULE_CODES = [
  "R-01",
  "R-04",
  "R-05",
  "R-06",
  "R-07",
  "R-08",
  "R-09",
  "R-10",
  "R-11",
  "R-12",
  "R-13",
  "R-14",
];

export class SetSampleRuleAlertGranularity1792485567639 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "rules" SET "alert_granularity" = 'client_month' WHERE "code" = ANY($1::text[])`,
      [CLIENT_MONTH_RULE_CODES],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "rules" SET "alert_granularity" = 'transaction' WHERE "code" = ANY($1::text[])`,
      [CLIENT_MONTH_RULE_CODES],
    );
  }
}
