import { backendUrl } from "./config";

export type BackendHealth = { isReachable: true; status: string } | { isReachable: false };

type HealthResponse = { status: string };

export async function loadBackendHealth(): Promise<BackendHealth> {
  try {
    const response = await fetch(`${backendUrl}/api/health`, { cache: "no-store" });
    if (!response.ok) {
      return { isReachable: false };
    }

    const healthResponse = (await response.json()) as HealthResponse;
    return { isReachable: true, status: healthResponse.status };
  } catch {
    // Backend down is an expected state during local development, not a bug.
    return { isReachable: false };
  }
}
