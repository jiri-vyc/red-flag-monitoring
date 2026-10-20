import { parseBucketParam } from "@/features/batches/batchPaths";
import { BatchDetailScreen } from "@/features/batches/components/BatchDetailScreen";

export default async function BatchDetailPage({ params, searchParams }: PageProps<"/batches/[batchId]">) {
  const { batchId } = await params;
  const { bucket } = await searchParams;
  return <BatchDetailScreen batchId={batchId} selectedBucket={parseBucketParam(bucket)} />;
}
