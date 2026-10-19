import styles from "./Progress.module.css";

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const clampedPercent = clampPercent(percent);
  const dashOffset = RING_CIRCUMFERENCE * (1 - clampedPercent / 100);
  return (
    <div
      className={styles.ring}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedPercent}
      aria-label={label}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id="rf-progress-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-ai)" />
          </linearGradient>
        </defs>
        <circle className={styles.ringTrack} cx="60" cy="60" r={RING_RADIUS} />
        <circle
          className={styles.ringValue}
          cx="60"
          cy="60"
          r={RING_RADIUS}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className={styles.ringPercent}>{clampedPercent}%</span>
    </div>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const clampedPercent = clampPercent(percent);
  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedPercent}
      aria-label={label}
    >
      <span className={styles.barValue} style={{ width: `${clampedPercent}%` }} />
    </div>
  );
}
