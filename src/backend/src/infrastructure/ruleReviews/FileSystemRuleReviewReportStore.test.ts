import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ConflictError } from "../../application/errors";
import { DEFAULT_RULE_REVIEW_PARAMS } from "../../domain/ruleReview/ruleReviewParams";
import { createRunningReport, type RuleReviewReport } from "../../domain/ruleReview/ruleReviewReport";
import { FileSystemRuleReviewReportStore } from "./FileSystemRuleReviewReportStore";

const REVIEW_ID = "3f2b9c1e-5d4a-4b6c-8e7f-0a1b2c3d4e5f";

function buildReport(id = REVIEW_ID): RuleReviewReport {
  return createRunningReport({
    id,
    startedAt: new Date("2026-10-20T10:00:00Z"),
    createdBy: "user",
    engineVersion: "test",
    params: DEFAULT_RULE_REVIEW_PARAMS,
    input: {
      ruleVersionIds: [],
      referenceListVersionIds: [],
      transactionSetDigest: "",
      evaluationRunId: null,
    },
  });
}

describe("FileSystemRuleReviewReportStore", () => {
  let directory: string;
  let store: FileSystemRuleReviewReportStore;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "rule-reviews-"));
    store = new FileSystemRuleReviewReportStore(path.join(directory, "reports"));
  });

  afterEach(() => rm(directory, { recursive: true, force: true }));

  it("rewrites a running report and lists what it stored", async () => {
    await store.save(buildReport());
    await store.save({ ...buildReport(), progress: { stage: "baseline", done: 5, total: 10 } });

    expect(await store.find(REVIEW_ID)).toMatchObject({ progress: { stage: "baseline", done: 5 } });
    expect((await store.list()).map((report) => report.id)).toEqual([REVIEW_ID]);
    expect(await readdir(path.join(directory, "reports"))).toEqual([`${REVIEW_ID}.json`]);
  });

  it("keeps a finished report immutable", async () => {
    await store.save({ ...buildReport(), status: "completed" });

    await expect(store.save(buildReport())).rejects.toThrow(ConflictError);
  });

  it("never reads outside its directory", async () => {
    await writeFile(path.join(directory, "secret.json"), "{}");

    expect(await store.find("../secret")).toBeNull();
  });

  it("lists nothing before the first review", async () => {
    expect(await store.list()).toEqual([]);
  });
});
