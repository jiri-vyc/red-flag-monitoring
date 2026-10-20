import { MigrationInterface, QueryRunner } from "typeorm";

export class AlertTriage1792487609959 implements MigrationInterface {
  name = "AlertTriage1792487609959";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "alert_triage_llm_calls" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "run_id" uuid NOT NULL,
                "client_id" text NOT NULL,
                "model_id" text NOT NULL,
                "system_prompt" text NOT NULL,
                "user_prompt" text NOT NULL,
                "response" jsonb NOT NULL,
                "input_tokens" integer NOT NULL,
                "output_tokens" integer NOT NULL,
                "duration_ms" integer NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "alert_triage_llm_calls_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "alert_triage_llm_calls_run_id_client_id_idx" ON "alert_triage_llm_calls" ("run_id", "client_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "aml_event_triages" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "aml_event_id" uuid NOT NULL,
                "source" text NOT NULL,
                "triage" text NOT NULL,
                "priority" integer NOT NULL,
                "priority_factors" jsonb NOT NULL,
                "reason" text NOT NULL,
                "log" jsonb NOT NULL,
                "llm_call_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "aml_event_triages_aml_event_id_source_key" UNIQUE ("aml_event_id", "source"),
                CONSTRAINT "aml_event_triages_llm_call_id_check" CHECK (("source" = 'llm') = ("llm_call_id" IS NOT NULL)),
                CONSTRAINT "aml_event_triages_priority_check" CHECK (
                    "priority" BETWEEN 0 AND 100
                ),
                CONSTRAINT "aml_event_triages_triage_check" CHECK ("triage" IN ('FP', 'REVIEW')),
                CONSTRAINT "aml_event_triages_source_check" CHECK ("source" IN ('rules', 'llm')),
                CONSTRAINT "aml_event_triages_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "alert_triage_llm_calls"
            ADD CONSTRAINT "alert_triage_llm_calls_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "evaluation_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "alert_triage_llm_calls"
            ADD CONSTRAINT "alert_triage_llm_calls_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_event_triages"
            ADD CONSTRAINT "aml_event_triages_aml_event_id_fkey" FOREIGN KEY ("aml_event_id") REFERENCES "aml_events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_event_triages"
            ADD CONSTRAINT "aml_event_triages_llm_call_id_fkey" FOREIGN KEY ("llm_call_id") REFERENCES "alert_triage_llm_calls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "aml_event_triages" DROP CONSTRAINT "aml_event_triages_llm_call_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "aml_event_triages" DROP CONSTRAINT "aml_event_triages_aml_event_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "alert_triage_llm_calls" DROP CONSTRAINT "alert_triage_llm_calls_client_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "alert_triage_llm_calls" DROP CONSTRAINT "alert_triage_llm_calls_run_id_fkey"
        `);
    await queryRunner.query(`
            DROP TABLE "aml_event_triages"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."alert_triage_llm_calls_run_id_client_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "alert_triage_llm_calls"
        `);
  }
}
