import { render, screen } from "@testing-library/react";

import { I18nProvider } from "@/i18n/I18nProvider";

import type { Batch } from "../types";
import { BatchProgressView } from "./BatchProgressView";

const FETCHED_AT_MS = Date.parse("2026-10-19T10:01:00.000Z");

const BATCH: Batch = {
  id: "run-1",
  fileName: "database: all transactions",
  uploadedAt: "2026-10-19T10:00:00.000Z",
  finishedAt: null,
  uploadedBy: "analyst",
  status: "processing",
  fileRowCount: 1000,
  evaluatedRowCount: 1000,
  processedRowCount: 100,
  activeRuleCount: 1,
  counts: { ok: 0, to_check: 0, alert: 0 },
  failureReason: null,
  isFullDatasetRun: true,
};

function progressView(isStalled: boolean, processedRowCount: number, fetchedAtMs: number) {
  return (
    <I18nProvider initialLocale="en">
      <BatchProgressView
        batch={{ ...BATCH, processedRowCount }}
        fetchedAtMs={fetchedAtMs}
        isStalled={isStalled}
      />
    </I18nProvider>
  );
}

/** Two polls with progress, so the view has a rate and an ETA to show. */
function renderMeasuredProgress(isStalled: boolean) {
  const { rerender } = render(progressView(isStalled, 100, FETCHED_AT_MS));
  rerender(progressView(isStalled, 200, FETCHED_AT_MS + 2000));
}

beforeEach(() => {
  // jsdom has no matchMedia; AnimatedCounter asks it for reduced motion and then skips the animation.
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  jest.useFakeTimers();
  jest.setSystemTime(FETCHED_AT_MS + 2000);
});

afterEach(() => jest.useRealTimers());

describe("BatchProgressView", () => {
  it("shows the remaining time once two polls show progress", () => {
    renderMeasuredProgress(false);

    expect(screen.getByText(/remaining/)).toBeTruthy();
  });

  it("hides the remaining time while the run is stalled", () => {
    renderMeasuredProgress(true);

    expect(screen.queryByText(/remaining/)).toBeNull();
  });
});
