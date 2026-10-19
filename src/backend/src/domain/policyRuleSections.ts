// Internal policies give every monitoring rule its own heading, e.g. "### R-01 …" or "### Čl. 5 R-07 …".
export function isRuleDefinedInPolicy(policyBody: string, ruleId: string): boolean {
  const ruleIdToken = new RegExp(`(^|\\s)${escapeRegExp(ruleId)}(\\s|$)`);

  return policyBody
    .split("\n")
    .some((line) => line.startsWith("#") && ruleIdToken.test(line.replace(/^#+/, "")));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
