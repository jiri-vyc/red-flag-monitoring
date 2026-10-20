export type CooperativeWork<T> = Generator<void, T, void>;

export const TRANSACTIONS_PER_YIELD = 5000;

export function runToCompletion<T>(work: CooperativeWork<T>): T {
  for (;;) {
    const step = work.next();

    if (step.done) {
      return step.value;
    }
  }
}
