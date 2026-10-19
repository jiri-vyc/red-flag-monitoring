import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./PageHeader.module.css";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backLink?: { href: string; label: string };
  meta?: ReactNode;
};

export function PageHeader({ title, description, actions, backLink, meta }: PageHeaderProps) {
  return (
    <header className={`${styles.header} rf-fade-in`}>
      <div className={styles.text}>
        {backLink && (
          <Link href={backLink.href} className={styles.back}>
            <ArrowLeft aria-hidden="true" />
            {backLink.label}
          </Link>
        )}
        <h1>{title}</h1>
        {meta && <div className={styles.meta}>{meta}</div>}
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
