import { TransactionEvaluationScreen } from "@/features/batches/components/TransactionEvaluationScreen";

export default async function TransactionEvaluationPage({
  params,
}: PageProps<"/batches/[batchId]/transactions/[transactionId]">) {
  const { batchId, transactionId } = await params;
  return <TransactionEvaluationScreen batchId={batchId} transactionId={transactionId} />;
}
