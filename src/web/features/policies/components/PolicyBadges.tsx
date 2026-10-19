"use client";

import { Sparkles, UserPen } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/I18nProvider";

import type { PolicyOrigin, PolicyStatus } from "../types";

export function PolicyStatusBadge({ status }: { status: PolicyStatus }) {
  const { t } = useI18n();
  return <Badge tone={status === "approved" ? "success" : "neutral"}>{t.policyStatus[status]}</Badge>;
}

export function PolicyOriginBadge({ origin }: { origin: PolicyOrigin }) {
  const { t } = useI18n();
  const OriginIcon = origin === "generated" ? Sparkles : UserPen;
  return (
    <Badge tone={origin === "generated" ? "ai" : "neutral"} icon={<OriginIcon aria-hidden="true" />}>
      {t.policyOrigin[origin]}
    </Badge>
  );
}
