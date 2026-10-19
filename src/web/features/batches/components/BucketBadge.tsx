"use client";

import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/I18nProvider";

import type { Bucket } from "../types";

export const BUCKET_TONES: Record<Bucket, BadgeTone> = {
  ok: "success",
  to_check: "warning",
  alert: "danger",
};
export const BUCKET_ICONS = { ok: CircleCheck, to_check: TriangleAlert, alert: OctagonAlert } as const;

export function BucketBadge({ bucket }: { bucket: Bucket }) {
  const { t } = useI18n();
  const BucketIcon = BUCKET_ICONS[bucket];
  return (
    <Badge tone={BUCKET_TONES[bucket]} icon={<BucketIcon aria-hidden="true" />}>
      {t.bucket[bucket]}
    </Badge>
  );
}
