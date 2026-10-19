import type { BackendHealth } from "@/lib/backendHealth";

import styles from "./BackendStatus.module.css";

type BackendStatusProps = { health: BackendHealth };

export function BackendStatus({ health }: BackendStatusProps) {
  const label = health.isReachable ? `Backend: ${health.status}` : "Backend: unreachable";
  const statusClassName = health.isReachable ? styles.reachable : styles.unreachable;

  return (
    <p className={`${styles.status} ${statusClassName}`} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </p>
  );
}
