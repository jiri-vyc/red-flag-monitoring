import type { Page, PageRequest } from "../pagination";
import type { AmlEventDetail, AmlEventFilter, AmlEventListItem } from "./amlEventReadModels";

export interface AmlEventReadRepository {
  // Sorted by max_score, highest first, then by alert ID.
  listAmlEvents(filter: AmlEventFilter, page: PageRequest): Promise<Page<AmlEventListItem>>;
  // Hits are in chronological order.
  findAmlEventDetail(amlEventId: string): Promise<AmlEventDetail | null>;
}
