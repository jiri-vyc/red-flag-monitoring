import { MigrationInterface, QueryRunner } from "typeorm";

export class AmlEvents1792485559732 implements MigrationInterface {
  name = "AmlEvents1792485559732";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "aml_events" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "run_id" uuid NOT NULL,
                "alert_id" text NOT NULL,
                "rule_id" uuid NOT NULL,
                "rule_version_id" uuid NOT NULL,
                "alert_type" text NOT NULL,
                "alert_granularity" text NOT NULL,
                "client_id" text NOT NULL,
                "transaction_id" text,
                "period_month" text,
                "max_score" integer NOT NULL,
                "hit_count" integer NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "aml_events_run_id_alert_id_key" UNIQUE ("run_id", "alert_id"),
                CONSTRAINT "aml_events_hit_count_check" CHECK ("hit_count" > 0),
                CONSTRAINT "aml_events_max_score_check" CHECK (
                    "max_score" BETWEEN 0 AND 100
                ),
                CONSTRAINT "aml_events_period_month_format_check" CHECK ("period_month" ~ '^[0-9]{4}-[0-9]{2}$'),
                CONSTRAINT "aml_events_period_month_check" CHECK (
                    ("alert_granularity" = 'client_month') = ("period_month" IS NOT NULL)
                ),
                CONSTRAINT "aml_events_transaction_id_check" CHECK (
                    ("alert_granularity" = 'transaction') = ("transaction_id" IS NOT NULL)
                ),
                CONSTRAINT "aml_events_alert_granularity_check" CHECK (
                    "alert_granularity" IN ('transaction', 'client_month')
                ),
                CONSTRAINT "aml_events_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "aml_events_run_id_alert_type_idx" ON "aml_events" ("run_id", "alert_type")
        `);
    await queryRunner.query(`
            CREATE INDEX "aml_events_run_id_client_id_idx" ON "aml_events" ("run_id", "client_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "aml_event_hits" (
                "aml_event_id" uuid NOT NULL,
                "rule_evaluation_id" uuid NOT NULL,
                CONSTRAINT "aml_event_hits_rule_evaluation_id_key" UNIQUE ("rule_evaluation_id"),
                CONSTRAINT "aml_event_hits_pkey" PRIMARY KEY ("aml_event_id", "rule_evaluation_id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "rules"
            ADD "alert_granularity" text NOT NULL DEFAULT 'transaction'
        `);
    await queryRunner.query(`
            ALTER TABLE "rules"
            ADD CONSTRAINT "rules_alert_granularity_check" CHECK (
                    "alert_granularity" IN ('transaction', 'client_month')
                )
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events"
            ADD CONSTRAINT "aml_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "evaluation_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events"
            ADD CONSTRAINT "aml_events_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events"
            ADD CONSTRAINT "aml_events_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events"
            ADD CONSTRAINT "aml_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events"
            ADD CONSTRAINT "aml_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_event_hits"
            ADD CONSTRAINT "aml_event_hits_aml_event_id_fkey" FOREIGN KEY ("aml_event_id") REFERENCES "aml_events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_event_hits"
            ADD CONSTRAINT "aml_event_hits_rule_evaluation_id_fkey" FOREIGN KEY ("rule_evaluation_id") REFERENCES "rule_evaluations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "aml_event_hits" DROP CONSTRAINT "aml_event_hits_rule_evaluation_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_event_hits" DROP CONSTRAINT "aml_event_hits_aml_event_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events" DROP CONSTRAINT "aml_events_transaction_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events" DROP CONSTRAINT "aml_events_client_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events" DROP CONSTRAINT "aml_events_rule_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events" DROP CONSTRAINT "aml_events_rule_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_events" DROP CONSTRAINT "aml_events_run_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rules" DROP CONSTRAINT "rules_alert_granularity_check"
        `);
    await queryRunner.query(`
            ALTER TABLE "rules" DROP COLUMN "alert_granularity"
        `);
    await queryRunner.query(`
            DROP TABLE "aml_event_hits"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."aml_events_run_id_client_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."aml_events_run_id_alert_type_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "aml_events"
        `);
  }
}
