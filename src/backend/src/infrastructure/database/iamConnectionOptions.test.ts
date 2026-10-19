import type { IamDatabaseConfig } from "../../config";
import { createIamConnectionOptions } from "./iamConnectionOptions";

const IAM_CONFIG: IamDatabaseConfig = {
  authMode: "iam",
  host: "database-1.cluster-x.eu-central-1.rds.amazonaws.com",
  port: 5432,
  username: "postgres",
  database: "main",
  region: "eu-central-1",
};

describe("createIamConnectionOptions", () => {
  it("connects to the configured host, user and database", () => {
    const options = createIamConnectionOptions(IAM_CONFIG, async () => "token");

    expect(options).toMatchObject({
      host: IAM_CONFIG.host,
      port: 5432,
      username: "postgres",
      database: "main",
    });
  });

  it("uses a freshly generated token as the password for each connection", async () => {
    const tokens = ["first-token", "second-token"];
    const options = createIamConnectionOptions(IAM_CONFIG, async () => tokens.shift() ?? "exhausted");
    const password = options.password;

    if (typeof password !== "function") {
      throw new Error("expected a password generator");
    }

    expect(await password()).toBe("first-token");
    expect(await password()).toBe("second-token");
  });

  it("verifies the server certificate", () => {
    expect(createIamConnectionOptions(IAM_CONFIG, async () => "token").ssl).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("propagates token generation failures", async () => {
    const options = createIamConnectionOptions(IAM_CONFIG, async () => {
      throw new Error("SSO session expired");
    });
    const password = options.password;

    if (typeof password !== "function") {
      throw new Error("expected a password generator");
    }

    await expect(password()).rejects.toThrow("SSO session expired");
  });
});
