import styles from "./LoadingRing.module.css";

/** Large branded loading indicator, used for route loading and query loading states. */
export function LoadingRing({ label }: { label?: string }) {
  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.ring} aria-hidden="true">
        <span className={styles.track} />
        <span className={styles.arc} />
        <span className={styles.core} />
      </div>
      <p className={styles.label}>{label ?? "Loading…"}</p>
    </div>
  );
}
