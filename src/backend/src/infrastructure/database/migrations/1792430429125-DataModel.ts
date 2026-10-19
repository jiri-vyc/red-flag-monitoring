import type { MigrationInterface, QueryRunner } from "typeorm";

export class DataModel1792430429125 implements MigrationInterface {
  name = "DataModel1792430429125";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "internal_policies" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" text NOT NULL,
                "title" text NOT NULL,
                CONSTRAINT "internal_policies_code_key" UNIQUE ("code"),
                CONSTRAINT "internal_policies_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" text NOT NULL,
                "email" text NOT NULL,
                "role" text NOT NULL,
                CONSTRAINT "users_email_key" UNIQUE ("email"),
                CONSTRAINT "users_role_check" CHECK ("role" IN ('admin')),
                CONSTRAINT "users_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "internal_policy_versions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "policy_id" uuid NOT NULL,
                "version_no" integer NOT NULL,
                "body" text NOT NULL,
                "status" text NOT NULL,
                "created_via" text NOT NULL,
                "created_by" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "reviewed_by" uuid,
                "reviewed_at" TIMESTAMP WITH TIME ZONE,
                "review_comment" text,
                CONSTRAINT "internal_policy_versions_policy_id_version_no_key" UNIQUE ("policy_id", "version_no"),
                CONSTRAINT "internal_policy_versions_reviewer_check" CHECK (
                    ("reviewed_at" IS NULL) = ("reviewed_by" IS NULL)
                ),
                CONSTRAINT "internal_policy_versions_review_check" CHECK (
                    ("status" IN ('draft', 'pending_review')) = ("reviewed_at" IS NULL)
                ),
                CONSTRAINT "internal_policy_versions_created_via_check" CHECK (
                    "created_via" IN ('wizard', 'manual', 'reg_update')
                ),
                CONSTRAINT "internal_policy_versions_status_check" CHECK (
                    "status" IN (
                        'draft',
                        'pending_review',
                        'approved',
                        'rejected',
                        'superseded'
                    )
                ),
                CONSTRAINT "internal_policy_versions_version_no_check" CHECK ("version_no" > 0),
                CONSTRAINT "internal_policy_versions_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "rule_versions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "rule_id" uuid NOT NULL,
                "version_no" integer NOT NULL,
                "derived_from_policy_version_id" uuid,
                "definition" jsonb,
                "agent_prompt" text,
                "agent_model_id" text,
                "human_text" text NOT NULL,
                "threshold_rationale" text,
                "base_score" integer,
                "sensitivity" integer NOT NULL,
                "risk_profiles" text array NOT NULL,
                "status" text NOT NULL,
                "created_via" text NOT NULL,
                "created_by" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "reviewed_by" uuid,
                "reviewed_at" TIMESTAMP WITH TIME ZONE,
                "review_comment" text,
                CONSTRAINT "rule_versions_rule_id_version_no_key" UNIQUE ("rule_id", "version_no"),
                CONSTRAINT "rule_versions_reviewer_check" CHECK (
                    ("reviewed_at" IS NULL) = ("reviewed_by" IS NULL)
                ),
                CONSTRAINT "rule_versions_review_check" CHECK (
                    ("status" IN ('draft', 'pending_review')) = ("reviewed_at" IS NULL)
                ),
                CONSTRAINT "rule_versions_created_via_check" CHECK (
                    "created_via" IN ('wizard', 'manual', 'reg_update')
                ),
                CONSTRAINT "rule_versions_status_check" CHECK (
                    "status" IN (
                        'draft',
                        'pending_review',
                        'approved',
                        'rejected',
                        'superseded'
                    )
                ),
                CONSTRAINT "rule_versions_logic_check" CHECK (
                    "definition" IS NOT NULL
                    OR (
                        "agent_prompt" IS NOT NULL
                        AND "agent_model_id" IS NOT NULL
                    )
                ),
                CONSTRAINT "rule_versions_risk_profiles_not_empty_check" CHECK (cardinality("risk_profiles") > 0),
                CONSTRAINT "rule_versions_risk_profiles_check" CHECK (
                    "risk_profiles" <@ ARRAY ['low', 'medium', 'high']::text []
                ),
                CONSTRAINT "rule_versions_sensitivity_check" CHECK (
                    "sensitivity" BETWEEN 0 AND 100
                ),
                CONSTRAINT "rule_versions_base_score_check" CHECK (
                    "base_score" BETWEEN 0 AND 100
                ),
                CONSTRAINT "rule_versions_version_no_check" CHECK ("version_no" > 0),
                CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "rules" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "policy_id" uuid,
                "code" text NOT NULL,
                "alert_type" text NOT NULL,
                "kind" text NOT NULL,
                "enabled" boolean NOT NULL DEFAULT false,
                "active_version_id" uuid,
                "whitelist_allowed" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "rules_code_key" UNIQUE ("code"),
                CONSTRAINT "rules_enabled_check" CHECK (
                    NOT "enabled"
                    OR "active_version_id" IS NOT NULL
                ),
                CONSTRAINT "rules_kind_check" CHECK ("kind" IN ('deterministic', 'agentic')),
                CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "whitelist_entries" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "rule_id" uuid NOT NULL,
                "client_id" text NOT NULL,
                "reason" text NOT NULL,
                "created_by" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "whitelist_entries_rule_id_client_id_key" UNIQUE ("rule_id", "client_id"),
                CONSTRAINT "whitelist_entries_reason_check" CHECK (btrim("reason") <> ''),
                CONSTRAINT "whitelist_entries_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "evaluation_runs" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "status" text NOT NULL,
                "file_name" text NOT NULL,
                "file_sha256" text NOT NULL,
                "rows_total" integer NOT NULL DEFAULT '0',
                "rows_imported" integer NOT NULL DEFAULT '0',
                "rows_rejected" integer NOT NULL DEFAULT '0',
                "import_errors" jsonb NOT NULL DEFAULT '[]',
                "hit_threshold" integer NOT NULL DEFAULT '50',
                "engine_version" text NOT NULL,
                "tx_processed" integer NOT NULL DEFAULT '0',
                "tx_passed" integer NOT NULL DEFAULT '0',
                "tx_flagged" integer NOT NULL DEFAULT '0',
                "tx_error" integer NOT NULL DEFAULT '0',
                "created_by" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "finished_at" TIMESTAMP WITH TIME ZONE,
                "error_message" text,
                CONSTRAINT "evaluation_runs_finished_check" CHECK (
                    ("status" IN ('completed', 'failed')) = ("finished_at" IS NOT NULL)
                ),
                CONSTRAINT "evaluation_runs_hit_threshold_check" CHECK (
                    "hit_threshold" BETWEEN 0 AND 100
                ),
                CONSTRAINT "evaluation_runs_file_sha256_check" CHECK ("file_sha256" ~ '^[0-9a-f]{64}$'),
                CONSTRAINT "evaluation_runs_status_check" CHECK (
                    "status" IN ('importing', 'running', 'completed', 'failed')
                ),
                CONSTRAINT "evaluation_runs_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "evaluation_runs_created_at_idx" ON "evaluation_runs" ("created_at")
        `);
    await queryRunner.query(`
            CREATE TABLE "transaction_evaluations" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "run_id" uuid NOT NULL,
                "transaction_id" text NOT NULL,
                "client_id" text NOT NULL,
                "source_row_no" integer NOT NULL,
                "client_risk_profile" text NOT NULL,
                "verdict" text NOT NULL,
                "max_score" integer NOT NULL DEFAULT '0',
                "hit_count" integer NOT NULL DEFAULT '0',
                "evaluated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "transaction_evaluations_run_id_transaction_id_key" UNIQUE ("run_id", "transaction_id"),
                CONSTRAINT "transaction_evaluations_hit_count_check" CHECK ("hit_count" >= 0),
                CONSTRAINT "transaction_evaluations_max_score_check" CHECK (
                    "max_score" BETWEEN 0 AND 100
                ),
                CONSTRAINT "transaction_evaluations_verdict_check" CHECK ("verdict" IN ('pass', 'flagged', 'error')),
                CONSTRAINT "transaction_evaluations_client_risk_profile_check" CHECK (
                    "client_risk_profile" IN ('low', 'medium', 'high')
                ),
                CONSTRAINT "transaction_evaluations_source_row_no_check" CHECK ("source_row_no" > 0),
                CONSTRAINT "transaction_evaluations_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "transaction_evaluations_transaction_id_idx" ON "transaction_evaluations" ("transaction_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "transaction_evaluations_run_id_verdict_idx" ON "transaction_evaluations" ("run_id", "verdict")
        `);
    // Hand-written: TypeORM index decorators cannot express DESC (entity marks it synchronize: false).
    await queryRunner.query(`
            CREATE INDEX "transaction_evaluations_run_id_max_score_idx" ON "transaction_evaluations" ("run_id", "max_score" DESC)
        `);
    await queryRunner.query(`
            CREATE TABLE "run_rule_versions" (
                "run_id" uuid NOT NULL,
                "rule_version_id" uuid NOT NULL,
                CONSTRAINT "run_rule_versions_pkey" PRIMARY KEY ("run_id", "rule_version_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "run_rule_versions_rule_version_id_idx" ON "run_rule_versions" ("rule_version_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "reference_lists" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" text NOT NULL,
                "title" text NOT NULL,
                CONSTRAINT "reference_lists_code_key" UNIQUE ("code"),
                CONSTRAINT "reference_lists_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "reference_list_versions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "list_id" uuid NOT NULL,
                "version_no" integer NOT NULL,
                "source_note" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "reference_list_versions_list_id_version_no_key" UNIQUE ("list_id", "version_no"),
                CONSTRAINT "reference_list_versions_version_no_check" CHECK ("version_no" > 0),
                CONSTRAINT "reference_list_versions_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "run_reference_list_versions" (
                "run_id" uuid NOT NULL,
                "list_version_id" uuid NOT NULL,
                CONSTRAINT "run_reference_list_versions_pkey" PRIMARY KEY ("run_id", "list_version_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "run_reference_list_versions_list_version_id_idx" ON "run_reference_list_versions" ("list_version_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "regulations" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" text NOT NULL,
                "title" text NOT NULL,
                "kind" text NOT NULL,
                "source_url" text,
                "checked_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "regulations_code_key" UNIQUE ("code"),
                CONSTRAINT "regulations_kind_check" CHECK (
                    "kind" IN ('law', 'decree', 'eu_reg', 'eu_dir', 'guidance')
                ),
                CONSTRAINT "regulations_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "regulation_versions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "regulation_id" uuid NOT NULL,
                "label" text NOT NULL,
                "full_text" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "regulation_versions_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "regulation_versions_regulation_id_idx" ON "regulation_versions" ("regulation_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "rule_legal_bases" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "rule_version_id" uuid NOT NULL,
                "regulation_version_id" uuid NOT NULL,
                "ref" text NOT NULL,
                CONSTRAINT "rule_legal_bases_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "rule_legal_bases_regulation_version_id_idx" ON "rule_legal_bases" ("regulation_version_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "rule_legal_bases_rule_version_id_idx" ON "rule_legal_bases" ("rule_version_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "rule_evaluations" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "transaction_evaluation_id" uuid NOT NULL,
                "rule_version_id" uuid NOT NULL,
                "outcome" text NOT NULL,
                "skip_reason" text,
                "raw_score" integer,
                "adjusted_score" integer,
                "features" jsonb,
                "trace" jsonb,
                "context_refs" text array NOT NULL DEFAULT '{}',
                "llm_prompt" text,
                "llm_response" jsonb,
                "llm_model_id" text,
                "error_message" text,
                CONSTRAINT "rule_evaluations_transaction_evaluation_id_rule_version_id_key" UNIQUE ("transaction_evaluation_id", "rule_version_id"),
                CONSTRAINT "rule_evaluations_adjusted_score_check" CHECK (
                    "adjusted_score" BETWEEN 0 AND 100
                ),
                CONSTRAINT "rule_evaluations_raw_score_check" CHECK (
                    "raw_score" BETWEEN 0 AND 100
                ),
                CONSTRAINT "rule_evaluations_error_check" CHECK (
                    "outcome" <> 'error'
                    OR "error_message" IS NOT NULL
                ),
                CONSTRAINT "rule_evaluations_scored_check" CHECK (
                    NOT ("outcome" IN ('pass', 'hit'))
                    OR (
                        "raw_score" IS NOT NULL
                        AND "adjusted_score" IS NOT NULL
                        AND "features" IS NOT NULL
                        AND "trace" IS NOT NULL
                    )
                ),
                CONSTRAINT "rule_evaluations_skip_check" CHECK (
                    ("outcome" = 'not_applicable') = ("skip_reason" IS NOT NULL)
                ),
                CONSTRAINT "rule_evaluations_skip_reason_check" CHECK ("skip_reason" IN ('whitelist', 'risk_profile')),
                CONSTRAINT "rule_evaluations_outcome_check" CHECK (
                    "outcome" IN ('pass', 'hit', 'not_applicable', 'error')
                ),
                CONSTRAINT "rule_evaluations_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "rule_evaluations_rule_version_id_outcome_idx" ON "rule_evaluations" ("rule_version_id", "outcome")
        `);
    await queryRunner.query(`
            CREATE TABLE "reference_list_items" (
                "list_version_id" uuid NOT NULL,
                "value" text NOT NULL,
                CONSTRAINT "reference_list_items_pkey" PRIMARY KEY ("list_version_id", "value")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "policy_legal_bases" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "policy_version_id" uuid NOT NULL,
                "regulation_version_id" uuid NOT NULL,
                "ref" text,
                CONSTRAINT "policy_legal_bases_pkey" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "policy_legal_bases_regulation_version_id_idx" ON "policy_legal_bases" ("regulation_version_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "policy_legal_bases_policy_version_id_idx" ON "policy_legal_bases" ("policy_version_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "fx_rates" (
                "currency" text NOT NULL,
                "rate_date" date NOT NULL,
                "czk_per_unit" numeric(14, 6) NOT NULL,
                "source" text NOT NULL DEFAULT 'CNB',
                CONSTRAINT "fx_rates_czk_per_unit_check" CHECK ("czk_per_unit" > 0),
                CONSTRAINT "fx_rates_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
                CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("currency", "rate_date")
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "internal_policy_versions"
            ADD CONSTRAINT "internal_policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "internal_policies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "internal_policy_versions"
            ADD CONSTRAINT "internal_policy_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "internal_policy_versions"
            ADD CONSTRAINT "internal_policy_versions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_versions"
            ADD CONSTRAINT "rule_versions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_versions"
            ADD CONSTRAINT "rule_versions_derived_from_policy_version_id_fkey" FOREIGN KEY ("derived_from_policy_version_id") REFERENCES "internal_policy_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_versions"
            ADD CONSTRAINT "rule_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_versions"
            ADD CONSTRAINT "rule_versions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rules"
            ADD CONSTRAINT "rules_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "internal_policies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rules"
            ADD CONSTRAINT "rules_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "rule_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "whitelist_entries"
            ADD CONSTRAINT "whitelist_entries_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "whitelist_entries"
            ADD CONSTRAINT "whitelist_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "whitelist_entries"
            ADD CONSTRAINT "whitelist_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "evaluation_runs"
            ADD CONSTRAINT "evaluation_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "transaction_evaluations"
            ADD CONSTRAINT "transaction_evaluations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "evaluation_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "transaction_evaluations"
            ADD CONSTRAINT "transaction_evaluations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "transaction_evaluations"
            ADD CONSTRAINT "transaction_evaluations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "run_rule_versions"
            ADD CONSTRAINT "run_rule_versions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "evaluation_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "run_rule_versions"
            ADD CONSTRAINT "run_rule_versions_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "reference_list_versions"
            ADD CONSTRAINT "reference_list_versions_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "reference_lists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "run_reference_list_versions"
            ADD CONSTRAINT "run_reference_list_versions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "evaluation_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "run_reference_list_versions"
            ADD CONSTRAINT "run_reference_list_versions_list_version_id_fkey" FOREIGN KEY ("list_version_id") REFERENCES "reference_list_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "regulation_versions"
            ADD CONSTRAINT "regulation_versions_regulation_id_fkey" FOREIGN KEY ("regulation_id") REFERENCES "regulations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_legal_bases"
            ADD CONSTRAINT "rule_legal_bases_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_legal_bases"
            ADD CONSTRAINT "rule_legal_bases_regulation_version_id_fkey" FOREIGN KEY ("regulation_version_id") REFERENCES "regulation_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_evaluations"
            ADD CONSTRAINT "rule_evaluations_transaction_evaluation_id_fkey" FOREIGN KEY ("transaction_evaluation_id") REFERENCES "transaction_evaluations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_evaluations"
            ADD CONSTRAINT "rule_evaluations_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "reference_list_items"
            ADD CONSTRAINT "reference_list_items_list_version_id_fkey" FOREIGN KEY ("list_version_id") REFERENCES "reference_list_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "policy_legal_bases"
            ADD CONSTRAINT "policy_legal_bases_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "internal_policy_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "policy_legal_bases"
            ADD CONSTRAINT "policy_legal_bases_regulation_version_id_fkey" FOREIGN KEY ("regulation_version_id") REFERENCES "regulation_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "policy_legal_bases" DROP CONSTRAINT "policy_legal_bases_regulation_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "policy_legal_bases" DROP CONSTRAINT "policy_legal_bases_policy_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "reference_list_items" DROP CONSTRAINT "reference_list_items_list_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_evaluations" DROP CONSTRAINT "rule_evaluations_rule_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_evaluations" DROP CONSTRAINT "rule_evaluations_transaction_evaluation_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_legal_bases" DROP CONSTRAINT "rule_legal_bases_regulation_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_legal_bases" DROP CONSTRAINT "rule_legal_bases_rule_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "regulation_versions" DROP CONSTRAINT "regulation_versions_regulation_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "run_reference_list_versions" DROP CONSTRAINT "run_reference_list_versions_list_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "run_reference_list_versions" DROP CONSTRAINT "run_reference_list_versions_run_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "reference_list_versions" DROP CONSTRAINT "reference_list_versions_list_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "run_rule_versions" DROP CONSTRAINT "run_rule_versions_rule_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "run_rule_versions" DROP CONSTRAINT "run_rule_versions_run_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "transaction_evaluations" DROP CONSTRAINT "transaction_evaluations_client_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "transaction_evaluations" DROP CONSTRAINT "transaction_evaluations_transaction_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "transaction_evaluations" DROP CONSTRAINT "transaction_evaluations_run_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "evaluation_runs" DROP CONSTRAINT "evaluation_runs_created_by_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "whitelist_entries" DROP CONSTRAINT "whitelist_entries_created_by_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "whitelist_entries" DROP CONSTRAINT "whitelist_entries_client_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "whitelist_entries" DROP CONSTRAINT "whitelist_entries_rule_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rules" DROP CONSTRAINT "rules_active_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rules" DROP CONSTRAINT "rules_policy_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_versions" DROP CONSTRAINT "rule_versions_reviewed_by_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_versions" DROP CONSTRAINT "rule_versions_created_by_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_versions" DROP CONSTRAINT "rule_versions_derived_from_policy_version_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "rule_versions" DROP CONSTRAINT "rule_versions_rule_id_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "internal_policy_versions" DROP CONSTRAINT "internal_policy_versions_reviewed_by_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "internal_policy_versions" DROP CONSTRAINT "internal_policy_versions_created_by_fkey"
        `);
    await queryRunner.query(`
            ALTER TABLE "internal_policy_versions" DROP CONSTRAINT "internal_policy_versions_policy_id_fkey"
        `);
    await queryRunner.query(`
            DROP TABLE "fx_rates"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."policy_legal_bases_policy_version_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."policy_legal_bases_regulation_version_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "policy_legal_bases"
        `);
    await queryRunner.query(`
            DROP TABLE "reference_list_items"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."rule_evaluations_rule_version_id_outcome_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "rule_evaluations"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."rule_legal_bases_rule_version_id_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."rule_legal_bases_regulation_version_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "rule_legal_bases"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."regulation_versions_regulation_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "regulation_versions"
        `);
    await queryRunner.query(`
            DROP TABLE "regulations"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."run_reference_list_versions_list_version_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "run_reference_list_versions"
        `);
    await queryRunner.query(`
            DROP TABLE "reference_list_versions"
        `);
    await queryRunner.query(`
            DROP TABLE "reference_lists"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."run_rule_versions_rule_version_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "run_rule_versions"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."transaction_evaluations_run_id_max_score_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."transaction_evaluations_run_id_verdict_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."transaction_evaluations_transaction_id_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "transaction_evaluations"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."evaluation_runs_created_at_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "evaluation_runs"
        `);
    await queryRunner.query(`
            DROP TABLE "whitelist_entries"
        `);
    await queryRunner.query(`
            DROP TABLE "rules"
        `);
    await queryRunner.query(`
            DROP TABLE "rule_versions"
        `);
    await queryRunner.query(`
            DROP TABLE "internal_policy_versions"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
    await queryRunner.query(`
            DROP TABLE "internal_policies"
        `);
  }
}
