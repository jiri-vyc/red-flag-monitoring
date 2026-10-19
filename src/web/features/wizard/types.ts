import type { Policy } from "@/features/policies/types";
import type { Regulation } from "@/features/regulations/types";

export type RegulationSource =
  { kind: "file"; file: File } | { kind: "url"; url: string } | { kind: "text"; text: string };

export type GeneratePolicyInput = { source: RegulationSource; regulationName: string };

export type PolicyDraftResult = { regulation: Regulation; policy: Policy };
