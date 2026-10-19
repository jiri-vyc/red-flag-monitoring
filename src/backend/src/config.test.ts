import { InvalidConfigError, parseAppConfig } from "./config";

const DATABASE_URL = "postgres://user:password@localhost:5434/database";
const AURORA_URL = "postgres://postgres@database-1.cluster-x.eu-central-1.rds.amazonaws.com:5432/wip_alice";

describe("parseAppConfig", () => {
  it("uses the default port and password auth when nothing else is set", () => {
    expect(parseAppConfig({ DATABASE_URL })).toEqual({
      port: 4000,
      database: { authMode: "password", url: DATABASE_URL },
    });
  });

  it("reads PORT from the environment", () => {
    expect(parseAppConfig({ PORT: "5000", DATABASE_URL }).port).toBe(5000);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => parseAppConfig({ PORT: "abc", DATABASE_URL })).toThrow(InvalidConfigError);
  });

  it("listens on AWS_LAMBDA_HTTP_ENDPOINT instead of PORT", () => {
    const environment = { AWS_LAMBDA_HTTP_ENDPOINT: "127.0.0.1:3000", PORT: "5000", DATABASE_URL };

    expect(parseAppConfig(environment)).toMatchObject({ host: "127.0.0.1", port: 3000 });
  });

  it("rejects an AWS_LAMBDA_HTTP_ENDPOINT without a host", () => {
    expect(() => parseAppConfig({ AWS_LAMBDA_HTTP_ENDPOINT: "3000", DATABASE_URL })).toThrow(
      InvalidConfigError,
    );
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseAppConfig({})).toThrow(InvalidConfigError);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() => parseAppConfig({ DATABASE_URL: "mysql://localhost/database" })).toThrow(InvalidConfigError);
  });

  it("rejects an unknown DATABASE_AUTH", () => {
    expect(() => parseAppConfig({ DATABASE_URL, DATABASE_AUTH: "kerberos" })).toThrow(InvalidConfigError);
  });

  describe("with DATABASE_AUTH=iam", () => {
    it("splits the URL into connection parts and reads the region", () => {
      const environment = { DATABASE_URL: AURORA_URL, DATABASE_AUTH: "iam", AWS_REGION: "eu-central-1" };

      expect(parseAppConfig(environment).database).toEqual({
        authMode: "iam",
        host: "database-1.cluster-x.eu-central-1.rds.amazonaws.com",
        port: 5432,
        username: "postgres",
        database: "wip_alice",
        region: "eu-central-1",
      });
    });

    it("defaults the port to 5432", () => {
      const environment = {
        DATABASE_URL: "postgres://postgres@db.example.com/main",
        DATABASE_AUTH: "iam",
        AWS_REGION: "eu-central-1",
      };

      expect(parseAppConfig(environment).database).toMatchObject({ port: 5432 });
    });

    it("requires AWS_REGION", () => {
      expect(() => parseAppConfig({ DATABASE_URL: AURORA_URL, DATABASE_AUTH: "iam" })).toThrow(
        InvalidConfigError,
      );
    });

    it("rejects a password in DATABASE_URL", () => {
      const environment = { DATABASE_URL, DATABASE_AUTH: "iam", AWS_REGION: "eu-central-1" };

      expect(() => parseAppConfig(environment)).toThrow(InvalidConfigError);
    });

    it("requires a database name in DATABASE_URL", () => {
      const environment = {
        DATABASE_URL: "postgres://postgres@db.example.com:5432",
        DATABASE_AUTH: "iam",
        AWS_REGION: "eu-central-1",
      };

      expect(() => parseAppConfig(environment)).toThrow(InvalidConfigError);
    });
  });
});
