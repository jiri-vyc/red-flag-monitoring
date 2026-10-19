import type { WhitelistEntry } from "../../domain/whitelist";
import { ConflictError } from "../errors";
import type {
  NewWhitelistEntry,
  WhitelistEntryKey,
  WhitelistRepository,
} from "../whitelist/whitelistRepository";

export class InMemoryWhitelistRepository implements WhitelistRepository {
  readonly entries: WhitelistEntry[] = [];

  async listEntries(ruleId: string): Promise<WhitelistEntry[]> {
    return this.entries.filter((entry) => entry.ruleId === ruleId);
  }

  async addEntry(entry: NewWhitelistEntry): Promise<WhitelistEntry> {
    if (this.findIndex(entry) >= 0) {
      throw new ConflictError("Already whitelisted");
    }

    const created = { ...entry, id: `whitelist-${this.entries.length + 1}`, createdAt: new Date(0) };
    this.entries.push(created);

    return created;
  }

  async removeEntry(key: WhitelistEntryKey): Promise<boolean> {
    const index = this.findIndex(key);

    if (index < 0) {
      return false;
    }

    this.entries.splice(index, 1);

    return true;
  }

  private findIndex(key: WhitelistEntryKey): number {
    return this.entries.findIndex((entry) => entry.ruleId === key.ruleId && entry.clientId === key.clientId);
  }
}
