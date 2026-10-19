import { z } from "zod";

import { requestJson } from "@/lib/httpClient";

import { batchSchema, batchTransactionPageSchema, transactionEvaluationSchema } from "../types";
import type { BatchesService } from "./contract";

const batchPath = (batchId: string) => `/batches/${encodeURIComponent(batchId)}`;

export const liveBatchesService: BatchesService = {
  loadBatches: () => requestJson({ path: "/batches", schema: z.array(batchSchema) }),
  loadBatch: (batchId) => requestJson({ path: batchPath(batchId), schema: batchSchema }),
  uploadBatch: ({ file, uploadedBy }) => {
    const formBody = new FormData();
    formBody.append("file", file);
    formBody.append("uploadedBy", uploadedBy);
    return requestJson({ path: "/batches", method: "POST", formBody, schema: batchSchema });
  },
  loadBatchTransactions: ({ batchId, bucket, cursor }) => {
    const searchParams = new URLSearchParams({ bucket });
    if (cursor) {
      searchParams.set("cursor", cursor);
    }
    return requestJson({
      path: `${batchPath(batchId)}/transactions?${searchParams.toString()}`,
      schema: batchTransactionPageSchema,
    });
  },
  loadTransactionEvaluation: ({ batchId, transactionId }) =>
    requestJson({
      path: `${batchPath(batchId)}/transactions/${encodeURIComponent(transactionId)}`,
      schema: transactionEvaluationSchema,
    }),
};
