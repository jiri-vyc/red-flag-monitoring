import { RefreshCw } from "lucide-react";

import styles from "./RefreshButton.module.css";

export function RefreshButton({
  label,
  isFetching,
  onRefresh,
}: {
  label: string;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onRefresh}
      disabled={isFetching}
      aria-label={label}
      title={label}
    >
      <RefreshCw aria-hidden="true" className={isFetching ? styles.spinning : undefined} />
    </button>
  );
}
