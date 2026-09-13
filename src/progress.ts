import { OPERATORS, type Operator } from "./math";

export type BoardSize = 3 | 6 | 9;

export type LevelSpec = {
  level: number;
  size: BoardSize;
  ops: readonly Operator[];
  factorMin: number;
  factorMax: number;
  addMin: number;
  addMax: number;
};

/**
 * Run ladder (1-indexed). `level` persists across auto-restocks in a Play run.
 *
 *   Lv 1      — 3×3, all four ops, starter example board (small numbers)
 *   Lv 2–5    — 3×3, all four ops, number pool / max values step up (~3rd grade)
 *   Lv 6–10   — 3×3, exactly two ops, cycling −÷, +×, −×, +÷, ×÷
 *   Lv 11–14  — 6×6, all four ops; clear all 36 cells (12 three-number busts)
 *   Lv 15+    — 9×9, all four ops; clear all 81 cells (27 three-number busts)
 *
 * Generation, hints, and stranded-bust checks use only the current ops + size.
 */
export const TWO_OP_PAIRS: readonly (readonly Operator[])[] = [
  ["−", "÷"],
  ["+", "×"],
  ["−", "×"],
  ["+", "÷"],
  ["×", "÷"],
];

export const FIRST_TWO_OP_LEVEL = 6;
export const FIRST_SIX_LEVEL = 11;
export const FIRST_NINE_LEVEL = 15;

const BIGGER_3X3 = [
  { factorMin: 2, factorMax: 6, addMin: 1, addMax: 8 },
  { factorMin: 2, factorMax: 8, addMin: 1, addMax: 12 },
  { factorMin: 2, factorMax: 10, addMin: 2, addMax: 16 },
  { factorMin: 3, factorMax: 12, addMin: 4, addMax: 20 },
] as const;

export function specForLevel(level: number): LevelSpec {
  const n = Math.max(1, Math.floor(level));

  if (n <= 1) {
    return {
      level: n,
      size: 3,
      ops: OPERATORS,
      factorMin: 2,
      factorMax: 6,
      addMin: 1,
      addMax: 8,
    };
  }

  if (n < FIRST_TWO_OP_LEVEL) {
    const range = BIGGER_3X3[n - 2] ?? BIGGER_3X3[BIGGER_3X3.length - 1];
    return { level: n, size: 3, ops: OPERATORS, ...range };
  }

  if (n < FIRST_SIX_LEVEL) {
    const pair = TWO_OP_PAIRS[(n - FIRST_TWO_OP_LEVEL) % TWO_OP_PAIRS.length];
    return {
      level: n,
      size: 3,
      ops: pair,
      factorMin: 2,
      factorMax: 10,
      addMin: 2,
      addMax: 16,
    };
  }

  if (n < FIRST_NINE_LEVEL) {
    return {
      level: n,
      size: 6,
      ops: OPERATORS,
      factorMin: 2,
      factorMax: 10,
      addMin: 2,
      addMax: 16,
    };
  }

  return {
    level: n,
    size: 9,
    ops: OPERATORS,
    factorMin: 2,
    factorMax: 10,
    addMin: 2,
    addMax: 16,
  };
}

export function formatOps(ops: readonly Operator[]): string {
  return ops.join("  ");
}
