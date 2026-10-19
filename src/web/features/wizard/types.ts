import type { Policy } from "@/features/policies/types";
import type { RegulationKind } from "@/features/regulations/api/dto";
import type { Regulation } from "@/features/regulations/types";

export type RegulationSource =
  { kind: "file"; file: File } | { kind: "url"; url: string } | { kind: "text"; text: string };

/**
 * The regulation the new wording belongs to: an existing one (`/wizard?regulationId=`), a new one with metadata
 * entered by the user, or a new one whose metadata the drafting job derives from the URL it loads.
 */
export type RegulationTarget =
  | { kind: "existing"; regulationId: string }
  | { kind: "new"; code: string; title: string; regulationKind: RegulationKind; sourceUrl: string | null }
  | { kind: "fromUrl"; url: string };

export type DraftPoliciesInput = {
  source: RegulationSource;
  regulation: RegulationTarget;
  /** Label of the regulation wording (M1), e.g. "znění od 1. 1. 2026". */
  versionLabel: string;
};

/** The regulation with its new wording and every internal policy drafted from it (each a `draft` version). */
export type PolicyDraftResult = { regulation: Regulation; policies: Policy[] };
