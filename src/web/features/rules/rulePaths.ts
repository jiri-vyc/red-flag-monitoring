// The ID is encoded so a rule ID with `/`, `?` or `#` cannot break the route.

/** Web route of a rule detail. Not an API path (that is `rulePath` in api/dto.ts). */
export function ruleDetailPath(ruleId: string): string {
  return `/rules/${encodeURIComponent(ruleId)}`;
}
