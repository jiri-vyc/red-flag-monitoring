import { render, screen } from "@testing-library/react";

import { en } from "@/i18n/en";
import { I18nProvider } from "@/i18n/I18nProvider";

import type { BucketCounts } from "../types";
import { BucketCountsInline } from "./BucketCountsInline";

function renderCounts(counts: BucketCounts) {
  render(
    <I18nProvider initialLocale="en">
      <BucketCountsInline counts={counts} />
    </I18nProvider>,
  );
}

describe("BucketCountsInline", () => {
  it("hides the unknown bucket when it is empty", () => {
    renderCounts({ ok: 665, to_check: 0, alert: 335 });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(en.bucket.ok)).toBeTruthy();
    expect(screen.getByText(en.bucket.alert)).toBeTruthy();
    expect(screen.queryByText(en.bucket.to_check)).toBeNull();
  });

  it("shows the unknown bucket when it has transactions", () => {
    renderCounts({ ok: 665, to_check: 3, alert: 332 });

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(en.bucket.to_check)).toBeTruthy();
  });

  it("always shows the ok and alert buckets, even when empty", () => {
    renderCounts({ ok: 0, to_check: 0, alert: 0 });

    expect(screen.getByText(en.bucket.ok)).toBeTruthy();
    expect(screen.getByText(en.bucket.alert)).toBeTruthy();
  });
});
