import type { RegulationsService } from "@/features/regulations/api/contract";

import { simulateLatency } from "../latency";
import { throwMockNotFound } from "../notFound";
import { readMockDatabase } from "../store/mockDatabase";
import { mapRegulationRecord } from "./mappers";

export const mockRegulationsService: RegulationsService = {
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
};
