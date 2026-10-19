import type { RuleCandidate } from "../domain/ruleCandidate";
import {
  extractRuleCandidatesFromPolicy,
  type PolicyDocument,
  type RuleCandidateExtractor,
  type RuleExtractionRequest,
  RuleNotFoundInPolicyError,
} from "./extractRuleCandidates";

const POLICY: PolicyDocument = {
  title: "SVZ-06 Směrnice o monitoringu plateb a remitencí",
  body: "### Čl. 12 R-14 Vysoký souhrn remitencí mimo účet\n**Pravidlo:** Alert vznikne, pokud …",
};

const RULE_CANDIDATE: RuleCandidate = {
  ruleId: "R-14",
  title: "Vysoký souhrn remitencí mimo účet",
  definition:
    "Alert, pokud součet remitencí (`tx_type` = remittance) klienta za měsíc ≥ 375 000 CZK (15 000 EUR).",
  alertGranularity: "1 alert na klienta a měsíc",
  kind: "deterministic",
  parameters: [{ name: "P08_MONTHLY_SUM", value: "375 000 CZK", source: "calibration" }],
  regulationSources: [{ regulation: "EBA/GL/2021/02", provisions: "Obecný pokyn č. 11, bod 11.5 c)" }],
  internalPolicySource: "SVZ-06, Čl. 12",
  openQuestions: [],
};

function createExtractorReturning(candidates: RuleCandidate[]): RuleCandidateExtractor & {
  requests: RuleExtractionRequest[];
} {
  const requests: RuleExtractionRequest[] = [];

  return {
    requests,
    extractRuleCandidates: async (request) => {
      requests.push(request);
      return candidates;
    },
    helloWorld: async () => "Ahoj!",
  };
}

describe("extractRuleCandidatesFromPolicy", () => {
  it("sends the whole policy and the requested rule to the extractor", async () => {
    const extractor = createExtractorReturning([]);

    await extractRuleCandidatesFromPolicy({ policy: POLICY, ruleId: "R-14", extractor });

    expect(extractor.requests).toEqual([{ policy: POLICY, ruleId: "R-14" }]);
  });

  it("returns candidates for rules the policy defines", async () => {
    const result = await extractRuleCandidatesFromPolicy({
      policy: POLICY,
      ruleId: null,
      extractor: createExtractorReturning([RULE_CANDIDATE]),
    });

    expect(result).toEqual([{ candidate: RULE_CANDIDATE, isRuleDefinedInPolicy: true }]);
  });

  it("flags candidates whose rule ID the policy does not define", async () => {
    const inventedCandidate = { ...RULE_CANDIDATE, ruleId: "R-99" };

    const result = await extractRuleCandidatesFromPolicy({
      policy: POLICY,
      ruleId: null,
      extractor: createExtractorReturning([inventedCandidate]),
    });

    expect(result).toEqual([{ candidate: inventedCandidate, isRuleDefinedInPolicy: false }]);
  });

  it("rejects an unknown rule ID without calling the extractor", async () => {
    const extractor = createExtractorReturning([]);

    await expect(
      extractRuleCandidatesFromPolicy({ policy: POLICY, ruleId: "R-99", extractor }),
    ).rejects.toThrow(RuleNotFoundInPolicyError);
    expect(extractor.requests).toEqual([]);
  });

  it("propagates extractor failures", async () => {
    const extractor: RuleCandidateExtractor = {
      extractRuleCandidates: async () => {
        throw new Error("Bedrock access denied");
      },
      helloWorld: async () => "Ahoj!",
    };

    await expect(
      extractRuleCandidatesFromPolicy({ policy: POLICY, ruleId: null, extractor }),
    ).rejects.toThrow("Bedrock access denied");
  });
});
