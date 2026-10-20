import { DEFAULT_FEATURE_PARAMETERS } from "../features/featureParameters";
import { loadDatasetFromCsv, loadSampleRuleSet } from "../features/testing/regression/datasetCsv";
import { runToCompletion } from "./cooperativeWork";
import { perturbPatternHit, type PerturbationResult, PERTURBED_PATTERN_WINDOWS } from "./perturbation";
import { createReviewDataset } from "./reviewDataset";
import { runBaselinePass } from "./ruleGapAnalysis";
import { DEFAULT_RULE_REVIEW_PARAMS } from "./ruleReviewParams";

const FULL_DATASET_TIMEOUT_MS = 180_000;
const CASES_PER_RULE = 5;
const OVERSHOOT = 0.1;

// Section 4 "Validation without labelled data": real hits of R-04, R-11 and R-12 moved 10 % past their window
// must leave the rule and come back at a window step inside the 25 % cap.
describe("perturbation test on the PoC dataset", () => {
  it(
    "finds every perturbed hit of R-04, R-11 and R-12 within the window cap",
    () => {
      const dataset = loadDatasetFromCsv();
      const sampleRuleSet = loadSampleRuleSet();
      const ruleSet = {
        ...sampleRuleSet,
        ruleVersions: sampleRuleSet.ruleVersions.filter(
          (ruleVersion) => ruleVersion.ruleCode in PERTURBED_PATTERN_WINDOWS,
        ),
      };
      const caps = {
        ...DEFAULT_RULE_REVIEW_PARAMS.caps,
        excludedRuleCodes: Object.keys(PERTURBED_PATTERN_WINDOWS),
      };
      const baseline = runToCompletion(
        runBaselinePass({
          dataset: createReviewDataset(dataset),
          ruleSet,
          featureParameters: DEFAULT_FEATURE_PARAMETERS,
          caps,
        }),
      );
      const clientIdByTransactionId = new Map(
        dataset.transactions.map((transaction) => [transaction.transactionId, transaction.clientId]),
      );
      const results: PerturbationResult[] = [];

      for (const { ruleVersion, transactionIds } of baseline.hitsByRuleVersionId.values()) {
        const hitsByClient = new Map<string, string[]>();

        for (const transactionId of transactionIds) {
          const clientId = clientIdByTransactionId.get(transactionId) ?? "";
          hitsByClient.set(clientId, [...(hitsByClient.get(clientId) ?? []), transactionId]);
        }

        const singleHits = [...hitsByClient]
          .filter(([, ids]) => ids.length === 1)
          .sort(([left], [right]) => left.localeCompare(right));
        const ruleResults: PerturbationResult[] = [];

        for (const [clientId, [transactionId = ""]] of singleHits) {
          const result = perturbPatternHit({
            dataset,
            ruleSet,
            ruleVersion,
            clientId,
            transactionId,
            featureParameters: DEFAULT_FEATURE_PARAMETERS,
            caps: DEFAULT_RULE_REVIEW_PARAMS.caps,
            overshoot: OVERSHOOT,
          });

          if (result && !result.stillHitsAfterShift) {
            ruleResults.push(result);
          }

          if (ruleResults.length === CASES_PER_RULE) {
            break;
          }
        }

        results.push(...ruleResults);
      }

      expect(results).toHaveLength(CASES_PER_RULE * 3);
      expect(results.filter((result) => result.detectedAtStep === null)).toEqual([]);
      expect(Math.max(...results.map((result) => result.detectedAtStep ?? 1))).toBeLessThanOrEqual(0.25);
    },
    FULL_DATASET_TIMEOUT_MS,
  );
});
