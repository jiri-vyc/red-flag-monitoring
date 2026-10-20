// The default caps are a proposal the compliance officer has to confirm [ROZHODNUTÍ].

export const PARAMETER_TYPES = ["amount", "window", "ratio", "count", "band_edge", "categorical"] as const;
export type ParameterType = (typeof PARAMETER_TYPES)[number];

export type RelaxationCaps = {
  maxRelativeMove: { amount: number; window: number; ratio: number };
  stepSize: { amount: number; window: number; ratio: number };
  maxCountUnits: number;
  excludedRuleCodes: string[];
  // "<rule code>:<condition id>"
  regulatoryParameters: string[];
  repetition: { minDistinctDays: number; minClients: number };
};

export type GrowthCap = {
  minAddedClients: number;
  maxRelativeGrowth: number;
  maxAddedClients: number;
};

export type AssociationCaps = {
  seedRuleCodes: string[];
  maxClientsPerPrivateAccount: number;
  minDistinctLinks: number;
  maxLinkedClients: number;
  strongFlowWindowHours: number;
  strongFlowMinAmountCzk: number;
};

export type BacktestCaps = {
  maxClientShare: number;
  maxOverlapWithExistingRule: number;
};

export type LlmBudget = {
  enabled: boolean;
  maxToolCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxWallClockMs: number;
  maxHypotheses: number;
  maxConcurrentExplanations: number;
  maxSampleClientIds: number;
};

export type RuleReviewParams = {
  caps: RelaxationCaps;
  growthCap: GrowthCap;
  association: AssociationCaps;
  backtest: BacktestCaps;
  llm: LlmBudget;
};

export const DEFAULT_RULE_REVIEW_PARAMS: RuleReviewParams = {
  caps: {
    maxRelativeMove: { amount: 0.1, window: 0.25, ratio: 0.1 },
    stepSize: { amount: 0.025, window: 0.05, ratio: 0.025 },
    maxCountUnits: 1,
    excludedRuleCodes: ["R-01"],
    regulatoryParameters: ["R-07:b"],
    repetition: { minDistinctDays: 2, minClients: 3 },
  },
  growthCap: { minAddedClients: 5, maxRelativeGrowth: 0.25, maxAddedClients: 50 },
  association: {
    seedRuleCodes: ["R-02", "R-03", "R-04", "R-11", "R-12"],
    maxClientsPerPrivateAccount: 3,
    minDistinctLinks: 2,
    maxLinkedClients: 50,
    strongFlowWindowHours: 72,
    strongFlowMinAmountCzk: 25_000,
  },
  backtest: { maxClientShare: 0.01, maxOverlapWithExistingRule: 0.8 },
  llm: {
    enabled: false,
    maxToolCalls: 20,
    maxInputTokens: 150_000,
    maxOutputTokens: 20_000,
    maxWallClockMs: 5 * 60 * 1000,
    maxHypotheses: 5,
    maxConcurrentExplanations: 3,
    maxSampleClientIds: 10,
  },
};
