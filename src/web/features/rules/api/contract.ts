import type {
  AddWhitelistEntryInput,
  CreateManualRuleInput,
  CreateRuleVersionInput,
  RemoveWhitelistEntryInput,
  Rule,
  UpdateDraftContentInput,
  WhitelistEntry,
} from "../types";
import type { UserRole } from "@/features/users/types";

/** The reviewer may also change who the version's hits are escalated to (issue #6); null keeps it. */
export type ReviewInput = { ruleId: string; reviewer: string; escalationRole: UserRole | null };
/** A rejection is an AML decision and must carry its reason; it is stored as the review comment. */
export type RejectInput = ReviewInput & { comment: string };
/** The actor is recorded in the audit trail of the deletion. */
export type DeleteRuleInput = { ruleId: string; deletedBy: string };

/** What the active implementation supports. The UI hides actions that are false instead of letting them fail. */
export type RulesCapabilities = {
  /** Change the content of a version that was not reviewed yet, without creating a new version. */
  canEditDraftContent: boolean;
  /** Create a deterministic rule from a description; the backend must generate its definition. */
  canCreateDeterministicRule: boolean;
  /** Create an agentic rule from a description. */
  canCreateAgenticRule: boolean;
  /** Offer known client IDs when adding a whitelist entry. */
  canSuggestWhitelistClients: boolean;
  /** Delete a rule that never had an approved version (see canDeleteRule in the rule lifecycle). */
  canDeleteRule: boolean;
};

export interface RulesService {
  readonly capabilities: RulesCapabilities;
  loadRules(): Promise<Rule[]>;
  loadRule(ruleId: string): Promise<Rule>;
  /** The backend generates code + explanation (deterministic) or rule text (agentic) from the description. */
  createManualRule(input: CreateManualRuleInput & { author: string }): Promise<Rule>;
  submitRuleForReview(ruleId: string): Promise<Rule>;
  approveRule(input: ReviewInput): Promise<Rule>;
  rejectRule(input: RejectInput): Promise<Rule>;
  activateRule(ruleId: string): Promise<Rule>;
  deactivateRule(ruleId: string): Promise<Rule>;
  createRuleVersion(input: CreateRuleVersionInput & { author: string }): Promise<Rule>;
  updateDraftContent(input: UpdateDraftContentInput): Promise<Rule>;
  /** Removes the rule with its versions and whitelist entries; refused once a version was approved. */
  deleteRule(input: DeleteRuleInput): Promise<void>;
  /** Whitelist changes take effect immediately: no new version, no review (M16). */
  getWhitelist(ruleId: string): Promise<WhitelistEntry[]>;
  addWhitelistEntry(input: AddWhitelistEntryInput & { author: string }): Promise<WhitelistEntry>;
  removeWhitelistEntry(input: RemoveWhitelistEntryInput): Promise<void>;
}
