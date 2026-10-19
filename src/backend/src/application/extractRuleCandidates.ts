import { isRuleDefinedInPolicy } from "../domain/policyRuleSections";
import type { RuleCandidate } from "../domain/ruleCandidate";

// The policy as the model reads it: one markdown body, e.g. a version body or a knowledge-base file.
export type PolicyDocument = {
  title: string;
  body: string;
};

// ruleId null means "extract every rule the policy defines".
export type RuleExtractionRequest = {
  policy: PolicyDocument;
  ruleId: string | null;
};

export interface RuleCandidateExtractor {
  extractRuleCandidates(request: RuleExtractionRequest): Promise<RuleCandidate[]>;
  // Cheapest possible model call, to check model access and credentials before a real extraction.
  helloWorld(): Promise<string>;
}

export type ReviewedRuleCandidate = {
  candidate: RuleCandidate;
  isRuleDefinedInPolicy: boolean;
};

export class RuleNotFoundInPolicyError extends Error {
  constructor(ruleId: string, policyTitle: string) {
    super(`Rule "${ruleId}" has no section in "${policyTitle}"`);
  }
}

export async function extractRuleCandidatesFromPolicy(input: {
  policy: PolicyDocument;
  ruleId: string | null;
  extractor: RuleCandidateExtractor;
}): Promise<ReviewedRuleCandidate[]> {
  // Checked before the model call so a typo in the rule ID costs no tokens.
  if (input.ruleId !== null && !isRuleDefinedInPolicy(input.policy.body, input.ruleId)) {
    throw new RuleNotFoundInPolicyError(input.ruleId, input.policy.title);
  }

  const candidates = await input.extractor.extractRuleCandidates({
    policy: input.policy,
    ruleId: input.ruleId,
  });

  return candidates.map((candidate) => ({
    candidate,
    isRuleDefinedInPolicy: isRuleDefinedInPolicy(input.policy.body, candidate.ruleId),
  }));
}
