import { canWhitelistClients, type Rule } from "../../domain/rule";
import type { WhitelistEntry } from "../../domain/whitelist";
import { BusinessRuleViolationError, NotFoundError } from "../errors";
import type { RuleRepository } from "../rules/ruleRepository";
import type { NewWhitelistEntry, WhitelistEntryKey, WhitelistRepository } from "./whitelistRepository";

// COMPLIANCE REVIEW: entries take effect without approval and removal leaves no audit trail yet (M16,
// ČNB benchmark 2/2023 III.ii).
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

    return this.whitelistRepository.addEntry(entry);
  }

  async removeEntry(key: WhitelistEntryKey): Promise<void> {
    const isRemoved = await this.whitelistRepository.removeEntry(key);

    if (!isRemoved) {
      throw new NotFoundError("Whitelist entry", `${key.ruleId}/${key.clientId}`);
    }
  }

  private async getRule(ruleId: string): Promise<Rule> {
    const rule = await this.ruleRepository.findRule(ruleId);

    if (!rule) {
      throw new NotFoundError("Rule", ruleId);
    }

    return rule;
  }
}
