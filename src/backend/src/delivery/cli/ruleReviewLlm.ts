import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseBedrockConfig } from "../../config";
import { describeBedrockAuth } from "../../infrastructure/bedrock/createBedrockClient";
import type {
  LlmAuditLog,
  LlmCallAudit,
  RuleReviewLlmSection,
  RuleReviewReport,
} from "../../infrastructure/bedrock/ruleReview/contract";
import { createBedrockRuleReviewLlm } from "../../infrastructure/bedrock/ruleReview/createBedrockRuleReviewLlm";
import { loadFixtureDataset } from "../../infrastructure/bedrock/ruleReview/fixtures/fixtureDataset";
import {
  createFixtureRuleReviewTools,
  loadRuleCatalogue,
  profileFindingClients,
} from "../../infrastructure/bedrock/ruleReview/fixtures/fixtureRuleReviewTools";

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../../..");
const FIXTURES_DIRECTORY = path.resolve(__dirname, "../../infrastructure/bedrock/ruleReview/fixtures");
const DEFAULT_REPORT_PATH = path.join(FIXTURES_DIRECTORY, "ruleReviewReport.fixture.json");
const RULE_CATALOGUE_PATH = path.join(FIXTURES_DIRECTORY, "ruleCatalogue.fixture.json");
const DATASETS_DIRECTORY = path.join(REPOSITORY_ROOT, "datasets");
const DEFAULT_RULE_REVIEW_DIRECTORY = ".rule-reviews";

// Usage: npx tsx --env-file-if-exists=.env src/delivery/cli/ruleReviewLlm.ts [report.json] [output.json]
async function runRuleReviewLlm(): Promise<void> {
  const reportPath = process.argv[2] ?? DEFAULT_REPORT_PATH;
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as RuleReviewReport;
  const outputPath =
    process.argv[3] ??
    path.join(process.env.RULE_REVIEW_DIR ?? DEFAULT_RULE_REVIEW_DIRECTORY, `${report.id}.json`);
  const bedrockConfig = parseBedrockConfig(process.env);
  const ruleCatalogue = loadRuleCatalogue(RULE_CATALOGUE_PATH);
  const dataset = loadFixtureDataset(DATASETS_DIRECTORY);
  const { findingExplainer, hypothesisExplorer } = createBedrockRuleReviewLlm(bedrockConfig);
  const audit = createInMemoryAuditLog();
  const context = {
    report,
    ruleCatalogue,
    clientProfilesByFindingId: profileFindingClients(report, dataset),
    budget: report.params.llm,
    audit,
  };

  console.log(
    `Report ${report.id}: ${report.findings.length} findings. Model ${bedrockConfig.modelId} ` +
      `(${bedrockConfig.region}), auth: ${describeBedrockAuth(bedrockConfig.auth)}`,
  );

  const [explanations, exploration] = await Promise.all([
    findingExplainer.explain(report.findings, context),
    hypothesisExplorer.explore(
      report,
      createFixtureRuleReviewTools(report, ruleCatalogue, dataset),
      report.params.llm,
    ),
  ]);
  const reportWithExplanations = { ...report, llm: { ...report.llm, explanations } };
  const summary = await findingExplainer.summarize({ ...context, report: reportWithExplanations });
  const llm: RuleReviewLlmSection = {
    summary,
    explanations,
    hypotheses: exploration.hypotheses,
    critiques: exploration.critiques,
    calls: [...audit.calls, ...exploration.calls],
    errors: [...audit.errors, ...exploration.errors],
  };

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ ...report, llm }, null, 2)}\n`);
  printLlmSection(llm);
  console.log(`\nReport with the llm section written to ${outputPath}`);
}

function createInMemoryAuditLog(): LlmAuditLog & { calls: LlmCallAudit[]; errors: string[] } {
  const calls: LlmCallAudit[] = [];
  const errors: string[] = [];

  return {
    calls,
    errors,
    recordCall: (call) => calls.push(call),
    recordError: (message) => errors.push(message),
  };
}

function printLlmSection(llm: RuleReviewLlmSection): void {
  console.log(`\nSummary:\n${llm.summary ?? "(none)"}`);

  for (const [findingId, explanation] of Object.entries(llm.explanations)) {
    console.log(
      `\n${findingId}: ${explanation.summary}\n  citations: ${explanation.citedEvidence.length}, ` +
        `unverified: ${explanation.unverifiedCitations.length}`,
    );

    for (const citation of explanation.unverifiedCitations) {
      console.log(`  ! ${citation.path} = ${JSON.stringify(citation.value)}`);
    }
  }

  for (const hypothesis of llm.hypotheses) {
    const outcome = hypothesis.backtest
      ? `${hypothesis.backtest.clientCount} clients, ${hypothesis.backtest.hitCount} hits (fake backtest), ` +
        (hypothesis.backtest.discardReason ? `discarded: ${hypothesis.backtest.discardReason}` : "kept")
      : `coverage gap, missing ${hypothesis.missingFeature}`;
    console.log(`\n${hypothesis.id} [${hypothesis.indicator}] ${hypothesis.descriptionCs}\n  ${outcome}`);
  }

  for (const [findingId, critique] of Object.entries(llm.critiques)) {
    console.log(`\nCritique of ${findingId}: ${critique}`);
  }

  const inputTokens = llm.calls.reduce((sum, call) => sum + call.inputTokens, 0);
  const outputTokens = llm.calls.reduce((sum, call) => sum + call.outputTokens, 0);
  const hypothesisToolCalls = llm.calls
    .filter(({ purpose }) => purpose === "hypotheses")
    .reduce((sum, call) => sum + call.toolCalls.length, 0);
  console.log(
    `\n${llm.calls.length} model calls, ${hypothesisToolCalls} hypothesis tool calls, ` +
      `${inputTokens} input (incl. cache) / ${outputTokens} output tokens`,
  );

  for (const error of llm.errors) {
    console.log(`Error: ${error}`);
  }
}

runRuleReviewLlm().catch((error: unknown) => {
  console.error("\nRule review LLM run failed:");
  console.error(error);
  process.exit(1);
});
