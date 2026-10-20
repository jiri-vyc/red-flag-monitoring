import { ApiError } from "@/lib/apiError";

import type { FauReportsService } from "./contract";

// Issue #20: the backend `fau_reports` API (POST /api/aml-events/:id/fau-reports, GET/PATCH /api/fau-reports/:id,
// …/submit-for-approval, /approve, /reject, /mark-submitted) does not exist yet. The capability hides the
// feature in live mode; these throws are only the safety net.
function throwUnsupported(): never {
  throw new ApiError({ kind: "unsupported", message: "The backend has no FAÚ reports API yet (issue #20)." });
}

export const liveFauReportsService: FauReportsService = {
  capabilities: { canUseFauReports: false },
  findReportForAlert: async () => throwUnsupported(),
  loadReport: async () => throwUnsupported(),
  createReport: async () => throwUnsupported(),
  updateDraft: async () => throwUnsupported(),
  submitForApproval: async () => throwUnsupported(),
  approve: async () => throwUnsupported(),
  reject: async () => throwUnsupported(),
  markSubmitted: async () => throwUnsupported(),
};
