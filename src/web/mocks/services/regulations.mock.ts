import type { RegulationsService } from "@/features/regulations/api/contract";
import { findRegulationDeletionBlocker } from "@/features/regulations/domain/regulationDeletion";
import { ApiError } from "@/lib/apiError";

import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import { readMockDatabase, writeMockDatabase } from "../store/mockDatabase";
import { mapRegulationRecord } from "./mappers";

export const mockRegulationsService: RegulationsService = {
  capabilities: { canDeleteRegulation: true },

  async loadRegulations() {
    await simulateLatency();
    const database = readMockDatabase();
    return database.regulations.map((record) => mapRegulationRecord(record, database));
  },

  async loadRegulation(regulationId) {
    await simulateLatency();
    const database = readMockDatabase();
    const record = database.regulations.find((regulation) => regulation.id === regulationId);
    if (!record) {
      return throwMockNotFound("Regulation", regulationId);
    }
    return mapRegulationRecord(record, database);
  },

  async loadRegulationNames() {
    await simulateLatency();
    const { regulations } = readMockDatabase();
    return Object.fromEntries(regulations.map((regulation) => [regulation.id, regulation.shortName]));
  },

  // The UI only offers deletion when nothing cites the regulation; this check is the safety net.
  async deleteRegulation({ regulationId }) {
    await simulateLatency();
    const database = readMockDatabase();
    if (!database.regulations.some((regulation) => regulation.id === regulationId)) {
      return throwMockNotFound("Regulation", regulationId);
    }
    const blocker = findRegulationDeletionBlocker(regulationId, database);
    if (blocker !== null) {
      throw new ApiError({
        kind: "validation",
        message: `Regulation "${regulationId}" cannot be deleted (${blocker}).`,
      });
    }
    // The mock record holds the regulation's only version and text, so dropping it removes them too.
    writeMockDatabase({
      ...database,
      regulations: database.regulations.filter((regulation) => regulation.id !== regulationId),
    });
  },
};
