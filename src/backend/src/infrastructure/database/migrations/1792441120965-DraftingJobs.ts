import { MigrationInterface, QueryRunner } from "typeorm";

export class DraftingJobs1792441120965 implements MigrationInterface {
  name = "DraftingJobs1792441120965";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "drafting_jobs" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "kind" text NOT NULL,
                "status" text NOT NULL,
                "parent_job_id" uuid,
                "source_kind" text,
                "source_url" text,
                "scope" text,
                "version_label" text,
                "regulation_id" uuid,
                "regulation_version_id" uuid,
                "policy_version_id" uuid,
                "drafted_policy_version_ids" uuid array NOT NULL DEFAULT '{}',
                "drafted_rule_version_ids" uuid array NOT NULL DEFAULT '{}',
                "warnings" jsonb NOT NULL DEFAULT '[]',
                "error_message" text,
                "attempts" integer NOT NULL DEFAULT '0',
                "created_by" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "started_at" TIMESTAMP WITH TIME ZONE,
                "finished_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "drafting_jobs_attempts_check" CHECK ("attempts" >= 0),
                CONSTRAINT "drafting_jobs_error_check" CHECK (
                    ("status" = 'failed') = ("error_message" IS NOT NULL)
                ),
                CONSTRAINT "drafting_jobs_finished_check" CHECK (
                    ("status" IN ('succeeded', 'failed')) = ("finished_at" IS NOT NULL)
                ),
                CONSTRAINT "drafting_jobs_pasted_source_check" CHECK (
                    "source_kind" NOT IN ('text', 'markdown')
                    OR "regulation_version_id" IS NOT NULL
                ),
                CONSTRAINT "drafting_jobs_source_url_check" CHECK (
                    ("source_kind" = 'url') = ("source_url" IS NOT NULL)
                ),
                CONSTRAINT "drafting_jobs_input_check" CHECK (
                    (
                        "kind" = 'policy_from_regulation'
                        AND "source_kind" IS NOT NULL
                        AND "policy_version_id" IS NULL
                    )
                    OR (
                        "kind" = 'rules_from_policy'
                        AND "source_kind" IS NULL
                        AND "policy_version_id" IS NOT NULL
                    )
                ),
                CONSTRAINT "drafting_jobs_source_kind_check" CHECK ("source_kind" IN ('text', 'markdown', 'url')),
                CONSTRAINT "drafting_jobs_status_check" CHECK (
                    "status" IN ('pending', 'running', 'succeeded', 'failed')
                ),
                CONSTRAINT "drafting_jobs_kind_check" CHECK (
                    "kind" IN ('policy_from_regulation', 'rules_from_policy')
                ),
                CONSTRAINT "drafting_jobs_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "drafting_jobs_parent_job_id_idx" ON "drafting_jobs" ("parent_job_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "drafting_jobs_policy_version_id_idx" ON "drafting_jobs" ("policy_version_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "drafting_jobs_regulation_id_idx" ON "drafting_jobs" ("regulation_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "drafting_jobs_status_idx" ON "drafting_jobs" ("status")
        `);
    await queryRunner.query(`
            CREATE INDEX "drafting_jobs_created_at_idx" ON "drafting_jobs" ("created_at")
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs"
            ADD CONSTRAINT "drafting_jobs_parent_job_id_fkey" FOREIGN KEY ("parent_job_id") REFERENCES "drafting_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs"
            ADD CONSTRAINT "drafting_jobs_regulation_id_fkey" FOREIGN KEY ("regulation_id") REFERENCES "regulations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs"
            ADD CONSTRAINT "drafting_jobs_regulation_version_id_fkey" FOREIGN KEY ("regulation_version_id") REFERENCES "regulation_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs"
            ADD CONSTRAINT "drafting_jobs_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "internal_policy_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs"
            ADD CONSTRAINT "drafting_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs" DROP CONSTRAINT "drafting_jobs_created_by_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs" DROP CONSTRAINT "drafting_jobs_policy_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs" DROP CONSTRAINT "drafting_jobs_regulation_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs" DROP CONSTRAINT "drafting_jobs_regulation_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "drafting_jobs" DROP CONSTRAINT "drafting_jobs_parent_job_id_fkey"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."drafting_jobs_created_at_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."drafting_jobs_status_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."drafting_jobs_regulation_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."drafting_jobs_policy_version_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."drafting_jobs_parent_job_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "drafting_jobs"
        `);
  }
}
