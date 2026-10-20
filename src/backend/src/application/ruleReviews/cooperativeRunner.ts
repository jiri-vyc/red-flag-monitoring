import type { CooperativeWork } from "../../domain/ruleReview/cooperativeWork";

const MAX_BLOCKING_MS = 50;

export async function runCooperatively<T>(
  work: CooperativeWork<T>,
  onBreak?: (yieldedChunks: number) => Promise<void>,
): Promise<T> {
  let blockingSince = Date.now();
  let yieldedChunks = 0;

  for (;;) {
    const step = work.next();

    if (step.done) {
      return step.value;
    }

    yieldedChunks += 1;

    if (Date.now() - blockingSince >= MAX_BLOCKING_MS) {
      await new Promise((resolve) => setImmediate(resolve));
      await onBreak?.(yieldedChunks);
      blockingSince = Date.now();
    }
  }
}
