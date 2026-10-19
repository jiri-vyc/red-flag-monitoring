"use client";

import { Database, Inbox, TriangleAlert, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { isApiError } from "@/lib/apiError";
import { useApiMode } from "@/providers/ApiModeProvider";

import { Button } from "./Button";
import { LoadingRing } from "./LoadingRing";
import styles from "./StateViews.module.css";

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const { apiMode, changeApiMode } = useApiMode();
  const title = isApiError(error) ? t.errors[error.kind] : t.common.errorTitle;
  const detail = error instanceof Error ? error.message : t.common.unknownError;
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <TriangleAlert className={styles.icon} aria-hidden="true" />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.detail}>{detail}</p>
      <div className={styles.actions}>
        {onRetry && (
          <Button variant="secondary" icon={<RotateCcw aria-hidden="true" />} onClick={onRetry}>
            {t.common.retry}
          </Button>
        )}
        {/* An explicit way out of a failing API; the app never falls back to mock data on its own. */}
        {apiMode === "live" && (
          <Button
            variant="secondary"
            icon={<Database aria-hidden="true" />}
            onClick={() => changeApiMode("mock")}
          >
            {t.common.switchToMock}
          </Button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      <Inbox className={styles.icon} aria-hidden="true" />
      <p className={styles.detail}>{message}</p>
      {action}
    </div>
  );
}

type QueryLike<TData> = {
  data: TData | undefined;
  error: unknown;
  isPending: boolean;
  isError: boolean;
  refetch: () => unknown;
};

/** Renders the loading ring, the error state with Retry, or the loaded data. */
export function QueryView<TData>({
  query,
  loadingLabel,
  children,
}: {
  query: QueryLike<TData>;
  loadingLabel?: string;
  children: (data: TData) => ReactNode;
}) {
  const { t } = useI18n();
  if (query.isPending) {
    return <LoadingRing label={loadingLabel ?? t.common.loading} />;
  }
  if (query.isError || query.data === undefined) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}
