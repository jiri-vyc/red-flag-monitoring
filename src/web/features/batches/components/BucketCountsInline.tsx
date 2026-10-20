"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { formatNumber } from "@/lib/format";

import { BUCKETS, type Bucket, type BucketCounts } from "../types";
import { BUCKET_ICONS } from "./BucketBadge";
import styles from "./BucketCountsInline.module.css";

// The unknown bucket (`to_check`) is noise when empty, so it is shown only when it has transactions.
function isBucketVisible(bucket: Bucket, counts: BucketCounts): boolean {
  return bucket !== "to_check" || counts.to_check > 0;
}

export function BucketCountsInline({ counts }: { counts: BucketCounts }) {
  const { t, locale } = useI18n();
  const visibleBuckets = BUCKETS.filter((bucket) => isBucketVisible(bucket, counts));
  return (
    <ul className={styles.counts}>
      {visibleBuckets.map((bucket) => {
        const BucketIcon = BUCKET_ICONS[bucket];
        return (
          <li key={bucket} className={`${styles.count} ${styles[bucket]}`}>
            <BucketIcon aria-hidden="true" />
            <span className={styles.value}>{formatNumber(counts[bucket], locale)}</span>
            <span className={styles.label}>{t.bucket[bucket]}</span>
          </li>
        );
      })}
    </ul>
  );
}
