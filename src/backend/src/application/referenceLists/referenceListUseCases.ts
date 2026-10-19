import type { ReferenceList, ReferenceListVersion } from "../../domain/referenceList";
import { NotFoundError } from "../errors";
import type {
  NewReferenceList,
  NewReferenceListVersion,
  ReferenceListRepository,
} from "./referenceListRepository";

// M9: a list changes only by adding a new version; COMPLIANCE REVIEW: versions are not approved.
export class ReferenceListUseCases {
  constructor(private readonly referenceListRepository: ReferenceListRepository) {}

  createList(list: NewReferenceList): Promise<ReferenceList> {
    return this.referenceListRepository.createList(list);
  }

  listLists(): Promise<ReferenceList[]> {
    return this.referenceListRepository.listLists();
  }

  async getList(listId: string): Promise<ReferenceList> {
    const list = await this.referenceListRepository.findList(listId);

    if (!list) {
      throw new NotFoundError("Reference list", listId);
    }

    return list;
  }

  async createVersion(version: NewReferenceListVersion): Promise<ReferenceListVersion> {
    await this.getList(version.listId);

    return this.referenceListRepository.createVersion(version);
  }

  async listVersions(listId: string): Promise<ReferenceListVersion[]> {
    await this.getList(listId);

    return this.referenceListRepository.listVersions(listId);
  }

  async getVersion(listId: string, versionId: string): Promise<ReferenceListVersion> {
    const version = await this.referenceListRepository.findVersion(versionId);

    if (!version || version.listId !== listId) {
      throw new NotFoundError("Reference list version", versionId);
    }

    return version;
  }
}
