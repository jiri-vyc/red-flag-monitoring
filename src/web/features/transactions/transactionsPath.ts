import { RETURN_PATH_PARAM } from "@/lib/returnPath";

/** The filter lives in the URL, so the list can be shared and opened from the alert detail (issue #9). */
export function transactionsPath({
  clientId,
  highlightedTransactionId = null,
  returnPath = null,
}: {
  clientId: string | null;
  highlightedTransactionId?: string | null;
  returnPath?: string | null;
}): string {
  const searchParams = new URLSearchParams({
    ...(clientId !== null && { clientId }),
    ...(highlightedTransactionId !== null && { highlight: highlightedTransactionId }),
    ...(returnPath !== null && { [RETURN_PATH_PARAM]: returnPath }),
  });
  const query = searchParams.toString();
  return query ? `/transactions?${query}` : "/transactions";
}
