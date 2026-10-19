import { clientEnv, type ApiMode } from "./env.client";

export type ServiceName = "regulations" | "policies" | "rules" | "batches" | "wizard" | "dashboard";

export const SERVICE_NAMES: readonly ServiceName[] = [
  "regulations",
  "policies",
  "rules",
  "batches",
  "wizard",
  "dashboard",
];

const SERVICE_MODE_OVERRIDES: Record<ServiceName, ApiMode | undefined> = {
  regulations: clientEnv.NEXT_PUBLIC_API_MODE_REGULATIONS,
  policies: clientEnv.NEXT_PUBLIC_API_MODE_POLICIES,
  rules: clientEnv.NEXT_PUBLIC_API_MODE_RULES,
  batches: clientEnv.NEXT_PUBLIC_API_MODE_BATCHES,
  wizard: clientEnv.NEXT_PUBLIC_API_MODE_WIZARD,
  dashboard: clientEnv.NEXT_PUBLIC_API_MODE_DASHBOARD,
};

export function getServiceMode(serviceName: ServiceName): ApiMode {
  return SERVICE_MODE_OVERRIDES[serviceName] ?? clientEnv.NEXT_PUBLIC_API_MODE;
}

export function isAnyServiceMocked(): boolean {
  return SERVICE_NAMES.some((serviceName) => getServiceMode(serviceName) === "mock");
}

export function resolveService<TService>(
  serviceName: ServiceName,
  implementations: Record<ApiMode, TService>,
): TService {
  return implementations[getServiceMode(serviceName)];
}
