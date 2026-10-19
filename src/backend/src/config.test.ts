import { InvalidConfigError, parseAppConfig } from "./config";

describe("parseAppConfig", () => {
  it("uses the default port when PORT is not set", () => {
    expect(parseAppConfig({})).toEqual({ port: 4000 });
  });

  it("reads PORT from the environment", () => {
    expect(parseAppConfig({ PORT: "5000" })).toEqual({ port: 5000 });
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => parseAppConfig({ PORT: "abc" })).toThrow(InvalidConfigError);
  });
});
