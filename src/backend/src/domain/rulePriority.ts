const DEFAULT_HIT_THRESHOLD = 50;
const MAX_PRIORITY = 100;

// Policies give each rule a priority base 0–100 ("Priorita (základ)", Tabulka P in SVZ-03). Every match of a rule
// is an alert by the policy, so with sensitivity 100 a match must reach the default hit threshold 50, and the
// order of the policy priorities is kept. Same formula as the SeedSampleRules migration.
export function calculateBaseScore(priorityBase: number): number {
  const boundedPriority = Math.min(Math.max(priorityBase, 0), MAX_PRIORITY);

  return Math.round(DEFAULT_HIT_THRESHOLD + boundedPriority / 2);
}
