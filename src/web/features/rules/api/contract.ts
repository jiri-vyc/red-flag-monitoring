import type {
  AddWhitelistEntryInput,
  CreateManualRuleInput,
  CreateRuleVersionInput,
  RemoveWhitelistEntryInput,
  Rule,
  UpdateDraftContentInput,
  WhitelistEntry,
} from "../types";

export type ReviewInput = { ruleId: string; reviewer: string };

export interface RulesService {
  loadRules(): Promise<Rule[]>;
  loadRule(ruleId: string): Promise<Rule>;
  /** The backend generates code + explanation (deterministic) or rule text (agentic) from the description. */
  createManualRule(input: CreateManualRuleInput & { author: string }): Promise<Rule>;
  submitRuleForReview(ruleId: string): Promise<Rule>;
  approveRule(input: ReviewInput): Promise<Rule>;
  rejectRule(input: ReviewInput): Promise<Rule>;
  activateRule(ruleId: string): Promise<Rule>;
  deactivateRule(ruleId: string): Promise<Rule>;
  createRuleVersion(input: CreateRuleVersionInput & { author: string }): Promise<Rule>;
  updateDraftContent(input: UpdateDraftContentInput): Promise<Rule>;
  /** Whitelist changes take effect immediately: no new version, no review (M16). */
  getWhitelist(ruleId: string): Promise<WhitelistEntry[]>;
  addWhitelistEntry(input: AddWhitelistEntryInput & { author: string }): Promise<WhitelistEntry>;
  removeWhitelistEntry(input: RemoveWhitelistEntryInput): Promise<void>;
}
