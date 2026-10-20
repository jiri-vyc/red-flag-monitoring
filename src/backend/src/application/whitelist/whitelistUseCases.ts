import { canWhitelistClients, type Rule } from "../../domain/rule";
import type { WhitelistEntry } from "../../domain/whitelist";
import { recordAuditEvent } from "../audit/auditLog";
import { BusinessRuleViolationError, NotFoundError } from "../errors";
import type { RuleRepository } from "../rules/ruleRepository";
import type { NewWhitelistEntry, WhitelistEntryKey, WhitelistRepository } from "./whitelistRepository";

// COMPLIANCE REVIEW: entries take effect without approval (M16, ČNB benchmark 2/2023 III.ii). Changes are audited in
// the logs only, and a removal has no actor because the API takes none yet.
export class WhitelistUseCases {
  constructor(
    private readonly whitelistRepository: WhitelistRepository,
    private readonly ruleRepository: RuleRepository,
  ) {}

  async listEntries(ruleId: string): Promise<WhitelistEntry[]> {
    await this.getRule(ruleId);

    return this.whitelistRepository.listEntries(ruleId);
  }

  async addEntry(entry: NewWhitelistEntry): Promise<WhitelistEntry> {
    const rule = await this.getRule(entry.ruleId);

    if (!canWhitelistClients(rule)) {
      throw new BusinessRuleViolationError(`Rule ${rule.code} does not allow whitelisting clients`);
    }

    const created = await this.whitelistRepository.addEntry(entry);

    recordAuditEvent({
      action: "whitelist_entry.added",
      entityType: "whitelist_entry",
      entityId: `${entry.ruleId}:${entry.clientId}`,
      actorId: entry.createdBy,
      payload: { ruleId: entry.ruleId, ruleCode: rule.code, clientId: entry.clientId, reason: entry.reason },
    });

    return created;
  }

  async removeEntry(key: WhitelistEntryKey): Promise<void> {
    const entries = await this.whitelistRepository.listEntries(key.ruleId);
    const removedEntry = entries.find((entry) => entry.clientId === key.clientId);
    const isRemoved = await this.whitelistRepository.removeEntry(key);

    if (!isRemoved) {
      throw new NotFoundError("Whitelist entry", `${key.ruleId}/${key.clientId}`);
    }

    recordAuditEvent({
      action: "whitelist_entry.removed",
      entityType: "whitelist_entry",
      entityId: `${key.ruleId}:${key.clientId}`,
      actorId: null,
      payload: {
        ruleId: key.ruleId,
        clientId: key.clientId,
        removedEntry: removedEntry
          ? {
              reason: removedEntry.reason,
              createdBy: removedEntry.createdBy,
              createdAt: removedEntry.createdAt.toISOString(),
            }
          : null,
      },
    });
  }

  private async getRule(ruleId: string): Promise<Rule> {
    const rule = await this.ruleRepository.findRule(ruleId);

    if (!rule) {
      throw new NotFoundError("Rule", ruleId);
    }

    return rule;
  }
}
