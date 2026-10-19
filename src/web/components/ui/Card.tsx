import type { ReactNode } from "react";

import styles from "./Card.module.css";

type CardProps = {
  title?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "ai";
  className?: string;
  children: ReactNode;
};

export function Card({ title, actions, tone = "default", className, children }: CardProps) {
  const classNames = [styles.card, tone === "ai" ? styles.ai : "", "rf-slide-up", className].filter(Boolean);
  return (
    <section className={classNames.join(" ")}>
      {(title || actions) && (
        <header className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
