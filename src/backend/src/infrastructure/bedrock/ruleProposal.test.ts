import {
  mapRuleProposalToDraft,
  type RuleProposal,
  type RuleProposalContext,
  ruleProposalsJsonSchema,
} from "./ruleProposal";

const EBA_VERSION_ID = "11111111-1111-4111-8111-111111111111";
const AMLZ_VERSION_ID = "22222222-2222-4222-8222-222222222222";

type FlatDefinition = NonNullable<RuleProposal["definition"]>;

const CONDITION: FlatDefinition["conditions"][number] = {
  id: "a",
  label: "Součet remitencí ≥ 375 000 CZK",
  parentGroupId: "root",
  left: { kind: "feature", value: "month_remittance_sum_czk" },
  op: ">=",
  right: { kind: "number", value: "375000" },
};

const DEFINITION: FlatDefinition = {
  match: "all",
  features: ["month_remittance_sum_czk"],
  groups: [],
  conditions: [CONDITION],
};

// Bedrock structured outputs reject schemas with more than 16 union-typed parameters (anyOf or type arrays).
const BEDROCK_UNION_PARAMETER_LIMIT = 16;

const PROPOSAL: RuleProposal = {
  code: "R-18",
  title: "Vysoký měsíční souhrn remitencí",
  alertType: "high_remittance_sum",
  kind: "deterministic",
  isWhitelistAllowed: true,
  humanText: "Alert, pokud součet remitencí klienta za měsíc ≥ 375 000 CZK (15 000 EUR).",
  definition: DEFINITION,
  agentPrompt: null,
  priorityBase: 40,
  parameters: [{ name: "P_SUM", value: "375 000 CZK", source: "calibration" }],
  legalBases: [{ regulationCode: "EBA-GL-2021-02", ref: "Obecný pokyn č. 11, bod 11.5 c)" }],
  openQuestions: [],
};

const CONTEXT: RuleProposalContext = {
  regulationVersionIdsByCode: new Map([
    ["EBA-GL-2021-02", EBA_VERSION_ID],
    ["AMLZ", AMLZ_VERSION_ID],
  ]),
  fallbackLegalBases: [{ regulationVersionId: AMLZ_VERSION_ID, ref: "§ 6" }],
  existingRuleCodes: new Set(["R-01"]),
  agentModelId: "eu.anthropic.claude-opus-4-5-20251101-v1:0",
  createCodeSuffix: () => "abc123",
};

describe("mapRuleProposalToDraft", () => {
  it("maps a valid deterministic proposal to a rule draft scored from its priority", () => {
    expect(mapRuleProposalToDraft(PROPOSAL, CONTEXT)).toEqual({
      code: "R-18",
      alertType: "high_remittance_sum",
      kind: "deterministic",
      isWhitelistAllowed: true,
      definition: {
        match: "all",
        features: ["month_remittance_sum_czk"],
        conditions: [
          {
            id: "a",
            label: "Součet remitencí ≥ 375 000 CZK",
            left: { feature: "month_remittance_sum_czk" },
            op: ">=",
            right: { value: 375000 },
          },
        ],
      },
      agentPrompt: null,
      agentModelId: null,
      baseScore: 70,
      humanText:
        "Vysoký měsíční souhrn remitencí. Alert, pokud součet remitencí klienta za měsíc ≥ 375 000 CZK (15 000 EUR).",
      thresholdRationale: "Parametry: P_SUM = 375 000 CZK (kalibrace).",
      sensitivity: 100,
      riskProfiles: ["low", "medium", "high"],
      legalBases: [{ regulationVersionId: EBA_VERSION_ID, ref: "Obecný pokyn č. 11, bod 11.5 c)" }],
    });
  });

  it("keeps a proposal with an invalid definition as an agentic rule and says why", () => {
    const proposal: RuleProposal = {
      ...PROPOSAL,
      definition: { ...DEFINITION, features: ["unknown_feature"] },
    };

    const draft = mapRuleProposalToDraft(proposal, CONTEXT);

    expect(draft).toMatchObject({
      kind: "agentic",
      definition: null,
      baseScore: null,
      agentPrompt: PROPOSAL.humanText,
      agentModelId: CONTEXT.agentModelId,
    });
    expect(draft.thresholdRationale).toContain("unknown_feature");
  });

  it("uses the agent prompt of an agentic proposal", () => {
    const proposal: RuleProposal = {
      ...PROPOSAL,
      kind: "agentic",
      definition: null,
      agentPrompt: "Posuď, zda platby nemají ekonomický důvod.",
    };

    expect(mapRuleProposalToDraft(proposal, CONTEXT)).toMatchObject({
      kind: "agentic",
      agentPrompt: "Posuď, zda platby nemají ekonomický důvod.",
      definition: null,
      baseScore: null,
    });
  });

  it("adds a suffix to a code that already exists", () => {
    expect(mapRuleProposalToDraft({ ...PROPOSAL, code: "R-01" }, CONTEXT).code).toBe("R-01-abc123");
  });

  it("falls back to the policy legal bases when no proposed regulation is known", () => {
    const proposal = { ...PROPOSAL, legalBases: [{ regulationCode: "UNKNOWN", ref: "čl. 1" }] };

    expect(mapRuleProposalToDraft(proposal, CONTEXT).legalBases).toEqual(CONTEXT.fallbackLegalBases);
  });

  it("lists parameters and open questions for the reviewer", () => {
    const proposal = {
      ...PROPOSAL,
      parameters: [{ name: "P_LIMIT", value: "25 000 CZK (1 000 EUR)", source: "regulation" as const }],
      openQuestions: ["[ROZHODNUTÍ] Ověřit, zda remitence nejsou hrazeny z účtu."],
    };

    expect(mapRuleProposalToDraft(proposal, CONTEXT).thresholdRationale).toBe(
      "Parametry: P_LIMIT = 25 000 CZK (1 000 EUR) (regulace).\n" +
        "Otevřené otázky: [ROZHODNUTÍ] Ověřit, zda remitence nejsou hrazeny z účtu.",
    );
  });

  it("falls back to an agentic rule when the flat definition cannot be built", () => {
    const proposal: RuleProposal = {
      ...PROPOSAL,
      definition: { ...DEFINITION, conditions: [{ ...CONDITION, parentGroupId: "missing" }] },
    };

    const draft = mapRuleProposalToDraft(proposal, CONTEXT);

    expect(draft).toMatchObject({ kind: "agentic", definition: null });
    expect(draft.thresholdRationale).toContain("unknown group missing");
  });
});

describe("ruleProposalsJsonSchema", () => {
  it("stays within the Bedrock limit for union-typed parameters", () => {
    expect(countUnionParameters(ruleProposalsJsonSchema)).toBeLessThanOrEqual(BEDROCK_UNION_PARAMETER_LIMIT);
  });
});

function countUnionParameters(schema: unknown): number {
  if (Array.isArray(schema)) {
    return schema.reduce((count: number, item) => count + countUnionParameters(item), 0);
  }

  if (typeof schema !== "object" || schema === null) {
    return 0;
  }

  const ownUnions = ("anyOf" in schema ? 1 : 0) + ("type" in schema && Array.isArray(schema.type) ? 1 : 0);

  return Object.values(schema).reduce(
    (count: number, value) => count + countUnionParameters(value),
    ownUnions,
  );
}
