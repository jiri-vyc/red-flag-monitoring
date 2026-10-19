"use client";

import { Bot, CircleCheck, CircleDashed, CirclePause, Clock, CodeXml, RefreshCw } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/I18nProvider";

import type { RuleStatus, RuleType, RuleVersionState } from "../types";

const STATUS_TONES: Record<RuleStatus, BadgeTone> = {
  draft: "neutral",
  pending_for_review: "warning",
  update_for_review: "warning",
  active: "success",
  inactive: "neutral",
};

const STATUS_ICONS = {
  draft: CircleDashed,
  pending_for_review: Clock,
  update_for_review: RefreshCw,
  active: CircleCheck,
  inactive: CirclePause,
} as const;

export function RuleStatusBadge({ status }: { status: RuleStatus }) {
  const { t } = useI18n();
  const StatusIcon = STATUS_ICONS[status];
  return (
    <Badge tone={STATUS_TONES[status]} icon={<StatusIcon aria-hidden="true" />}>
      {t.ruleStatus[status]}
    </Badge>
  );
}

export function RuleTypeBadge({ type }: { type: RuleType }) {
  const { t } = useI18n();
  const TypeIcon = type === "agentic" ? Bot : CodeXml;
  return (
    <Badge tone={type === "agentic" ? "ai" : "primary"} icon={<TypeIcon aria-hidden="true" />}>
      {t.ruleType[type]}
    </Badge>
  );
}

const VERSION_STATE_TONES: Record<RuleVersionState, BadgeTone> = {
  draft: "neutral",
  pending_review: "warning",
  approved: "success",
  rejected: "danger",
  superseded: "neutral",
};

export function VersionStateBadge({ state }: { state: RuleVersionState }) {
  const { t } = useI18n();
  return <Badge tone={VERSION_STATE_TONES[state]}>{t.versionState[state]}</Badge>;
}
