import {
  LIMIT_L_CZK,
  NEAR_LIMIT_LOWER_CZK,
  PASSTHROUGH_INFLOW_WINDOW_HOURS,
  PASSTHROUGH_MIN_INFLOW_CZK,
  PASSTHROUGH_OUTFLOW_WINDOW_HOURS,
  QUICK_FORWARD_MAX_RATIO,
  QUICK_FORWARD_MIN_RATIO,
  QUICK_FORWARD_WINDOW_HOURS,
  ROUND_TRIP_WINDOW_HOURS,
  SMALL_PAYMENT_WINDOW_DAYS,
} from "./thresholds";

// Detection always runs with DEFAULT_FEATURE_PARAMETERS; only the rule review relaxes them.
export type FeatureParameters = {
  smallPaymentWindowDays: number;
  smallPaymentMaxCzk: number;
  nearLimitWindowDays: number;
  nearLimitLowerCzk: number;
  nearLimitUpperCzk: number;
  quickForwardWindowHours: number;
  quickForwardMinAmountCzk: number;
  quickForwardMinRatio: number;
  quickForwardMaxRatio: number;
  roundTripWindowHours: number;
  roundTripMinAmountCzk: number;
  passthroughInflowWindowHours: number;
  passthroughOutflowWindowHours: number;
  passthroughMinInflowCzk: number;
};

export type FeatureParameterName = keyof FeatureParameters;

export const DEFAULT_FEATURE_PARAMETERS: Readonly<FeatureParameters> = Object.freeze({
  smallPaymentWindowDays: SMALL_PAYMENT_WINDOW_DAYS,
  smallPaymentMaxCzk: LIMIT_L_CZK,
  nearLimitWindowDays: SMALL_PAYMENT_WINDOW_DAYS,
  nearLimitLowerCzk: NEAR_LIMIT_LOWER_CZK,
  nearLimitUpperCzk: LIMIT_L_CZK,
  quickForwardWindowHours: QUICK_FORWARD_WINDOW_HOURS,
  quickForwardMinAmountCzk: LIMIT_L_CZK,
  quickForwardMinRatio: QUICK_FORWARD_MIN_RATIO,
  quickForwardMaxRatio: QUICK_FORWARD_MAX_RATIO,
  roundTripWindowHours: ROUND_TRIP_WINDOW_HOURS,
  roundTripMinAmountCzk: LIMIT_L_CZK,
  passthroughInflowWindowHours: PASSTHROUGH_INFLOW_WINDOW_HOURS,
  passthroughOutflowWindowHours: PASSTHROUGH_OUTFLOW_WINDOW_HOURS,
  passthroughMinInflowCzk: PASSTHROUGH_MIN_INFLOW_CZK,
});
