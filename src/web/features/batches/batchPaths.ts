import { bucketSchema, DEFAULT_BUCKET, type Bucket } from "./types";

// IDs are encoded: CSV transaction IDs can contain `/`, `?` or `#`, which would break the route.

/** Web route of a batch detail, optionally filtered to one bucket. Not an API path. */
export function batchPath(batchId: string, bucket?: Bucket): string {
  const path = `/batches/${encodeURIComponent(batchId)}`;
  return bucket === undefined ? path : `${path}?bucket=${bucket}`;
}

/** The bucket a batch detail shows: the `bucket` search param, or the default one when it is missing or invalid. */
export function parseBucketParam(bucketParam: unknown): Bucket {
  const bucketParseResult = bucketSchema.safeParse(bucketParam);
  return bucketParseResult.success ? bucketParseResult.data : DEFAULT_BUCKET;
}

/** Web route of one evaluated transaction of a batch. Not an API path. */
export function batchTransactionPath(batchId: string, transactionId: string): string {
  return `${batchPath(batchId)}/transactions/${encodeURIComponent(transactionId)}`;
}
