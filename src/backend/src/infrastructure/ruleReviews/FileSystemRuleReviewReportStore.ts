import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { ConflictError } from "../../application/errors";
import type { RuleReviewReportStore } from "../../application/ruleReviews/ruleReviewPorts";
import { isFinishedReview, type RuleReviewReport } from "../../domain/ruleReview/ruleReviewReport";

const REPORT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REPORT_EXTENSION = ".json";

export class FileSystemRuleReviewReportStore implements RuleReviewReportStore {
  constructor(private readonly directory: string) {}

  async save(report: RuleReviewReport): Promise<void> {
    const stored = await this.find(report.id);

    if (stored && isFinishedReview(stored)) {
      throw new ConflictError(`Rule review ${report.id} is ${stored.status} and can no longer change`);
    }

    await mkdir(this.directory, { recursive: true });
    const filePath = this.toFilePath(report.id);
    const temporaryPath = `${filePath}.tmp`;

    // Written aside and renamed, so a reader polling the report never sees half a document.
    await writeFile(temporaryPath, JSON.stringify(report, null, 2));
    await rename(temporaryPath, filePath);
  }

  async find(id: string): Promise<RuleReviewReport | null> {
    if (!REPORT_ID_PATTERN.test(id)) {
      return null;
    }

    try {
      return JSON.parse(await readFile(this.toFilePath(id), "utf8")) as RuleReviewReport;
    } catch (error) {
      if (isMissingFile(error)) {
        return null;
      }

      throw error;
    }
  }

  async list(): Promise<RuleReviewReport[]> {
    let fileNames: string[];

    try {
      fileNames = await readdir(this.directory);
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }

      throw error;
    }

    const ids = fileNames
      .filter((fileName) => fileName.endsWith(REPORT_EXTENSION))
      .map((fileName) => fileName.slice(0, -REPORT_EXTENSION.length));
    const reports = await Promise.all(ids.map((id) => this.find(id)));

    return reports.filter((report): report is RuleReviewReport => report !== null);
  }

  private toFilePath(id: string): string {
    return path.join(this.directory, `${id}${REPORT_EXTENSION}`);
  }
}

// Not `instanceof Error`: fs errors come from another realm under jest.
function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
