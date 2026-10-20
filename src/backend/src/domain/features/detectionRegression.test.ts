import baseline from "./testing/regression/regressionBaseline.json";
import { computeRegressionSnapshot } from "./testing/regression/regressionSnapshot";

const FULL_DATASET_TIMEOUT_MS = 120_000;

describe("detection on the full PoC dataset", () => {
  it(
    "keeps per-rule hits and the features of a fixed sample unchanged",
    () => {
      expect(computeRegressionSnapshot()).toEqual(baseline);
    },
    FULL_DATASET_TIMEOUT_MS,
  );
});
