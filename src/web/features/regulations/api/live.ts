import { z } from "zod";

import { requestJson } from "@/lib/httpClient";

import { regulationSchema } from "../types";
import type { RegulationsService } from "./contract";

export const liveRegulationsService: RegulationsService = {
  loadRegulations: () => requestJson({ path: "/regulations", schema: z.array(regulationSchema) }),
  loadRegulation: (regulationId) =>
    requestJson({ path: `/regulations/${encodeURIComponent(regulationId)}`, schema: regulationSchema }),
};
