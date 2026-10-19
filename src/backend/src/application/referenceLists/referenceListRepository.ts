import type { ReferenceList, ReferenceListVersion } from "../../domain/referenceList";

export type NewReferenceList = Omit<ReferenceList, "id">;
export type NewReferenceListVersion = Pick<ReferenceListVersion, "listId" | "sourceNote" | "items">;

export interface ReferenceListRepository {
  createList(list: NewReferenceList): Promise<ReferenceList>;
  listLists(): Promise<ReferenceList[]>;
  findList(listId: string): Promise<ReferenceList | null>;
  // Assigns the next version_no of the list and stores its items.
  createVersion(version: NewReferenceListVersion): Promise<ReferenceListVersion>;
  listVersions(listId: string): Promise<ReferenceListVersion[]>;
  findVersion(versionId: string): Promise<ReferenceListVersion | null>;
}
