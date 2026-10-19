import {
  draftInternalPolicyFromRegulation,
  type InternalPolicyDrafter,
  type PolicyDraftingRequest,
  type RegulationDocument,
  ScopeNotFoundInRegulationError,
} from "./draftInternalPolicy";
import type { PolicyDocument } from "./extractRuleCandidates";

const REGULATION: RegulationDocument = {
  title: "EBA/GL/2021/02",
  sourceReference: "../regulace/plne-zneni/eba-gl-2021-02-rizikove-faktory.md",
  body: [
    "# EBA/GL/2021/02",
    "## Obecný pokyn č. 10: Vydavatelé elektronických peněz",
    "10.1. Text pokynu 10.",
    "## Obecný pokyn č. 11: Poukazování peněz",
    "11.7. Transakce klienta se vždy pohybují těsně pod platnými limity.",
    "## Obecný pokyn č. 12: Správa majetku",
    "12.1. Text pokynu 12.",
  ].join("\n"),
};

const EXAMPLE_POLICY: PolicyDocument = { title: "SVZ-06", body: "### Čl. 5 R-07 Řada malých plateb" };

const DRAFT_BODY = [
  "# SVZ-07 Směrnice o monitoringu remitencí",
  "### Čl. 5 R-18 Opakované platby těsně pod limitem",
  "**Citace regulace (bod 11.7):** „Transakce klienta se vždy pohybují těsně pod platnými limity.“",
  "### Čl. 6 R-19 Vymyšlené pravidlo",
  "**Citace regulace (bod 12.1):** „Text pokynu 12.“",
].join("\n");

function createDrafterReturning(body: string): InternalPolicyDrafter & { requests: PolicyDraftingRequest[] } {
  const requests: PolicyDraftingRequest[] = [];

  return {
    requests,
    draftInternalPolicy: async (request) => {
      requests.push(request);
      return body;
    },
  };
}

describe("draftInternalPolicyFromRegulation", () => {
  it("sends only the scoped part of the regulation to the drafter", async () => {
    const drafter = createDrafterReturning(DRAFT_BODY);

    await draftInternalPolicyFromRegulation({
      regulation: REGULATION,
      scope: "Obecný pokyn č. 11",
      examplePolicy: EXAMPLE_POLICY,
      firstRuleNumber: 18,
      drafter,
    });

    expect(drafter.requests).toEqual([
      {
        regulation: {
          ...REGULATION,
          body: "## Obecný pokyn č. 11: Poukazování peněz\n11.7. Transakce klienta se vždy pohybují těsně pod platnými limity.",
        },
        scope: "Obecný pokyn č. 11",
        examplePolicy: EXAMPLE_POLICY,
        firstRuleNumber: 18,
      },
    ]);
  });

  it("sends the whole regulation when no scope is given", async () => {
    const drafter = createDrafterReturning(DRAFT_BODY);

    await draftInternalPolicyFromRegulation({
      regulation: REGULATION,
      scope: null,
      examplePolicy: EXAMPLE_POLICY,
      firstRuleNumber: 18,
      drafter,
    });

    expect(drafter.requests[0]?.regulation).toEqual(REGULATION);
  });

  it("returns the draft with its rule IDs and flags quotes the scoped regulation does not contain", async () => {
    const result = await draftInternalPolicyFromRegulation({
      regulation: REGULATION,
      scope: "Obecný pokyn č. 11",
      examplePolicy: EXAMPLE_POLICY,
      firstRuleNumber: 18,
      drafter: createDrafterReturning(DRAFT_BODY),
    });

    expect(result).toEqual({
      body: DRAFT_BODY,
      ruleIds: ["R-18", "R-19"],
      regulationQuoteCount: 2,
      unverifiedQuotes: ["Text pokynu 12."],
    });
  });

  it("rejects an unknown scope without calling the drafter", async () => {
    const drafter = createDrafterReturning(DRAFT_BODY);

    await expect(
      draftInternalPolicyFromRegulation({
        regulation: REGULATION,
        scope: "Obecný pokyn č. 99",
        examplePolicy: EXAMPLE_POLICY,
        firstRuleNumber: 18,
        drafter,
      }),
    ).rejects.toThrow(ScopeNotFoundInRegulationError);
    expect(drafter.requests).toEqual([]);
  });

  it("propagates drafter failures", async () => {
    const drafter: InternalPolicyDrafter = {
      draftInternalPolicy: async () => {
        throw new Error("Bedrock access denied");
      },
    };

    await expect(
      draftInternalPolicyFromRegulation({
        regulation: REGULATION,
        scope: null,
        examplePolicy: EXAMPLE_POLICY,
        firstRuleNumber: 18,
        drafter,
      }),
    ).rejects.toThrow("Bedrock access denied");
  });
});
