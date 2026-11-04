// One portrait's life: it forms from a circle, holds, and dissolves back to a circle.
import { FORM_TIME, HOLD_TIME, UNFORM_TIME } from '../config.js';

// how long each part lasts
export const LOADER_TIMES = { form: FORM_TIME, hold: HOLD_TIME, unform: UNFORM_TIME };

export const cycleTime = (times) => times.form + times.hold + times.unform;

// t seconds into the cycle -> { phase, progress } where progress 0 is a circle and 1 a finished portrait
export function at(t, times = LOADER_TIMES) {
  if (t < times.form) return { phase: 'form', progress: t / times.form };
  if (t < times.form + times.hold) return { phase: 'hold', progress: 1 };
  return { phase: 'unform', progress: Math.max(0, 1 - (t - times.form - times.hold) / times.unform) };
}
