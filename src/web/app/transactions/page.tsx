import { TransactionsScreen } from "@/features/transactions/components/TransactionsScreen";
import { CLIENT_ID_PATTERN } from "@/features/transactions/types";
import { readReturnPath, RETURN_PATH_PARAM } from "@/lib/returnPath";

function readClientId(value: string | string[] | undefined): string | null {
  return typeof value === "string" && CLIENT_ID_PATTERN.test(value) ? value : null;
}

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const { clientId, highlight, [RETURN_PATH_PARAM]: returnPath } = await searchParams;
  return (
    <TransactionsScreen
      clientId={readClientId(clientId)}
      highlightedTransactionId={typeof highlight === "string" ? highlight : null}
      returnPath={readReturnPath(returnPath)}
    />
  );
}
