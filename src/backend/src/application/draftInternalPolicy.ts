import {
  findDefinedRuleIds,
  findMarkdownSection,
  findRegulationQuotes,
  findUnverifiedQuotes,
} from "../domain/policyDraftReview";
import type { PolicyDocument } from "./extractRuleCandidates";

// A regulation full text as the model reads it, e.g. a file from knowledgebase/regulace/plne-zneni.
// sourceReference is how the draft should cite the file in its header, e.g. a relative markdown link.
export type RegulationDocument = {
  title: string;
  sourceReference: string;
  body: string;
};

export type PolicyDraftingRequest = {
  regulation: RegulationDocument;
  // The part of the regulation the policy implements, e.g. "Obecný pokyn č. 11"; null means the whole text.
  scope: string | null;
  // An approved-style policy the draft imitates in structure and tone.
  examplePolicy: PolicyDocument;
  // Rule IDs continue the institution-wide numbering, so a draft never reuses an existing ID.
  firstRuleNumber: number;
};

export interface InternalPolicyDrafter {
  // Returns the draft as one markdown body, ready to be stored as an internal policy version.
  draftInternalPolicy(request: PolicyDraftingRequest): Promise<string>;
}

// The draft is a decision aid for the AML compliance officer, never an approved policy.
export type ReviewedPolicyDraft = {
  body: string;
  ruleIds: string[];
  regulationQuoteCount: number;
  unverifiedQuotes: string[];
};

export class ScopeNotFoundInRegulationError extends Error {
  constructor(scope: string, regulationTitle: string) {
    super(`No heading containing "${scope}" in "${regulationTitle}"`);
  }
}

export async function draftInternalPolicyFromRegulation(input: {
  regulation: RegulationDocument;
  scope: string | null;
  examplePolicy: PolicyDocument;
  firstRuleNumber: number;
  drafter: InternalPolicyDrafter;
}): Promise<ReviewedPolicyDraft> {
  // Narrowed before the model call: a typo in the scope costs no tokens, and a long regulation stays affordable.
  const scopedRegulation = narrowToScope(input.regulation, input.scope);

  const body = await input.drafter.draftInternalPolicy({
    regulation: scopedRegulation,
    scope: input.scope,
    examplePolicy: input.examplePolicy,
    firstRuleNumber: input.firstRuleNumber,
  });
  const regulationQuotes = findRegulationQuotes(body);

  return {
    body,
    ruleIds: findDefinedRuleIds(body),
    regulationQuoteCount: regulationQuotes.length,
    // Checked against the text the model saw, so a quote from outside the scope counts as unverified too.
    unverifiedQuotes: findUnverifiedQuotes(regulationQuotes, scopedRegulation.body),
  };
}

function narrowToScope(regulation: RegulationDocument, scope: string | null): RegulationDocument {
  if (scope === null) {
    return regulation;
  }

  const section = findMarkdownSection(regulation.body, scope);

  if (section === null) {
    throw new ScopeNotFoundInRegulationError(scope, regulation.title);
  }

  return { ...regulation, body: section };
}
