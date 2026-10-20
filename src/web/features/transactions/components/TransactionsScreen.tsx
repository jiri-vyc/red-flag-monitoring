"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { Field, fieldStyles } from "@/components/ui/Field";
import { LoadingRing } from "@/components/ui/LoadingRing";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/StateViews";
import { formatTransactionType } from "@/features/batches/domain/transactionType";
import type { TransactionView } from "@/features/batches/types";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatAmount, formatDateTime, formatNumber } from "@/lib/format";
import { useInfiniteScroll } from "@/lib/useInfiniteScroll";

import { useTransactions } from "../api/hooks";
import { transactionsPath } from "../transactionsPath";
import { CLIENT_ID_PATTERN } from "../types";
import styles from "./TransactionsScreen.module.css";

/** Newest first, the evaluated transaction can sit a few pages down; stop before paging a whole dataset. */
const MAX_PAGES_TO_REVEAL_HIGHLIGHT = 20;

type TransactionsScreenProps = {
  clientId: string | null;
  highlightedTransactionId: string | null;
  returnPath: string | null;
};

function ClientFilter({ clientId, returnPath }: { clientId: string | null; returnPath: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(clientId ?? "");
  const [hasInvalidValue, setHasInvalidValue] = useState(false);

  const applyFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextClientId = value.trim().toUpperCase();
    if (nextClientId !== "" && !CLIENT_ID_PATTERN.test(nextClientId)) {
      setHasInvalidValue(true);
      return;
    }
    setHasInvalidValue(false);
    router.push(transactionsPath({ clientId: nextClientId || null, returnPath }));
  };

  return (
    <form className={styles.filter} onSubmit={applyFilter}>
      <Field
        label={t.transactions.clientFilter}
        htmlFor={inputId}
        hint={t.transactions.clientFilterHint}
        error={hasInvalidValue ? t.transactions.clientFilterError : null}
      >
        <div className={styles.filterRow}>
          <input
            id={inputId}
            className={fieldStyles.input}
            value={value}
            placeholder="K000123"
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="submit">{t.transactions.applyFilter}</Button>
        </div>
      </Field>
    </form>
  );
}

function TransactionRow({
  transaction,
  isHighlighted,
  showsClient,
}: {
  transaction: TransactionView;
  isHighlighted: boolean;
  showsClient: boolean;
}) {
  const { t, locale } = useI18n();
  // Stable, so the row scrolls into view once when it mounts, not again when more pages load.
  const scrollIntoView = useCallback((row: HTMLTableRowElement | null) => {
    row?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <tr
      ref={isHighlighted ? scrollIntoView : undefined}
      className={isHighlighted ? styles.highlighted : undefined}
      aria-current={isHighlighted || undefined}
    >
      <td className={tableStyles.mono}>
        {transaction.transactionId}
        {isHighlighted && <span className="visually-hidden"> ({t.transactions.evaluatedTransaction})</span>}
      </td>
      {showsClient && <td className={tableStyles.mono}>{transaction.clientId}</td>}
      <td>{formatDateTime(transaction.bookedAt, locale)}</td>
      <td>{formatTransactionType(transaction.transactionType, t.transactionType)}</td>
      <td className={tableStyles.numeric}>
        {formatAmount({ amount: transaction.amount, currency: transaction.currency, locale })}
      </td>
      <td>
        <span className={styles.party}>
          <span className={tableStyles.mono}>{transaction.payerAccount || "–"}</span>
          <span className={tableStyles.secondaryText}>{transaction.payerCountry || "–"}</span>
        </span>
      </td>
      <td>
        <span className={styles.party}>
          <span className={tableStyles.mono}>{transaction.payeeAccount || "–"}</span>
          <span className={tableStyles.secondaryText}>{transaction.payeeCountry || "–"}</span>
        </span>
      </td>
    </tr>
  );
}

function TransactionList({
  clientId,
  highlightedTransactionId,
}: {
  clientId: string | null;
  highlightedTransactionId: string | null;
}) {
  const { t, locale } = useI18n();
  const transactionsQuery = useTransactions({ clientId });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = transactionsQuery;
  const sentinelRef = useInfiniteScroll({
    canLoadMore: hasNextPage && !isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
  });
  const loadedPages = transactionsQuery.data?.pages;
  const isHighlightLoaded = (loadedPages ?? []).some((page) =>
    page.items.some((transaction) => transaction.transactionId === highlightedTransactionId),
  );
  const shouldLoadTowardsHighlight =
    highlightedTransactionId !== null &&
    loadedPages !== undefined &&
    loadedPages.length < MAX_PAGES_TO_REVEAL_HIGHLIGHT &&
    !isHighlightLoaded &&
    hasNextPage &&
    !isFetchingNextPage;
  useEffect(() => {
    if (shouldLoadTowardsHighlight) {
      void fetchNextPage();
    }
  }, [shouldLoadTowardsHighlight, fetchNextPage]);

  if (transactionsQuery.isPending) {
    return <LoadingRing label={t.common.loading} />;
  }
  if (transactionsQuery.isError) {
    return <ErrorState error={transactionsQuery.error} onRetry={() => void transactionsQuery.refetch()} />;
  }
  const transactions = transactionsQuery.data.pages.flatMap((page) => page.items);
  if (transactions.length === 0) {
    return <EmptyState message={t.transactions.empty} />;
  }
  const totalCount = transactionsQuery.data.pages.at(-1)?.totalCount ?? transactions.length;

  return (
    <div className={styles.list}>
      <p className={tableStyles.secondaryText}>
        {formatMessage(t.transactions.totalCount, { count: formatNumber(totalCount, locale) })}
      </p>
      <div className={tableStyles.wrapper}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">{t.batches.transaction}</th>
              {/* With a client filter every row has the same client. */}
              {clientId === null && <th scope="col">{t.batches.client}</th>}
              <th scope="col">{t.batches.bookedAt}</th>
              <th scope="col">{t.transactionDetail.type}</th>
              <th scope="col" className={tableStyles.numeric}>
                {t.batches.amount}
              </th>
              <th scope="col">{t.transactions.payer}</th>
              <th scope="col">{t.transactions.payee}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <TransactionRow
                key={transaction.transactionId}
                transaction={transaction}
                isHighlighted={transaction.transactionId === highlightedTransactionId}
                showsClient={clientId === null}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div ref={sentinelRef} className={styles.listFooter}>
        {hasNextPage ? (
          <Button variant="secondary" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            {isFetchingNextPage ? t.common.loadingMore : t.common.loadMore}
          </Button>
        ) : (
          <span className={tableStyles.secondaryText}>{t.transactions.allLoaded}</span>
        )}
      </div>
    </div>
  );
}

/** Issue #9: the data behind a rule's trace, so the analyst can check and justify the alert. */
export function TransactionsScreen({
  clientId,
  highlightedTransactionId,
  returnPath,
}: TransactionsScreenProps) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        backLink={returnPath ? { href: returnPath, label: t.transactions.backToEvaluation } : undefined}
        title={clientId ? formatMessage(t.transactions.titleForClient, { clientId }) : t.transactions.title}
        description={t.transactions.description}
      />
      <Card>
        {/* The key resets the input when the URL filter changes, e.g. on back navigation. */}
        <ClientFilter key={clientId ?? ""} clientId={clientId} returnPath={returnPath} />
      </Card>
      <Card>
        <TransactionList
          key={clientId ?? ""}
          clientId={clientId}
          highlightedTransactionId={highlightedTransactionId}
        />
      </Card>
    </>
  );
}
