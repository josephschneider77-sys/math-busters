export type Operator = "×" | "÷" | "+" | "−";

export const OPERATORS: readonly Operator[] = ["×", "÷", "+", "−"];

export type Equation = {
  a: number;
  op: Operator;
  b: number;
  c: number;
};

export type OrderedMiss = {
  a: number;
  op: Operator;
  b: number;
  actual: number | null;
  expected: number;
};

export function applyOp(a: number, op: Operator, b: number): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      if (b === 0 || a % b !== 0) return null;
      return a / b;
  }
}

export function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = items.filter((_, index) => index !== i);
    for (const perm of permutations(rest)) {
      result.push([items[i], ...perm]);
    }
  }
  return result;
}

/** Tap order only: first □ second = third. No rearranging. */
export function findEquation(
  values: readonly [number, number, number],
  op: Operator,
): Equation | null {
  const [a, b, c] = values;
  if (applyOp(a, op, b) === c) return { a, op, b, c };
  return null;
}

export function evaluateOrdered(
  values: readonly [number, number, number],
  op: Operator,
): { hit: Equation } | { miss: OrderedMiss } {
  const [a, b, expected] = values;
  const actual = applyOp(a, op, b);
  if (actual === expected) return { hit: { a, op, b, c: expected } };
  return { miss: { a, op, b, actual, expected } };
}

export function formatEquation(equation: Equation): string {
  return `${equation.a} ${equation.op} ${equation.b} = ${equation.c}`;
}

/** Live draft: `4  □  4  =  16` with blanks until each part is picked. */
export function formatDraftEquation(
  values: readonly (number | null | undefined)[],
  op: Operator | null = null,
): string {
  const a = values[0] != null ? String(values[0]) : "_";
  const b = values[1] != null ? String(values[1]) : "_";
  const c = values[2] != null ? String(values[2]) : "_";
  return `${a}  ${op ?? "□"}  ${b}  =  ${c}`;
}

export function formatOrderedMiss(miss: OrderedMiss): string {
  if (miss.actual === null) {
    if (miss.op === "÷") {
      return `${miss.a} ÷ ${miss.b} isn’t a whole number  ·  not ${miss.expected}`;
    }
    return `${miss.a} ${miss.op} ${miss.b} doesn’t work  ·  not ${miss.expected}`;
  }
  return `${miss.a} ${miss.op} ${miss.b} = ${miss.actual}  ·  not ${miss.expected}`;
}

/**
 * Whether three numbers can make a true equation in *some* tap order.
 * Used for generation, hints, and stranded checks — not for scoring a pick.
 */
export function anyValidEquation(
  values: readonly [number, number, number],
  ops: readonly Operator[] = OPERATORS,
): Equation | null {
  for (const perm of permutations(values)) {
    const ordered = perm as [number, number, number];
    for (const op of ops) {
      const found = findEquation(ordered, op);
      if (found) return found;
    }
  }
  return null;
}
