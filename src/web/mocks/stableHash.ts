/** FNV-1a: a fast, deterministic 32-bit hash so mock outcomes are stable across reloads and resets. */
export function calculateStableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic pseudo-random number in [0, 1) derived from the input. */
export function calculateSeededFraction(input: string): number {
  return calculateStableHash(input) / 0x100000000;
}
