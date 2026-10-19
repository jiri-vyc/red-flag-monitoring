import styles from "./ScoreBar.module.css";

export type ScoreTone = "low" | "medium" | "high";

export function findScoreTone(score: number): ScoreTone {
  if (score >= 75) {
    return "high";
  }
  if (score >= 40) {
    return "medium";
  }
  return "low";
}

export function ScoreBar({ score, label }: { score: number; label: string }) {
  const tone = findScoreTone(score);
  return (
    <div className={styles.scoreBar}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <strong className={`${styles.value} ${styles[tone]}`}>{score}</strong>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label={label}
      >
        <span className={`${styles.fill} ${styles[`${tone}Fill`]}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
