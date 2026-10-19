import { buildRuleDefinition, type FlatRuleDefinition } from "./flatRuleDefinition";

type FlatCondition = FlatRuleDefinition["conditions"][number];

function condition(id: string, parentGroupId: string, overrides: Partial<FlatCondition> = {}): FlatCondition {
  return {
    id,
    label: `Podmínka ${id}`,
    parentGroupId,
    left: { kind: "feature", value: "month_remittance_sum_czk" },
    op: ">=",
    right: { kind: "number", value: "375000" },
    ...overrides,
  };
}

// R-14 from the sample rules: a standard limit, or a lower one for higher-risk clients (high or PEP).
const NESTED_DEFINITION: FlatRuleDefinition = {
  match: "any",
  features: ["month_remittance_sum_czk", "client_risk_score", "client_is_pep"],
  groups: [
    { id: "b", label: "Snížený limit u klienta s vyšším rizikem", parentGroupId: "root", match: "all" },
    { id: "b1", label: "Klient s vyšším rizikem", parentGroupId: "b", match: "any" },
  ],
  conditions: [
    condition("a", "root"),
    condition("b1a", "b1", {
      left: { kind: "feature", value: "client_risk_score" },
      op: "=",
      right: { kind: "text", value: "high" },
    }),
    condition("b1b", "b1", {
      left: { kind: "feature", value: "client_is_pep" },
      op: "=",
      right: { kind: "boolean", value: "true" },
    }),
    condition("b2", "b", { right: { kind: "number", value: "187500" } }),
  ],
};

describe("buildRuleDefinition", () => {
  it("builds nested groups from parent references", () => {
    expect(buildRuleDefinition(NESTED_DEFINITION)).toEqual({
      definition: {
        match: "any",
        features: ["month_remittance_sum_czk", "client_risk_score", "client_is_pep"],
        conditions: [
          {
            id: "a",
            label: "Podmínka a",
            left: { feature: "month_remittance_sum_czk" },
            op: ">=",
            right: { value: 375000 },
          },
          {
            id: "b",
            label: "Snížený limit u klienta s vyšším rizikem",
            match: "all",
            conditions: [
              {
                id: "b2",
                label: "Podmínka b2",
                left: { feature: "month_remittance_sum_czk" },
                op: ">=",
                right: { value: 187500 },
              },
              {
                id: "b1",
                label: "Klient s vyšším rizikem",
                match: "any",
                conditions: [
                  {
                    id: "b1a",
                    label: "Podmínka b1a",
                    left: { feature: "client_risk_score" },
                    op: "=",
                    right: { value: "high" },
                  },
                  {
                    id: "b1b",
                    label: "Podmínka b1b",
                    left: { feature: "client_is_pep" },
                    op: "=",
                    right: { value: true },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
  });

  it("maps expression and list operands", () => {
    const flat: FlatRuleDefinition = {
      match: "all",
      features: ["tx_amount_czk", "client_q2_max_tx_czk", "tx_payee_country"],
      groups: [],
      conditions: [
        condition("a", "root", {
          left: { kind: "feature", value: "tx_amount_czk" },
          op: ">",
          right: { kind: "expr", value: "2 × client_q2_max_tx_czk" },
        }),
        condition("b", "root", {
          left: { kind: "feature", value: "tx_payee_country" },
          op: "in",
          right: { kind: "list", value: "HRJ" },
        }),
      ],
    };

    const result = buildRuleDefinition(flat);

    expect(result).toMatchObject({
      definition: {
        conditions: [{ right: { expr: "2 × client_q2_max_tx_czk" } }, { right: { list: "HRJ" } }],
      },
    });
  });

  it("rejects a node that points at an unknown group", () => {
    const flat = { ...NESTED_DEFINITION, conditions: [condition("a", "missing")] };

    expect(buildRuleDefinition(flat)).toEqual({ violation: "Node a points at an unknown group missing" });
  });

  it("rejects groups that form a cycle", () => {
    const flat: FlatRuleDefinition = {
      match: "all",
      features: [],
      groups: [
        { id: "x", label: "X", parentGroupId: "y", match: "all" },
        { id: "y", label: "Y", parentGroupId: "x", match: "all" },
      ],
      conditions: [condition("a", "x")],
    };

    expect(buildRuleDefinition(flat)).toEqual({ violation: "Group x is part of a cycle" });
  });

  it("rejects an empty group", () => {
    const flat = {
      ...NESTED_DEFINITION,
      groups: [
        ...NESTED_DEFINITION.groups,
        { id: "c", label: "C", parentGroupId: "root", match: "all" as const },
      ],
    };

    expect(buildRuleDefinition(flat)).toEqual({ violation: "Group c has no conditions" });
  });

  it("rejects a duplicate id", () => {
    const flat = {
      ...NESTED_DEFINITION,
      conditions: [...NESTED_DEFINITION.conditions, condition("a", "root")],
    };

    expect(buildRuleDefinition(flat)).toEqual({ violation: "Node id a is used twice" });
  });

  it("rejects a number operand that is not a number", () => {
    const flat = {
      ...NESTED_DEFINITION,
      conditions: [condition("a", "root", { right: { kind: "number", value: "10 000 CZK" } })],
      groups: [],
    };

    expect(buildRuleDefinition(flat)).toEqual({ violation: 'Condition a: "10 000 CZK" is not a number' });
  });

  it("rejects a boolean operand other than true or false", () => {
    const flat = {
      ...NESTED_DEFINITION,
      conditions: [condition("a", "root", { right: { kind: "boolean", value: "Y" } })],
      groups: [],
    };

    expect(buildRuleDefinition(flat)).toEqual({ violation: 'Condition a: "Y" is not true or false' });
  });
});
