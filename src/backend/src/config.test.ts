import { InvalidConfigError, parseAppConfig } from "./config";

const DATABASE_URL = "postgres://user:password@localhost:5434/database";

describe("parseAppConfig", () => {
  it("uses the default port when PORT is not set", () => {
    expect(parseAppConfig({ DATABASE_URL })).toEqual({ port: 4000, databaseUrl: DATABASE_URL });
  });

  it("reads PORT from the environment", () => {
    expect(parseAppConfig({ PORT: "5000", DATABASE_URL }).port).toBe(5000);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => parseAppConfig({ PORT: "abc", DATABASE_URL })).toThrow(InvalidConfigError);
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseAppConfig({})).toThrow(InvalidConfigError);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() => parseAppConfig({ DATABASE_URL: "mysql://localhost/database" })).toThrow(InvalidConfigError);
  });
});
