import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import type { MigrationInterface, QueryRunner } from "typeorm";

// Resolves to <repo>/datasets from both src/ and dist/, which sit at the same depth under src/backend/.
const DATASETS_DIRECTORY = path.resolve(__dirname, "../../../../../../datasets");
const EXPECTED_CLIENT_COUNT = 5493;
const EXPECTED_TRANSACTION_COUNT = 397853;

const CREATE_STAGE_TABLES = `
  CREATE TEMP TABLE "stage_clients" (
    "client_id" text, "country" text, "contract_date" text, "contract_channel" text, "pep" text,
    "client_type" text, "expected_volume_czk" text, "expected_tx_count" text, "q2_volume_czk" text,
    "q2_tx_count" text, "q2_max_tx_czk" text, "aml_risk_score" text
  );
  CREATE TEMP TABLE "stage_transactions" (
    "transaction_id" text, "client_id" text, "tx_date" text, "tx_time" text, "volume" text,
    "currency" text, "payer_country" text, "payee_country" text, "payer_account" text,
    "payee_account" text, "tx_type" text
  );
`;

const INSERT_CLIENTS = `
  INSERT INTO "clients"
  SELECT
    "client_id",
    "country",
    to_date("contract_date", 'DD.MM.YYYY'),
    CASE "contract_channel" WHEN 'in person' THEN 'in_person' WHEN 'distant form' THEN 'distant' END,
    CASE "pep" WHEN 'Y' THEN true WHEN 'N' THEN false END,
    CASE "client_type"
      WHEN 'natural person' THEN 'natural_person'
      WHEN 'enterpreneur' THEN 'entrepreneur'
      WHEN 'legal entity' THEN 'legal_entity'
    END,
    "expected_volume_czk"::numeric,
    "expected_tx_count"::integer,
    "q2_volume_czk"::numeric,
    "q2_tx_count"::integer,
    "q2_max_tx_czk"::numeric,
    "aml_risk_score"
  FROM "stage_clients"
`;

const INSERT_TRANSACTIONS = `
  INSERT INTO "transactions" (
    "transaction_id", "client_id", "ts", "amount", "currency", "payer_country", "payee_country",
    "payer_account", "payee_account", "tx_type"
  )
  SELECT
    "transaction_id",
    "client_id",
    to_date("tx_date", 'DD.MM.YYYY') + "tx_time"::time,
    "volume"::numeric,
    "currency",
    "payer_country",
    "payee_country",
    "payer_account",
    "payee_account",
    CASE "tx_type"
      WHEN 'outgoing payment' THEN 'outgoing'
      WHEN 'incoming payment' THEN 'incoming'
      WHEN 'remittance' THEN 'remittance'
    END
  FROM "stage_transactions"
`;

const ASSERT_LOAD_IS_COMPLETE = `
  DO $$
  BEGIN
    IF (SELECT count(*) FROM "clients") <> ${EXPECTED_CLIENT_COUNT}
      OR (SELECT count(*) FROM "transactions") <> ${EXPECTED_TRANSACTION_COUNT}
      OR (SELECT sum("amount") FROM "transactions") <> (SELECT sum("volume"::numeric) FROM "stage_transactions")
    THEN
      RAISE EXCEPTION 'dataset load is incomplete or lossy';
    END IF;
  END $$;
`;

type CsvCopy = { queryRunner: QueryRunner; stageTable: string; fileName: string };

export class LoadDatasets1792423610381 implements MigrationInterface {
  name = "LoadDatasets1792423610381";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_STAGE_TABLES);
    await copyCsvIntoStageTable({ queryRunner, stageTable: "stage_clients", fileName: "clients.csv" });
    await copyCsvIntoStageTable({
      queryRunner,
      stageTable: "stage_transactions",
      fileName: "transactions.csv",
    });
    await queryRunner.query(INSERT_CLIENTS);
    await queryRunner.query(INSERT_TRANSACTIONS);
    await queryRunner.query(ASSERT_LOAD_IS_COMPLETE);
    await queryRunner.query(`DROP TABLE "stage_clients", "stage_transactions"`);
    await queryRunner.query(`ANALYZE "clients"`);
    await queryRunner.query(`ANALYZE "transactions"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "transactions"`);
    await queryRunner.query(`DELETE FROM "clients"`);
  }
}

async function copyCsvIntoStageTable({ queryRunner, stageTable, fileName }: CsvCopy): Promise<void> {
  const filePath = path.join(DATASETS_DIRECTORY, fileName);
  await assertDatasetFileExists(filePath);

  const connection: unknown = await queryRunner.connect();
  if (!(connection instanceof Client)) {
    throw new Error("LoadDatasets needs a node-postgres connection for COPY FROM STDIN");
  }

  const copyStream = connection.query(
    copyFrom(`COPY "${stageTable}" FROM STDIN WITH (FORMAT csv, DELIMITER ';', HEADER true)`),
  );
  await pipeline(createReadStream(filePath), copyStream);
}

async function assertDatasetFileExists(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch (cause) {
    throw new Error(`Dataset file not found: ${filePath}`, { cause });
  }
}
