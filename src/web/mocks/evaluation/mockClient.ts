import type { RiskProfile } from "@/features/rules/types";

import { SEED_CLIENTS } from "../seed/clients";
import { calculateSeededFraction } from "../stableHash";

export type MockClient = {
  id: string;
  country: string;
  isPep: boolean;
  clientType: "natural_person" | "legal_entity" | "entrepreneur";
  riskProfile: RiskProfile;
  expectedMonthlyVolumeCzk: number;
  maxTransactionQ2Czk: number;
};

const seedClientsById = new Map(SEED_CLIENTS.map((client) => [client.id, client]));

function deriveRiskProfile(riskFraction: number): RiskProfile {
  if (riskFraction < 0.65) {
    return "low";
  }
  if (riskFraction < 0.88) {
    return "medium";
  }
  if (riskFraction < 0.97) {
    return "high";
  }
  return "unknown";
}

/**
 * Uploaded files reference clients the mock does not know. Their profile is derived deterministically from the
 * client ID so the same file always evaluates the same way.
 */
function deriveClient(clientId: string): MockClient {
  const riskFraction = calculateSeededFraction(`${clientId}:risk`);
  const volumeFraction = calculateSeededFraction(`${clientId}:volume`);
  return {
    id: clientId,
    country: "CZ",
    isPep: calculateSeededFraction(`${clientId}:pep`) < 0.01,
    clientType: "natural_person",
    riskProfile: deriveRiskProfile(riskFraction),
    expectedMonthlyVolumeCzk: Math.round(50_000 + volumeFraction * 950_000),
    maxTransactionQ2Czk: Math.round(10_000 + volumeFraction * 190_000),
  };
}

export function getMockClient(clientId: string): MockClient {
  return seedClientsById.get(clientId) ?? deriveClient(clientId);
}
