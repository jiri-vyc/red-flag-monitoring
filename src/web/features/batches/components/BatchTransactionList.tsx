"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import tableStyles from "@/components/ui/DataTable.module.css";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { EmptyState, ErrorState } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";
import { formatAmount, formatDateTime } from "@/lib/format";
import { useInfiniteScroll } from "@/lib/useInfiniteScroll";

import { useBatchTransactions } from "../api/hooks";
import { batchTransactionPath } from "../batchPaths";
import type { Bucket } from "../types";
import styles from "./BatchDetail.module.css";

export function BatchTransactionList({ batchId, bucket }: { batchId: string; bucket: Bucket }) {
  const { t, locale } = useI18n();
  const transactionsQuery = useBatchTransactions({ batchId, bucket });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = transactionsQuery;
  const sentinelRef = useInfiniteScroll({
    canLoadMore: hasNextPage && !isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
  });

  if (transactionsQuery.isPending) {
    return <LoadingRing label={t.common.loading} />;
  }
  if (transactionsQuery.isError) {
    return <ErrorState error={transactionsQuery.error} onRetry={() => void transactionsQuery.refetch()} />;
  }
  const transactions = transactionsQuery.data.pages.flatMap((page) => page.items);
  if (transactions.length === 0) {
    return <EmptyState message={t.batches.noTransactions} />;
  }

  return (
    <div className={styles.transactionList}>
      <div className={tableStyles.wrapper}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">{t.batches.transaction}</th>
              <th scope="col">{t.batches.client}</th>
              <th scope="col">{t.batches.bookedAt}</th>
              <th scope="col" className={tableStyles.numeric}>
                {t.batches.amount}
              </th>
              <th scope="col">{t.batches.route}</th>
              <th scope="col" className={tableStyles.numeric}>
                {t.batches.failedRules}
              </th>
              <th scope="col" className={tableStyles.numeric}>
                {t.batches.maxScore}
              </th>
              <th scope="col">
                <span className="visually-hidden">{t.common.open}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(({ transaction, failedRuleCount, maxAdjustedScore }) => {
              const detailHref = batchTransactionPath(batchId, transaction.transactionId);
              return (
                <tr key={transaction.transactionId} className={styles.clickableRow}>
                  <td>
                    <Link href={detailHref} className={`${tableStyles.mono} ${styles.rowLink}`}>
                      {transaction.transactionId}
                    </Link>
                  </td>
                  <td className={tableStyles.mono}>{transaction.clientId}</td>
                  <td>{formatDateTime(transaction.bookedAt, locale)}</td>
                  <td className={tableStyles.numeric}>
                    {formatAmount({ amount: transaction.amount, currency: transaction.currency, locale })}
                  </td>
                  <td>
                    {transaction.payerCountry || "–"} → {transaction.payeeCountry || "–"}
                  </td>
                  <td className={tableStyles.numeric}>
                    <strong className={failedRuleCount > 0 ? styles.failedCount : undefined}>
                      {failedRuleCount}
                    </strong>
                  </td>
                  <td className={tableStyles.numeric}>{maxAdjustedScore}</td>
                  <td>
                    <ChevronRight aria-hidden="true" className={styles.rowChevron} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div ref={sentinelRef} className={styles.listFooter}>
        {hasNextPage ? (
          <Button variant="secondary" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            {isFetchingNextPage ? t.common.loadingMore : t.common.loadMore}
          </Button>
        ) : (
          <span className={tableStyles.secondaryText}>{t.batches.allLoaded}</span>
        )}
      </div>
    </div>
  );
}
