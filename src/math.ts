export type Operator = "×" | "÷" | "+" | "−";

export const OPERATORS: readonly Operator[] = ["×", "÷", "+", "−"];

export type Equation = {
  a: number;
  op: Operator;
  b: number;
  c: number;
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

/** Prefer the tap order a op b = c when it works. */
export function findEquation(
  values: readonly [number, number, number],
  op: Operator,
): Equation | null {
  const [first, second, third] = values;
  if (applyOp(first, op, second) === third) {
    return { a: first, op, b: second, c: third };
  }

  for (const [a, b, c] of permutations(values)) {
    if (applyOp(a, op, b) === c) {
      return { a, op, b, c };
    }
  }
  return null;
}

export function formatEquation(equation: Equation): string {
  return `${equation.a} ${equation.op} ${equation.b} = ${equation.c}`;
}

export function anyValidEquation(
  values: readonly [number, number, number],
): Equation | null {
  for (const op of OPERATORS) {
    const found = findEquation(values, op);
    if (found) return found;
  }
  return null;
}
