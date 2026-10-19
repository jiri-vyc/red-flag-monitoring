// Fixed parameters of the pattern features (F8). Changing one changes detection: it needs a PR review and
// shows up in the run's engine_version (V10), not in a rule version.

// L = 1 000 EUR, the common limit of the sample rules (SVZ-06).
export const LIMIT_L_CZK = 25_000;

// R-08: amounts from 0.9 × L up to L count as "just under the limit".
export const NEAR_LIMIT_LOWER_CZK = 0.9 * LIMIT_L_CZK;

// R-07, R-08
export const SMALL_PAYMENT_WINDOW_DAYS = 7;

// R-11: an outgoing payment forwards an incoming one within this window and amount band.
export const QUICK_FORWARD_WINDOW_HOURS = 2;
export const QUICK_FORWARD_MIN_RATIO = 0.9;
export const QUICK_FORWARD_MAX_RATIO = 1.1;

// R-12
export const ROUND_TRIP_WINDOW_HOURS = 72;

// R-04: incoming funds over the inflow window, forwarded within the outflow window.
export const PASSTHROUGH_INFLOW_WINDOW_HOURS = 24;
export const PASSTHROUGH_OUTFLOW_WINDOW_HOURS = 6;
export const PASSTHROUGH_MIN_INFLOW_CZK = 100_000;

// Q2 2026 has 91 days and 3 months (R-01 b, R-13).
export const Q2_DAY_COUNT = 91;
export const Q2_MONTH_COUNT = 3;
