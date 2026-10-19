import { getWizardCapabilities } from "./service";

// Rules pinned to mock while the rest is live: the wizard would write live regulations and mock rules.
jest.mock("@/config/env.client", () => ({
  clientEnv: { NEXT_PUBLIC_API_MODE: "live", NEXT_PUBLIC_API_MODE_RULES: "mock" },
}));

describe("getWizardCapabilities", () => {
  it("hides the wizard when one of the sections it writes uses another data source", () => {
    expect(getWizardCapabilities("live").isAvailable).toBe(false);
  });

  it("shows the full mock wizard when every service is mocked", () => {
    expect(getWizardCapabilities("mock")).toEqual({
      isAvailable: true,
      canFetchUrl: true,
    });
  });
});
