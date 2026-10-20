import "reflect-metadata";

import { parseAppConfig } from "../../config";
import { DEFAULT_HIT_THRESHOLD } from "../../domain/evaluation";
import { DEMO_ADMIN_USER_ID } from "../../domain/user";
import { createDataSource } from "../../infrastructure/database/createDataSource";
import { TypeOrmRuleReviewInputRepository } from "../../infrastructure/ruleReviews/TypeOrmRuleReviewInputRepository";
import { createRuleReviewUseCases, parseRuleReviewConfig } from "../../ruleReviewComposition";
import { type ProbeMode, runProbe } from "./ruleReviewProbe";

const USAGE =
  "Usage: npm run rule-review [-- --evaluation-run <id>] | npm run rule-review -- --probe [fx|czk]";

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  const appConfig = parseAppConfig(process.env);
  const dataSource = createDataSource(appConfig.database);
  await dataSource.initialize();

  try {
    if (command === "--probe") {
      await probe(new TypeOrmRuleReviewInputRepository(dataSource), argument);
    } else if (command === undefined || command === "--evaluation-run") {
      const ruleReviewConfig = parseRuleReviewConfig(process.env);
      const useCases = createRuleReviewUseCases(dataSource, appConfig, ruleReviewConfig, "awaited");
      const started = await useCases.startReview({
        createdBy: DEMO_ADMIN_USER_ID,
        evaluationRunId: argument ?? null,
        llm: null,
      });
      const report = await useCases.getReview(started.id);
      const [summary] = (await useCases.listReviews()).filter((review) => review.id === report.id);

      console.log(
        `Rule review ${report.id}: ${report.status}${report.errorMessage ? ` (${report.errorMessage})` : ""}`,
      );
      console.log(`Findings: ${JSON.stringify(summary?.findingCounts)}`);
      console.log(`Report: ${ruleReviewConfig.reportDirectory}/${report.id}.json`);
    } else {
      throw new Error(USAGE);
    }
  } finally {
    await dataSource.destroy();
  }
}

async function probe(
  inputRepository: TypeOrmRuleReviewInputRepository,
  rawMode: string | undefined,
): Promise<void> {
  const [dataset, { ruleSet }] = await Promise.all([
    inputRepository.loadDataset(),
    inputRepository.loadRuleSet({ evaluationRunId: null, hitThreshold: DEFAULT_HIT_THRESHOLD }),
  ]);
  const modes: ProbeMode[] = rawMode === "fx" || rawMode === "czk" ? [rawMode] : ["fx", "czk"];

  for (const mode of modes) {
    runProbe({ dataset, ruleSet, mode });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
