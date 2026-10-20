"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import tableStyles from "@/components/ui/DataTable.module.css";
import { transactionsPath } from "@/features/transactions/transactionsPath";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import { formatStepPercent } from "../domain/findingGroups";
import type { FindingClient } from "../types";
import styles from "./GapAnalysis.module.css";

const COPIED_FEEDBACK_MS = 2000;
const COLLAPSED_CLIENT_COUNT = 10;

export function CopyClientIdsButton({ clientIds }: { clientIds: string[] }) {
  const { t } = useI18n();
  const [isCopied, setIsCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(clientIds.join(", "));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
  };
  return (
    <div className={styles.copyRow}>
      <Button
        variant="secondary"
        icon={isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        onClick={() => void copy()}
      >
        {isCopied ? t.ruleReviews.copied : t.ruleReviews.copyClientIds}
      </Button>
      <span>{t.ruleReviews.copyHint}</span>
    </div>
  );
}

export function ClientLink({ clientId, returnPath }: { clientId: string; returnPath: string }) {
  return (
    <Link href={transactionsPath({ clientId, returnPath })} className={tableStyles.primaryCell}>
      {clientId}
    </Link>
  );
}

export function FindingClientsTable({
  clients,
  returnPath,
}: {
  clients: FindingClient[];
  returnPath: string;
}) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const shownClients = isExpanded ? clients : clients.slice(0, COLLAPSED_CLIENT_COUNT);
  return (
    <>
      <div className={tableStyles.wrapper}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">{t.ruleReviews.client}</th>
              <th scope="col" className={tableStyles.numeric}>
                {t.ruleReviews.nearMisses}
              </th>
              <th scope="col" className={tableStyles.numeric}>
                {t.ruleReviews.distinctDays}
              </th>
              <th scope="col" className={tableStyles.numeric}>
                {t.ruleReviews.minDistance}
              </th>
            </tr>
          </thead>
          <tbody>
            {shownClients.map((client) => (
              <tr key={client.clientId}>
                <td>
                  <ClientLink clientId={client.clientId} returnPath={returnPath} />
                </td>
                <td className={tableStyles.numeric}>{client.nearMissCount}</td>
                <td className={tableStyles.numeric}>{client.distinctDays}</td>
                <td className={tableStyles.numeric}>
                  {client.minDistance === null ? "–" : formatStepPercent(client.minDistance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {clients.length > COLLAPSED_CLIENT_COUNT && (
        <Button variant="ghost" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded
            ? t.ruleReviews.showFewerClients
            : formatMessage(t.ruleReviews.showAllClients, { count: clients.length })}
        </Button>
      )}
    </>
  );
}
