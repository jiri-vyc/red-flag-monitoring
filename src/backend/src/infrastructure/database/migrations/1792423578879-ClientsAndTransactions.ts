import { MigrationInterface, QueryRunner } from "typeorm";

export class ClientsAndTransactions1792423578879 implements MigrationInterface {
  name = "ClientsAndTransactions1792423578879";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "clients" (
                "client_id" text NOT NULL,
                "country" text NOT NULL,
                "contract_date" date NOT NULL,
                "contract_channel" text NOT NULL,
                "is_pep" boolean NOT NULL,
                "client_type" text NOT NULL,
                "projected_monthly_volume_czk" numeric(14, 2) NOT NULL,
                "projected_monthly_tx_count" integer NOT NULL,
                "q2_volume_czk" numeric(14, 2) NOT NULL,
                "q2_tx_count" integer NOT NULL,
                "q2_max_tx_czk" numeric(14, 2) NOT NULL,
                "aml_risk_score" text NOT NULL,
                CONSTRAINT "clients_aml_risk_score_check" CHECK ("aml_risk_score" IN ('low', 'medium', 'high')),
                CONSTRAINT "clients_q2_max_tx_czk_check" CHECK ("q2_max_tx_czk" >= 0),
                CONSTRAINT "clients_q2_tx_count_check" CHECK ("q2_tx_count" >= 0),
                CONSTRAINT "clients_q2_volume_czk_check" CHECK ("q2_volume_czk" >= 0),
                CONSTRAINT "clients_projected_monthly_tx_count_check" CHECK ("projected_monthly_tx_count" >= 0),
                CONSTRAINT "clients_projected_monthly_volume_czk_check" CHECK ("projected_monthly_volume_czk" >= 0),
                CONSTRAINT "clients_client_type_check" CHECK (
                    "client_type" IN ('natural_person', 'entrepreneur', 'legal_entity')
                ),
                CONSTRAINT "clients_contract_channel_check" CHECK ("contract_channel" IN ('in_person', 'distant')),
                CONSTRAINT "clients_country_check" CHECK ("country" ~ '^[A-Z]{2}$'),
                CONSTRAINT "clients_client_id_check" CHECK ("client_id" ~ '^K[0-9]{6}$'),
                CONSTRAINT "clients_pkey" PRIMARY KEY ("client_id")
            )
        `);
    await queryRunner.query(
      `
            INSERT INTO "typeorm_metadata"(
                    "database",
                    "schema",
                    "table",
                    "type",
                    "name",
                    "value"
                )
            VALUES (current_database(), current_schema(), $1, $2, $3, $4)
        `,
      [
        "transactions",
        "GENERATED_COLUMN",
        "counterparty_account",
        'CASE WHEN "tx_type" = \'incoming\' THEN "payer_account" ELSE "payee_account" END',
      ],
    );
    await queryRunner.query(
      `
            INSERT INTO "typeorm_metadata"(
                    "database",
                    "schema",
                    "table",
                    "type",
                    "name",
                    "value"
                )
            VALUES (current_database(), current_schema(), $1, $2, $3, $4)
        `,
      [
        "transactions",
        "GENERATED_COLUMN",
        "counterparty_country",
        'CASE WHEN "tx_type" = \'incoming\' THEN "payer_country" ELSE "payee_country" END',
      ],
    );
    await queryRunner.query(`
            CREATE TABLE "transactions" (
                "transaction_id" text NOT NULL,
                "client_id" text NOT NULL,
                "ts" TIMESTAMP NOT NULL,
                "amount" numeric(14, 2) NOT NULL,
                "currency" text NOT NULL,
                "payer_country" text NOT NULL,
                "payee_country" text NOT NULL,
                "payer_account" text,
                "payee_account" text NOT NULL,
                "tx_type" text NOT NULL,
                "counterparty_account" text GENERATED ALWAYS AS (
                    CASE
                        WHEN "tx_type" = 'incoming' THEN "payer_account"
                        ELSE "payee_account"
                    END
                ) STORED,
                "counterparty_country" text GENERATED ALWAYS AS (
                    CASE
                        WHEN "tx_type" = 'incoming' THEN "payer_country"
                        ELSE "payee_country"
                    END
                ) STORED,
                CONSTRAINT "transactions_check2" CHECK (
                    ("tx_type" = 'remittance') = ("payer_account" IS NULL)
                ),
                CONSTRAINT "transactions_check1" CHECK (
                    "tx_type" <> 'incoming'
                    OR "payee_account" = "client_id"
                ),
                CONSTRAINT "transactions_check" CHECK (
                    "tx_type" <> 'outgoing'
                    OR "payer_account" = "client_id"
                ),
                CONSTRAINT "transactions_tx_type_check" CHECK (
                    "tx_type" IN ('outgoing', 'incoming', 'remittance')
                ),
                CONSTRAINT "transactions_payee_country_check" CHECK ("payee_country" ~ '^[A-Z]{2}$'),
                CONSTRAINT "transactions_payer_country_check" CHECK ("payer_country" ~ '^[A-Z]{2}$'),
                CONSTRAINT "transactions_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
                CONSTRAINT "transactions_amount_check" CHECK ("amount" > 0),
                CONSTRAINT "transactions_transaction_id_check" CHECK ("transaction_id" ~ '^TX[0-9]{9}$'),
                CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "transactions_ts_idx" ON "transactions" ("ts")
        `);
    await queryRunner.query(`
            CREATE INDEX "transactions_counterparty_account_ts_idx" ON "transactions" ("counterparty_account", "ts")
        `);
    await queryRunner.query(`
            CREATE INDEX "transactions_client_id_ts_idx" ON "transactions" ("client_id", "ts")
        `);
    await queryRunner.query(`
            ALTER TABLE "transactions"
            ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("client_id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "transactions" DROP CONSTRAINT "transactions_client_id_fkey"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."transactions_client_id_ts_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."transactions_counterparty_account_ts_idx"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."transactions_ts_idx"
        `);
    await queryRunner.query(`
            DROP TABLE "transactions"
        `);
    await queryRunner.query(
      `
            DELETE FROM "typeorm_metadata"
            WHERE "type" = $1
                AND "name" = $2
                AND "database" = current_database()
                AND "schema" = current_schema()
                AND "table" = $3
        `,
      ["GENERATED_COLUMN", "counterparty_country", "transactions"],
    );
    await queryRunner.query(
      `
            DELETE FROM "typeorm_metadata"
            WHERE "type" = $1
                AND "name" = $2
                AND "database" = current_database()
                AND "schema" = current_schema()
                AND "table" = $3
        `,
      ["GENERATED_COLUMN", "counterparty_account", "transactions"],
    );
    await queryRunner.query(`
            DROP TABLE "clients"
        `);
  }
}
