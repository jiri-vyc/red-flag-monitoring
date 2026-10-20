"use client";

import { CircleCheck, CircleDashed, Clock, Send } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/I18nProvider";

import type { FauReportStatus } from "../types";

const STATUS_TONES: Record<FauReportStatus, BadgeTone> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "primary",
  submitted: "success",
};

const STATUS_ICONS = {
  draft: CircleDashed,
  pending_approval: Clock,
  approved: CircleCheck,
  submitted: Send,
} as const;

export function FauReportStatusBadge({ status }: { status: FauReportStatus }) {
  const { t } = useI18n();
  const StatusIcon = STATUS_ICONS[status];
  return (
    <Badge tone={STATUS_TONES[status]} icon={<StatusIcon aria-hidden="true" />}>
      {t.fauReports.status[status]}
    </Badge>
  );
}
