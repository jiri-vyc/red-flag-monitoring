/**
 * Largest accepted transaction limit. Above Number.MAX_SAFE_INTEGER a number loses precision, so the limit
 * sent would differ from the one typed; any real dataset is far smaller.
 */
export const MAX_RUN_LIMIT = Number.MAX_SAFE_INTEGER;

/** An empty field is left out of the scope; null means the limit is not a whole number from 1 to MAX_RUN_LIMIT. */
export function parseRunLimit(limit: string): number | undefined | null {
  if (limit.trim() === "") {
    return undefined;
  }
  const parsedLimit = Number(limit);
  return Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= MAX_RUN_LIMIT
    ? parsedLimit
    : null;
}
