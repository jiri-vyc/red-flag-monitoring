"use client";

import { RefreshCw } from "lucide-react";

import { useI18n } from "@/i18n/I18nProvider";
import { formatMessage } from "@/i18n/dictionaries";
import type { Dictionary } from "@/i18n/en";
import { assertUnreachable } from "@/lib/assertUnreachable";
import { formatNumber, formatTime } from "@/lib/format";

import { useDatabaseStatus } from "../api/hooks";
import type { DatabaseStatus } from "../types";
import styles from "./DatabaseStatusPanel.module.css";

type Connection =
  | { state: "checking" }
  | { state: "connected"; status: DatabaseStatus }
  | { state: "unreachable"; errorMessage: string };

// React Query keeps the last successful data after a failed refetch, so the error must win over it.
function getConnection(status: DatabaseStatus | undefined, error: Error | null): Connection {
  if (error) {
    return { state: "unreachable", errorMessage: error.message };
  }
  if (status) {
    return { state: "connected", status };
  }
  return { state: "checking" };
}

function describeServer(t: Dictionary, status: DatabaseStatus): string {
  if (status.auroraVersion) {
    return formatMessage(t.databaseStatus.aurora, { version: status.auroraVersion });
  }
  const [shortVersion = status.serverVersion] = status.serverVersion.split(" on ");
  return formatMessage(t.databaseStatus.notAurora, { version: shortVersion });
}

function describeConnection(t: Dictionary, connection: Connection): string {
  switch (connection.state) {
    case "checking":
      return t.databaseStatus.checking;
    case "connected":
      return describeServer(t, connection.status);
    case "unreachable":
      return t.databaseStatus.unreachable;
    default:
      return assertUnreachable(connection);
  }
}

function DatabaseStatusDetails({ status }: { status: DatabaseStatus }) {
  const { t, locale } = useI18n();
  const rows = [
    { label: t.databaseStatus.database, value: status.databaseName },
    { label: t.databaseStatus.clients, value: formatNumber(status.clientCount, locale) },
    { label: t.databaseStatus.migration, value: status.latestMigration ?? "–" },
    { label: t.databaseStatus.checkedAt, value: formatTime(status.serverTime, locale) },
  ];
  const serverTooltip = [status.serverVersion, status.serverAddress].filter(Boolean).join("\n");

  return (
    <dl className={styles.details} title={serverTooltip}>
      {rows.map(({ label, value }) => (
        <div key={label} className={styles.detailRow}>
          <dt>{label}</dt>
          <dd title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DatabaseStatusPanel() {
  const { t } = useI18n();
  const { data: status, error, isFetching, refetch } = useDatabaseStatus();
  const connection = getConnection(status, error);

  return (
    <section className={styles.panel} aria-label={t.databaseStatus.title} aria-busy={isFetching}>
      <div className={styles.header} role="status">
        <span className={`${styles.indicator} ${styles[connection.state]}`} aria-hidden="true" />
        <strong>{describeConnection(t, connection)}</strong>
        <button
          type="button"
          className={styles.recheckButton}
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label={t.databaseStatus.recheck}
          title={t.databaseStatus.recheck}
        >
          <RefreshCw aria-hidden="true" className={isFetching ? styles.spinning : undefined} />
        </button>
      </div>
      {connection.state === "connected" && <DatabaseStatusDetails status={connection.status} />}
      {connection.state === "unreachable" && <p className={styles.errorMessage}>{connection.errorMessage}</p>}
    </section>
  );
}
