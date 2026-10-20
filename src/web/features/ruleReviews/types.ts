import type {
  FindingClientDto,
  FindingDto,
  FindingExplanationDto,
  RuleHypothesisDto,
  RuleReviewReportDto,
  RuleReviewSummaryDto,
} from "./api/dto";

export type RuleReviewSummary = RuleReviewSummaryDto;
export type RuleReviewReport = RuleReviewReportDto;
export type RuleReviewStatus = RuleReviewReport["status"];
export type Finding = FindingDto;
export type FindingKind = Finding["kind"];
export type FindingClient = FindingClientDto;
export type FindingExplanation = FindingExplanationDto;
export type RuleHypothesis = RuleHypothesisDto;
export type ParameterProposal = Extract<NonNullable<Finding["proposal"]>, { parameter: string }>;

export function isParameterProposal(proposal: unknown): proposal is ParameterProposal {
  return typeof proposal === "object" && proposal !== null && "parameter" in proposal;
}
