// Institution-wide numbering of internal policies (SVZ-03, SVZ-06, …) and monitoring rules (R-01 … R-17).
const POLICY_CODE_PATTERN = /^SVZ-(\d+)/;
const RULE_CODE_PATTERN = /^R-(\d+)/;
const NUMBER_WIDTH = 2;

export function findNextPolicyCode(existingPolicyCodes: string[]): string {
  const nextNumber = findHighestNumber(existingPolicyCodes, POLICY_CODE_PATTERN) + 1;

  return `SVZ-${String(nextNumber).padStart(NUMBER_WIDTH, "0")}`;
}

// Rule IDs live both on stored rules and in policies whose rules are not drafted yet; both count as taken.
export function findNextRuleNumber(takenRuleIds: string[]): number {
  return findHighestNumber(takenRuleIds, RULE_CODE_PATTERN) + 1;
}

function findHighestNumber(codes: string[], pattern: RegExp): number {
  return codes.reduce((highest, code) => {
    const number = Number(pattern.exec(code)?.[1] ?? 0);

    return Math.max(highest, number);
  }, 0);
}
