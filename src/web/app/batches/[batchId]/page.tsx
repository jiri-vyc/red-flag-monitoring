import { BatchDetailScreen } from "@/features/batches/components/BatchDetailScreen";
import { bucketSchema } from "@/features/batches/types";

export default async function BatchDetailPage({ params, searchParams }: PageProps<"/batches/[batchId]">) {
  const { batchId } = await params;
  const { bucket } = await searchParams;
  const bucketParseResult = bucketSchema.safeParse(bucket);
  return (
    <BatchDetailScreen
      batchId={batchId}
      selectedBucket={bucketParseResult.success ? bucketParseResult.data : null}
    />
  );
}
