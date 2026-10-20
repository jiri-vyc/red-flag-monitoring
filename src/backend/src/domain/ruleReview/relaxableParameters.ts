import type { DeterministicRunRuleVersion } from "../evaluateTransaction";
import { findFeatureDefinition } from "../features/featureCatalog";
import type { FeatureParameterName, FeatureParameters } from "../features/featureParameters";
import {
  isConditionGroup,
  listConditionNodes,
  parseScaledFeature,
  type RuleCondition,
  type RuleConditionNode,
  type RuleDefinition,
} from "../ruleDefinition";
import type { ParameterType, RelaxationCaps } from "./ruleReviewParams";

export type RelaxationDirection = "decrease" | "increase";

type ParameterBase = {
  key: string;
  label: string;
  parameterType: ParameterType;
  direction: RelaxationDirection;
  currentValue: number;
  isRegulatory: boolean;
};

export type ConditionParameter = ParameterBase & {
  source: "condition";
  conditionId: string;
  operand: "value" | "multiplier";
};

export type FeatureParameter = ParameterBase & { source: "feature"; name: FeatureParameterName };

export type RelaxableParameter = ConditionParameter | FeatureParameter;

export type RelaxationStep = { step: number; value: number };

type FeatureParameterSpec = {
  label: string;
  parameterType: ParameterType;
  direction: RelaxationDirection;
  featureIds: string[];
};

const PASSTHROUGH_FEATURES = ["passthrough_in_24h_czk", "passthrough_out_6h_czk", "passthrough_ratio"];
const SMALL_PAYMENT_FEATURES = ["payee_small_out_count_7d", "payee_small_out_sum_7d_czk"];

// Band edges, never relaxed (spec 3.1): widening the R-07 or R-08 band is a new rule.
const FEATURE_PARAMETER_SPECS: Record<FeatureParameterName, FeatureParameterSpec> = {
  smallPaymentWindowDays: {
    label: "okno malých plateb stejnému příjemci (dny)",
    parameterType: "window",
    direction: "increase",
    featureIds: SMALL_PAYMENT_FEATURES,
  },
  smallPaymentMaxCzk: {
    label: "horní mez malé platby (CZK)",
    parameterType: "band_edge",
    direction: "increase",
    featureIds: SMALL_PAYMENT_FEATURES,
  },
  nearLimitWindowDays: {
    label: "okno plateb těsně pod limitem (dny)",
    parameterType: "window",
    direction: "increase",
    featureIds: ["near_limit_tx_count_7d"],
  },
  nearLimitLowerCzk: {
    label: "spodní mez pásma těsně pod limitem (CZK)",
    parameterType: "band_edge",
    direction: "decrease",
    featureIds: ["near_limit_tx_count_7d"],
  },
  nearLimitUpperCzk: {
    label: "horní mez pásma těsně pod limitem (CZK)",
    parameterType: "band_edge",
    direction: "increase",
    featureIds: ["near_limit_tx_count_7d"],
  },
  quickForwardWindowHours: {
    label: "okno přeposlání (hodiny)",
    parameterType: "window",
    direction: "increase",
    featureIds: ["quick_forward_match_count"],
  },
  quickForwardMinAmountCzk: {
    label: "minimální přeposílaná příchozí platba (CZK)",
    parameterType: "amount",
    direction: "decrease",
    featureIds: ["quick_forward_match_count"],
  },
  quickForwardMinRatio: {
    label: "spodní mez poměru přeposlané částky",
    parameterType: "ratio",
    direction: "decrease",
    featureIds: ["quick_forward_match_count"],
  },
  quickForwardMaxRatio: {
    label: "horní mez poměru přeposlané částky",
    parameterType: "ratio",
    direction: "increase",
    featureIds: ["quick_forward_match_count"],
  },
  roundTripWindowHours: {
    label: "okno kruhové platby (hodiny)",
    parameterType: "window",
    direction: "increase",
    featureIds: ["round_trip_match_count_72h"],
  },
  roundTripMinAmountCzk: {
    label: "minimální částka kruhové platby (CZK)",
    parameterType: "amount",
    direction: "decrease",
    featureIds: ["round_trip_match_count_72h"],
  },
  passthroughInflowWindowHours: {
    label: "okno přijaté částky průtoku (hodiny)",
    parameterType: "window",
    direction: "increase",
    featureIds: PASSTHROUGH_FEATURES,
  },
  passthroughOutflowWindowHours: {
    label: "okno odeslání průtoku (hodiny)",
    parameterType: "window",
    direction: "increase",
    featureIds: PASSTHROUGH_FEATURES,
  },
  passthroughMinInflowCzk: {
    label: "minimální přijatá částka průtoku (CZK)",
    parameterType: "amount",
    direction: "decrease",
    featureIds: PASSTHROUGH_FEATURES,
  },
};

const RELAXABLE_TYPES = new Set<ParameterType>(["amount", "window", "ratio", "count"]);
const UNIT_PARAMETER_TYPES: Record<string, ParameterType> = {
  CZK: "amount",
  count: "count",
  ratio: "ratio",
  // Tenure features count whole months, so a relative step below one month redraws the same boundary.
  months: "count",
};
const DECREASING_OPERATORS = new Set([">", ">="]);
const INCREASING_OPERATORS = new Set(["<", "<="]);
const AMOUNT_DECIMALS = 100;
const RATIO_DECIMALS = 10_000;
const STEP_TOLERANCE = 1e-9;

export function listRelaxableParameters(input: {
  ruleVersion: DeterministicRunRuleVersion;
  featureParameters: Readonly<FeatureParameters>;
  caps: RelaxationCaps;
}): RelaxableParameter[] {
  const { ruleVersion, caps } = input;
  const conditionParameters = listConditionNodes(ruleVersion.definition.conditions)
    .filter((node): node is RuleCondition => !isConditionGroup(node))
    .map((condition) => toConditionParameter(condition, ruleVersion.ruleCode, caps))
    .filter((parameter): parameter is ConditionParameter => parameter !== null);
  const featureParameters = (Object.keys(FEATURE_PARAMETER_SPECS) as FeatureParameterName[])
    .filter((name) =>
      FEATURE_PARAMETER_SPECS[name].featureIds.some((featureId) =>
        ruleVersion.definition.features.includes(featureId),
      ),
    )
    .map((name) => toFeatureParameter(name, input.featureParameters[name]));

  return [...conditionParameters, ...featureParameters].filter((parameter) =>
    RELAXABLE_TYPES.has(parameter.parameterType),
  );
}

export function listRelaxationSteps(parameter: RelaxableParameter, caps: RelaxationCaps): RelaxationStep[] {
  if (parameter.parameterType === "count") {
    return listCountSteps(parameter, caps.maxCountUnits);
  }

  if (!isRelativeType(parameter.parameterType)) {
    return [];
  }

  const stepSize = caps.stepSize[parameter.parameterType];
  const stepCount = Math.floor(caps.maxRelativeMove[parameter.parameterType] / stepSize + STEP_TOLERANCE);

  return Array.from({ length: stepCount }, (_, index) => {
    const step = roundRatio((index + 1) * stepSize);

    return { step, value: moveValue(parameter, step) };
  });
}

export function relaxDefinition(
  definition: RuleDefinition,
  parameter: ConditionParameter,
  value: number,
): RuleDefinition {
  return {
    ...definition,
    conditions: definition.conditions.map((node) => relaxNode(node, parameter, value)),
  };
}

export function relaxFeatureParameters(
  featureParameters: Readonly<FeatureParameters>,
  parameter: FeatureParameter,
  value: number,
): FeatureParameters {
  return { ...featureParameters, [parameter.name]: value };
}

function toConditionParameter(
  condition: RuleCondition,
  ruleCode: string,
  caps: RelaxationCaps,
): ConditionParameter | null {
  const direction = findDirection(condition);
  const featureId = "feature" in condition.left ? condition.left.feature : null;

  if (!direction || !featureId) {
    return null;
  }

  const base = {
    source: "condition" as const,
    key: `condition:${condition.id}`,
    label: condition.label,
    conditionId: condition.id,
    direction,
    isRegulatory: caps.regulatoryParameters.includes(`${ruleCode}:${condition.id}`),
  };

  if ("value" in condition.right && typeof condition.right.value === "number") {
    const unit = findFeatureDefinition(featureId)?.unit ?? null;
    const parameterType = unit ? (UNIT_PARAMETER_TYPES[unit] ?? "categorical") : "categorical";

    return { ...base, operand: "value", parameterType, currentValue: condition.right.value };
  }

  if ("expr" in condition.right) {
    const scaledFeature = parseScaledFeature(condition.right.expr);

    return scaledFeature
      ? { ...base, operand: "multiplier", parameterType: "ratio", currentValue: scaledFeature.multiplier }
      : null;
  }

  return null;
}

function toFeatureParameter(name: FeatureParameterName, currentValue: number): FeatureParameter {
  const { label, parameterType, direction } = FEATURE_PARAMETER_SPECS[name];

  return {
    source: "feature",
    key: `feature:${name}`,
    name,
    label,
    parameterType,
    direction,
    currentValue,
    isRegulatory: false,
  };
}

function findDirection(condition: RuleCondition): RelaxationDirection | null {
  if (DECREASING_OPERATORS.has(condition.op)) {
    return "decrease";
  }

  return INCREASING_OPERATORS.has(condition.op) ? "increase" : null;
}

function listCountSteps(parameter: RelaxableParameter, maxCountUnits: number): RelaxationStep[] {
  const sign = parameter.direction === "decrease" ? -1 : 1;

  return Array.from({ length: maxCountUnits }, (_, index) => parameter.currentValue + sign * (index + 1))
    .filter((value) => value > 0)
    .map((value) => ({
      step: roundRatio(Math.abs(value - parameter.currentValue) / parameter.currentValue),
      value,
    }));
}

function moveValue(parameter: RelaxableParameter, step: number): number {
  const factor = parameter.direction === "decrease" ? 1 - step : 1 + step;
  const value = parameter.currentValue * factor;

  return parameter.parameterType === "ratio"
    ? roundRatio(value)
    : Math.round(value * AMOUNT_DECIMALS) / AMOUNT_DECIMALS;
}

function relaxNode(node: RuleConditionNode, parameter: ConditionParameter, value: number): RuleConditionNode {
  if (isConditionGroup(node)) {
    return { ...node, conditions: node.conditions.map((child) => relaxNode(child, parameter, value)) };
  }

  if (node.id !== parameter.conditionId) {
    return node;
  }

  if (parameter.operand === "value") {
    return { ...node, right: { value } };
  }

  const scaledFeature = "expr" in node.right ? parseScaledFeature(node.right.expr) : null;

  return scaledFeature ? { ...node, right: { expr: `${value} × ${scaledFeature.feature}` } } : node;
}

function isRelativeType(parameterType: ParameterType): parameterType is "amount" | "window" | "ratio" {
  return parameterType === "amount" || parameterType === "window" || parameterType === "ratio";
}

function roundRatio(value: number): number {
  return Math.round(value * RATIO_DECIMALS) / RATIO_DECIMALS;
}
