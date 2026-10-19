"use client";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";

export function NotFoundView() {
  const { t } = useI18n();
  return (
    <EmptyState
      message={`${t.common.notFoundTitle}: ${t.common.notFoundMessage}`}
      action={<ButtonLink href="/">{t.common.backToDashboard}</ButtonLink>}
    />
  );
}
