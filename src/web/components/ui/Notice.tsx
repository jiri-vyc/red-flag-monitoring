import { ShieldAlert, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./Notice.module.css";

type NoticeTone = "ai" | "compliance" | "info";

const NOTICE_ICONS = { ai: Sparkles, compliance: ShieldAlert, info: ShieldAlert } as const;

type NoticeProps = {
  tone: NoticeTone;
  title?: string;
  children: ReactNode;
  /** Rendered under the message, e.g. buttons that act on it. */
  actions?: ReactNode;
};

export function Notice({ tone, title, children, actions }: NoticeProps) {
  const NoticeIcon = NOTICE_ICONS[tone];
  return (
    <aside className={`${styles.notice} ${styles[tone]}`}>
      <NoticeIcon className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </aside>
  );
}
