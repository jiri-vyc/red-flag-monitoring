import type { ReactNode } from "react";

import styles from "./KeyValueList.module.css";

export type KeyValueItem = { label: string; value: ReactNode };

export function KeyValueList({ items }: { items: KeyValueItem[] }) {
  return (
    <dl className={styles.list}>
      {items.map((item) => (
        <div key={item.label} className={styles.item}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
