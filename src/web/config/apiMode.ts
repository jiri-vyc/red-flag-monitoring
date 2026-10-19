import { clientEnv, type ApiMode } from "./env.client";

export type { ApiMode };

export type ServiceName = "regulations" | "policies" | "rules" | "batches" | "wizard" | "dashboard" | "users";

export const SERVICE_NAMES: readonly ServiceName[] = [
  "regulations",
  "policies",
  "rules",
  "batches",
  "wizard",
  "dashboard",
  "users",
];

export type ServiceImplementations<TService> = Record<ApiMode, TService>;

const API_MODE_STORAGE_KEY = "redflag.apiMode";

const SERVICE_MODE_OVERRIDES: Record<ServiceName, ApiMode | undefined> = {
  regulations: clientEnv.NEXT_PUBLIC_API_MODE_REGULATIONS,
  policies: clientEnv.NEXT_PUBLIC_API_MODE_POLICIES,
  rules: clientEnv.NEXT_PUBLIC_API_MODE_RULES,
  batches: clientEnv.NEXT_PUBLIC_API_MODE_BATCHES,
  wizard: clientEnv.NEXT_PUBLIC_API_MODE_WIZARD,
  dashboard: clientEnv.NEXT_PUBLIC_API_MODE_DASHBOARD,
  users: clientEnv.NEXT_PUBLIC_API_MODE_USERS,
};

// --- Global data source (the sidebar switch). Priority: localStorage, then NEXT_PUBLIC_API_MODE, then mock. ---

let selectedApiMode: ApiMode | undefined;
const apiModeListeners = new Set<() => void>();

function isApiMode(value: unknown): value is ApiMode {
  return value === "mock" || value === "live";
}

function readStoredApiMode(): ApiMode | undefined {
  try {
    const storedValue = window.localStorage.getItem(API_MODE_STORAGE_KEY);
    return isApiMode(storedValue) ? storedValue : undefined;
  } catch {
    return undefined;
  }
}

function storeApiMode(apiMode: ApiMode): void {
  try {
    window.localStorage.setItem(API_MODE_STORAGE_KEY, apiMode);
  } catch {
    // Blocked storage only means the choice is not remembered after a reload.
  }
}

/** The build-time default. The server always renders with it, so it is also the hydration snapshot. */
export function getDefaultApiMode(): ApiMode {
  return clientEnv.NEXT_PUBLIC_API_MODE;
}

export function getGlobalApiMode(): ApiMode {
  if (typeof window === "undefined") {
    return getDefaultApiMode();
  }
  selectedApiMode ??= readStoredApiMode() ?? getDefaultApiMode();
  return selectedApiMode;
}

export function setGlobalApiMode(apiMode: ApiMode): void {
  if (apiMode === getGlobalApiMode()) {
    return;
  }
  selectedApiMode = apiMode;
  storeApiMode(apiMode);
  apiModeListeners.forEach((notifyListener) => notifyListener());
}

export function subscribeToGlobalApiMode(listener: () => void): () => void {
  apiModeListeners.add(listener);
  return () => apiModeListeners.delete(listener);
}

/** Test helper: forgets the in-memory choice so the next read starts from localStorage and env again. */
export function forgetSelectedApiModeForTests(): void {
  selectedApiMode = undefined;
}

// --- Per-service resolution ---

/**
 * Mock: every service is mocked (full demo). Live: the API, except services the env pins to a mode
 * (e.g. NEXT_PUBLIC_API_MODE_BATCHES=mock to demo CSV uploads next to live rules).
 */
export function getServiceMode(
  serviceName: ServiceName,
  globalApiMode: ApiMode = getGlobalApiMode(),
): ApiMode {
  if (globalApiMode === "mock") {
    return "mock";
  }
  return SERVICE_MODE_OVERRIDES[serviceName] ?? "live";
}

export function isAnyServiceMocked(globalApiMode: ApiMode = getGlobalApiMode()): boolean {
  return SERVICE_NAMES.some((serviceName) => getServiceMode(serviceName, globalApiMode) === "mock");
}

export function selectServiceImplementation<TService>(
  serviceName: ServiceName,
  implementations: ServiceImplementations<TService>,
  globalApiMode: ApiMode = getGlobalApiMode(),
): TService {
  return implementations[getServiceMode(serviceName, globalApiMode)];
}

/**
 * Returns a service whose every property access resolves the implementation for the current global mode,
 * so queries and mutations always hit the data source selected at call time.
 */
export function resolveService<TService extends object>(
  serviceName: ServiceName,
  implementations: ServiceImplementations<TService>,
): TService {
  return new Proxy(implementations.live, {
    get(_target, propertyKey) {
      const implementation = selectServiceImplementation(serviceName, implementations);
      const value: unknown = Reflect.get(implementation, propertyKey);
      return typeof value === "function" ? value.bind(implementation) : value;
    },
  });
}
