import type { WhitelistEntry } from "../../domain/whitelist";

export type NewWhitelistEntry = Pick<WhitelistEntry, "ruleId" | "clientId" | "reason" | "createdBy">;
export type WhitelistEntryKey = Pick<WhitelistEntry, "ruleId" | "clientId">;

export interface WhitelistRepository {
  listEntries(ruleId: string): Promise<WhitelistEntry[]>;
  addEntry(entry: NewWhitelistEntry): Promise<WhitelistEntry>;
  // Returns false when there was no such entry.
  removeEntry(key: WhitelistEntryKey): Promise<boolean>;
}
