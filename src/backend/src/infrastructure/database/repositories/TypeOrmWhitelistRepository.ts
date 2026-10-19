import type { DataSource } from "typeorm";

import type { WhitelistEntry } from "../../../domain/whitelist";
import type {
  NewWhitelistEntry,
  WhitelistEntryKey,
  WhitelistRepository,
} from "../../../application/whitelist/whitelistRepository";
import { WhitelistEntryEntity } from "../entities/WhitelistEntryEntity";
import { translateDatabaseErrors } from "../translateDatabaseErrors";

export class TypeOrmWhitelistRepository implements WhitelistRepository {
  constructor(private readonly dataSource: DataSource) {}

  async listEntries(ruleId: string): Promise<WhitelistEntry[]> {
    const entities = await this.dataSource
      .getRepository(WhitelistEntryEntity)
      .find({ where: { ruleId }, order: { clientId: "ASC" } });

    return entities.map(toWhitelistEntry);
  }

  async addEntry(entry: NewWhitelistEntry): Promise<WhitelistEntry> {
    const entries = this.dataSource.getRepository(WhitelistEntryEntity);
    const saved = await translateDatabaseErrors(() => entries.save(entries.create(entry)));

    return toWhitelistEntry(saved);
  }

  async removeEntry(key: WhitelistEntryKey): Promise<boolean> {
    const result = await this.dataSource.getRepository(WhitelistEntryEntity).delete(key);

    return (result.affected ?? 0) > 0;
  }
}

function toWhitelistEntry(entity: WhitelistEntryEntity): WhitelistEntry {
  return {
    id: entity.id,
    ruleId: entity.ruleId,
    clientId: entity.clientId,
    reason: entity.reason,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
  };
}
