import type { Page, PageRequest } from "../pagination";
import type { AmlEventCsvRow, AmlEventDetail, AmlEventFilter, AmlEventListItem } from "./amlEventReadModels";

export interface AmlEventReadRepository {
  // Sorted by priority, highest first (events without a triage last), then by max_score and alert ID.
  listAmlEvents(filter: AmlEventFilter, page: PageRequest): Promise<Page<AmlEventListItem>>;
  // Hits are in chronological order.
  findAmlEventDetail(amlEventId: string): Promise<AmlEventDetail | null>;
  listRunCsvRows(runId: string): Promise<AmlEventCsvRow[]>;
}
