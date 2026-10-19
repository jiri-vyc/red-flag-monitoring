import { Signer } from "@aws-sdk/rds-signer";
import type { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import type { IamDatabaseConfig } from "../../config";

const IAM_CONNECT_TIMEOUT_MS = 45_000;

export type GenerateAuthToken = () => Promise<string>;

type IamConnectionOptions = Pick<
  PostgresConnectionOptions,
  "host" | "port" | "username" | "database" | "password" | "ssl" | "extra"
>;

export function createRdsAuthTokenGenerator(config: IamDatabaseConfig): GenerateAuthToken {
  const signer = new Signer({
    hostname: config.host,
    port: config.port,
    username: config.username,
    region: config.region,
  });

  return () => signer.getAuthToken();
}

export function createIamConnectionOptions(
  config: IamDatabaseConfig,
  generateAuthToken: GenerateAuthToken,
): IamConnectionOptions {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    database: config.database,
    password: generateAuthToken,
    ssl: { rejectUnauthorized: true },
    extra: { connectionTimeoutMillis: IAM_CONNECT_TIMEOUT_MS },
  };
}
