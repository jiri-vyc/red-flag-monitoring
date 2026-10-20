import { recordAuditEvent } from "../audit/auditLog";
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

  async createList(list: NewReferenceList): Promise<ReferenceList> {
    const created = await this.referenceListRepository.createList(list);

    recordAuditEvent({
      action: "reference_list.created",
      entityType: "reference_list",
      entityId: created.id,
      actorId: null,
      payload: { code: created.code },
    });

    return created;
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
    const created = await this.referenceListRepository.createVersion(version);

    recordAuditEvent({
      action: "reference_list.version_created",
      entityType: "reference_list",
      entityId: version.listId,
      actorId: null,
      payload: { versionId: created.id, itemCount: version.items.length, sourceNote: version.sourceNote },
    });

    return created;
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
