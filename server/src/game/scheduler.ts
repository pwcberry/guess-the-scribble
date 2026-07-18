export type Cancel = () => void;

/**
 * Time + timers abstracted so the game engine is deterministic under test. The
 * system implementation uses the real clock; tests inject a fake that advances
 * time manually, making round timers and time-decay scoring reproducible.
 */
export interface Scheduler {
  now: () => number;
  schedule: (ms: number, cb: () => void) => Cancel;
}

export const systemScheduler: Scheduler = {
  now: () => Date.now(),
  schedule(ms, cb) {
    const timer = setTimeout(cb, ms);
    return () => clearTimeout(timer);
  },
};
