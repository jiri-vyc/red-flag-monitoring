"use client";

import { Trash2 } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";

import styles from "./DeleteConfirmation.module.css";

/** A delete the domain forbids: the button stays visible but disabled, with the reason under it. */
export function BlockedDeleteButton({ label, reason }: { label: string; reason: string }) {
  const reasonId = useId();
  return (
    <span className={styles.blockedAction}>
      <Button variant="danger" icon={<Trash2 aria-hidden="true" />} disabled aria-describedby={reasonId}>
        {label}
      </Button>
      <span id={reasonId} className={styles.reason}>
        {reason}
      </span>
    </span>
  );
}

type DeleteConfirmationPanelProps = {
  title: string;
  warning: string;
  isPending: boolean;
  error: Error | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Inline confirmation of a permanent delete. */
export function DeleteConfirmationPanel({
  title,
  warning,
  isPending,
  error,
  onConfirm,
  onCancel,
}: DeleteConfirmationPanelProps) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <div className={styles.panel} role="group" aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        {title}
      </h3>
      <p className={styles.warning}>{warning}</p>
      {error && <ErrorState error={error} />}
      <div className={styles.buttons}>
        <Button
          variant="danger"
          icon={<Trash2 aria-hidden="true" />}
          disabled={isPending}
          onClick={onConfirm}
        >
          {isPending ? t.common.deleting : t.common.delete}
        </Button>
        <Button variant="ghost" disabled={isPending} onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}
