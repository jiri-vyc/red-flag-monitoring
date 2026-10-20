import { InvalidConfigError } from "./config";
import { parseRuleReviewConfig } from "./ruleReviewComposition";

describe("parseRuleReviewConfig", () => {
  it("defaults to no LLM and the git-ignored report directory", () => {
    expect(parseRuleReviewConfig({})).toEqual({
      reportDirectory: expect.stringMatching(/backend\/\.rule-reviews$/),
      llmMode: "off",
    });
  });

  it("reads RULE_REVIEW_DIR and RULE_REVIEW_LLM", () => {
    expect(parseRuleReviewConfig({ RULE_REVIEW_DIR: "/tmp/reviews", RULE_REVIEW_LLM: "bedrock" })).toEqual({
      reportDirectory: "/tmp/reviews",
      llmMode: "bedrock",
    });
  });

  it("rejects an unknown LLM mode", () => {
    expect(() => parseRuleReviewConfig({ RULE_REVIEW_LLM: "openai" })).toThrow(InvalidConfigError);
  });
});
