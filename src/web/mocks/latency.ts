const DEFAULT_MIN_LATENCY_MS = 250;
const DEFAULT_MAX_LATENCY_MS = 800;

export function simulateLatency({
  minMs = DEFAULT_MIN_LATENCY_MS,
  maxMs = DEFAULT_MAX_LATENCY_MS,
}: { minMs?: number; maxMs?: number } = {}): Promise<void> {
  const delayMs = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export const AI_GENERATION_LATENCY = { minMs: 1500, maxMs: 3000 };
