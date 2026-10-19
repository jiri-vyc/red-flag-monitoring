import { randomUUID } from "node:crypto";

import type { DraftGenerator, PolicyDraft, RuleDraft } from "../../application/drafting/draftGenerator";
import type { InternalPolicy, InternalPolicyVersion } from "../../domain/internalPolicy";
import type { Regulation, RegulationVersion } from "../../domain/regulation";
import { RISK_PROFILES } from "../../domain/rule";

const DRAFTS_PER_SOURCE = 2;
const DUMMY_THRESHOLD_CZK = 1_000_000;
const DUMMY_BASE_SCORE = 50;
const DUMMY_SENSITIVITY = 100;
const UNSPECIFIED_PROVISION = "neurčeno";

// Placeholder so the minimal flow runs end to end without an LLM. Codes get a random suffix because they
// are unique and the same regulation or policy can be drafted repeatedly.
// TODO(#1): replace draftPolicies with Bedrock generation from the regulation text.
// TODO(#2): replace draftRules with Bedrock generation from the approved policy and the feature catalogue.
export class DummyDraftGenerator implements DraftGenerator {
  draftPolicies(regulation: Regulation, version: RegulationVersion): Promise<PolicyDraft[]> {
    return Promise.resolve(
      createNumbers().map((number) => ({
        code: `${regulation.code}-SVZ-${number}-${createSuffix()}`,
        title: `[DUMMY] Interní předpis ${number} k ${regulation.title}`,
        body: `# [DUMMY] Interní předpis ${number}\n\nVygenerováno bez LLM z verze „${version.label}“ regulace ${regulation.code}.`,
        legalBases: [{ regulationVersionId: version.id, ref: UNSPECIFIED_PROVISION }],
      })),
    );
  }

  // A rule version needs a legal basis (M5), so a purely internal policy yields no drafts.
  draftRules(policy: InternalPolicy, version: InternalPolicyVersion): Promise<RuleDraft[]> {
    if (version.legalBases.length === 0) {
      return Promise.resolve([]);
    }

    const legalBases = version.legalBases.map(({ regulationVersionId, ref }) => ({
      regulationVersionId,
      ref: ref ?? UNSPECIFIED_PROVISION,
    }));

    return Promise.resolve(
      createNumbers().map((number) => ({
        code: `${policy.code}-R${number}-${createSuffix()}`,
        alertType: "DUMMY_LARGE_AMOUNT",
        kind: "deterministic",
        isWhitelistAllowed: true,
        definition: {
          match: "any",
          features: ["tx_amount_czk"],
          conditions: [
            {
              id: "amount",
              label: `Částka nad ${DUMMY_THRESHOLD_CZK} CZK`,
              left: { feature: "tx_amount_czk" },
              op: ">",
              right: { value: DUMMY_THRESHOLD_CZK },
            },
          ],
        },
        agentPrompt: null,
        agentModelId: null,
        baseScore: DUMMY_BASE_SCORE,
        humanText: `[DUMMY] Pravidlo ${number}: transakce nad ${DUMMY_THRESHOLD_CZK} CZK`,
        thresholdRationale: null,
        sensitivity: DUMMY_SENSITIVITY,
        riskProfiles: [...RISK_PROFILES],
        legalBases,
      })),
    );
  }
}

function createNumbers(): number[] {
  return Array.from({ length: DRAFTS_PER_SOURCE }, (_, index) => index + 1);
}

function createSuffix(): string {
  return randomUUID().slice(0, 6);
}
