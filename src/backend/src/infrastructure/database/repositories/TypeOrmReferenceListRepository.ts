import { type DataSource, In } from "typeorm";

import type { ReferenceList, ReferenceListVersion } from "../../../domain/referenceList";
import type {
  NewReferenceList,
  NewReferenceListVersion,
  ReferenceListRepository,
} from "../../../application/referenceLists/referenceListRepository";
import { ReferenceListEntity } from "../entities/ReferenceListEntity";
import { ReferenceListItemEntity } from "../entities/ReferenceListItemEntity";
import { ReferenceListVersionEntity } from "../entities/ReferenceListVersionEntity";
import { translateDatabaseErrors } from "../translateDatabaseErrors";
import { toNextVersionNo } from "./versionWrites";

export class TypeOrmReferenceListRepository implements ReferenceListRepository {
  constructor(private readonly dataSource: DataSource) {}

  async createList(list: NewReferenceList): Promise<ReferenceList> {
    const lists = this.dataSource.getRepository(ReferenceListEntity);
    const saved = await translateDatabaseErrors(() => lists.save(lists.create(list)));

    return toReferenceList(saved);
  }

  async listLists(): Promise<ReferenceList[]> {
    const entities = await this.dataSource
      .getRepository(ReferenceListEntity)
      .find({ order: { code: "ASC" } });

    return entities.map(toReferenceList);
  }

  async findList(listId: string): Promise<ReferenceList | null> {
    const entity = await this.dataSource.getRepository(ReferenceListEntity).findOneBy({ id: listId });

    return entity ? toReferenceList(entity) : null;
  }

  createVersion(version: NewReferenceListVersion): Promise<ReferenceListVersion> {
    return translateDatabaseErrors(() =>
      this.dataSource.transaction(async (manager) => {
        const maxVersionNo = await manager.maximum(ReferenceListVersionEntity, "versionNo", {
          listId: version.listId,
        });
        const saved = await manager.save(
          manager.create(ReferenceListVersionEntity, {
            listId: version.listId,
            sourceNote: version.sourceNote,
            versionNo: toNextVersionNo(maxVersionNo),
          }),
        );

        if (version.items.length > 0) {
          await manager.insert(
            ReferenceListItemEntity,
            version.items.map((value) => ({ listVersionId: saved.id, value })),
          );
        }

        return toReferenceListVersion(saved, [...version.items].sort());
      }),
    );
  }

  async listVersions(listId: string): Promise<ReferenceListVersion[]> {
    const entities = await this.dataSource
      .getRepository(ReferenceListVersionEntity)
      .find({ where: { listId }, order: { versionNo: "ASC" } });

    return this.withItems(entities);
  }

  async findVersion(versionId: string): Promise<ReferenceListVersion | null> {
    const entity = await this.dataSource
      .getRepository(ReferenceListVersionEntity)
      .findOneBy({ id: versionId });
    const [version] = entity ? await this.withItems([entity]) : [];

    return version ?? null;
  }

  private async withItems(entities: ReferenceListVersionEntity[]): Promise<ReferenceListVersion[]> {
    const items = await this.dataSource.getRepository(ReferenceListItemEntity).find({
      where: { listVersionId: In(entities.map((entity) => entity.id)) },
      order: { value: "ASC" },
    });

    return entities.map((entity) =>
      toReferenceListVersion(
        entity,
        items.filter((item) => item.listVersionId === entity.id).map((item) => item.value),
      ),
    );
  }
}

function toReferenceList(entity: ReferenceListEntity): ReferenceList {
  return { id: entity.id, code: entity.code, title: entity.title };
}

function toReferenceListVersion(entity: ReferenceListVersionEntity, items: string[]): ReferenceListVersion {
  return {
    id: entity.id,
    listId: entity.listId,
    versionNo: entity.versionNo,
    sourceNote: entity.sourceNote,
    createdAt: entity.createdAt,
    items,
  };
}
