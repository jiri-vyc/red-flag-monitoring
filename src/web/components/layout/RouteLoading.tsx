"use client";

import { LoadingRing } from "@/components/ui/LoadingRing";
import { useI18n } from "@/i18n/I18nProvider";

export function RouteLoading() {
  const { t } = useI18n();
  return <LoadingRing label={t.common.loading} />;
}
