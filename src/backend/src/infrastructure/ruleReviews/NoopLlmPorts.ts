import type {
  FindingExplainer,
  HypothesisExploration,
  HypothesisExplorer,
} from "../../application/ruleReviews/ruleReviewPorts";
import type { FindingExplanation } from "../../domain/ruleReview/ruleReviewReport";

export class NoopFindingExplainer implements FindingExplainer {
  explain(): Promise<Record<string, FindingExplanation>> {
    return Promise.resolve({});
  }

  summarize(): Promise<string | null> {
    return Promise.resolve(null);
  }
}

export class NoopHypothesisExplorer implements HypothesisExplorer {
  explore(): Promise<HypothesisExploration> {
    return Promise.resolve({ hypotheses: [], critiques: {}, calls: [], errors: [] });
  }
}
