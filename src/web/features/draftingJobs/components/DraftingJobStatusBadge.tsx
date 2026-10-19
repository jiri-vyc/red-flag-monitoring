"use client";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/I18nProvider";

import type { DraftingJobStatus } from "../types";

const STATUS_TONES: Record<DraftingJobStatus, BadgeTone> = {
  pending: "neutral",
  running: "ai",
  succeeded: "success",
  failed: "danger",
};

export function DraftingJobStatusBadge({ status }: { status: DraftingJobStatus }) {
  const { t } = useI18n();
  return <Badge tone={STATUS_TONES[status]}>{t.draftingJobs.status[status]}</Badge>;
}
