import {
  forgetSelectedApiModeForTests,
  getGlobalApiMode,
  getServiceMode,
  isAnyServiceMocked,
  resolveService,
  SERVICE_NAMES,
  setGlobalApiMode,
  subscribeToGlobalApiMode,
} from "./apiMode";

// The build-time env of a typical live deployment: the wizard has no API yet, so it stays mocked.
jest.mock("./env.client", () => ({
  clientEnv: { NEXT_PUBLIC_API_MODE: "live", NEXT_PUBLIC_API_MODE_WIZARD: "mock" },
}));

const STORAGE_KEY = "redflag.apiMode";

beforeEach(() => {
  window.localStorage.clear();
  forgetSelectedApiModeForTests();
});

describe("global api mode", () => {
  it("defaults to NEXT_PUBLIC_API_MODE when nothing is stored", () => {
    expect(getGlobalApiMode()).toBe("live");
  });

  it("prefers the mode stored in localStorage over the env default", () => {
    window.localStorage.setItem(STORAGE_KEY, "mock");
    expect(getGlobalApiMode()).toBe("mock");
  });

  it("ignores an invalid stored value", () => {
    window.localStorage.setItem(STORAGE_KEY, "staging");
    expect(getGlobalApiMode()).toBe("live");
  });

  it("falls back to the env default when localStorage is blocked", () => {
    const getItemSpy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      expect(getGlobalApiMode()).toBe("live");
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it("persists the selected mode and notifies subscribers once per change", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToGlobalApiMode(listener);

    setGlobalApiMode("mock");
    setGlobalApiMode("mock");
    unsubscribe();
    setGlobalApiMode("live");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("live");
  });
});

describe("service resolution", () => {
  it("mocks every service in mock mode, including services the env pins to live", () => {
    expect(SERVICE_NAMES.map((serviceName) => getServiceMode(serviceName, "mock"))).toEqual(
      SERVICE_NAMES.map(() => "mock"),
    );
    expect(isAnyServiceMocked("mock")).toBe(true);
  });

  it("keeps the per-service env overrides in live mode", () => {
    expect(getServiceMode("wizard", "live")).toBe("mock");
    expect(getServiceMode("rules", "live")).toBe("live");
    expect(getServiceMode("batches", "live")).toBe("live");
    expect(isAnyServiceMocked("live")).toBe(true);
  });

  it("resolves the implementation of the current global mode on every access", () => {
    const service = resolveService("rules", {
      mock: { source: "mock", describe: () => "mock" },
      live: { source: "live", describe: () => "live" },
    });

    expect(service.source).toBe("live");
    setGlobalApiMode("mock");
    expect(service.source).toBe("mock");
    expect(service.describe()).toBe("mock");
  });

  it("binds methods to their implementation", () => {
    const mockImplementation = {
      prefix: "mock",
      describe() {
        return this.prefix;
      },
    };
    const service = resolveService("rules", {
      mock: mockImplementation,
      live: { ...mockImplementation, prefix: "live" },
    });
    setGlobalApiMode("mock");

    const { describe } = service;
    expect(describe()).toBe("mock");
  });
});
