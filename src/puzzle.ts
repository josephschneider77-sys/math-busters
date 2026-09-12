import { OPERATORS, anyValidEquation, type Equation, type Operator } from "./math";

export type CellValue = number | null;
export type Board = CellValue[][];

export const EXAMPLE_BOARD: Board = [
  [20, 5, 25],
  [4, 16, 6],
  [4, 8, 2],
];

export type CellRef = { row: number; col: number };

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function filledCells(board: Board): Array<CellRef & { value: number }> {
  const cells: Array<CellRef & { value: number }> = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const value = board[row][col];
      if (value !== null) cells.push({ row, col, value });
    }
  }
  return cells;
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...tail] = items;
  return [
    ...combinations(tail, k - 1).map((rest) => [head, ...rest]),
    ...combinations(tail, k),
  ];
}

export type TrioHint = {
  cells: [CellRef, CellRef, CellRef];
  equation: Equation;
};

export function findValidTrios(board: Board): TrioHint[] {
  const cells = filledCells(board);
  const trios: TrioHint[] = [];

  for (const trio of combinations(cells, 3)) {
    const values: [number, number, number] = [
      trio[0].value,
      trio[1].value,
      trio[2].value,
    ];
    const equation = anyValidEquation(values);
    if (equation) {
      trios.push({
        cells: [trio[0], trio[1], trio[2]],
        equation,
      });
    }
  }
  return trios;
}

/** Valid equations whose leftover board is still fully clearable (or empty). */
export function findSafeTrios(board: Board): TrioHint[] {
  const safe: TrioHint[] = [];
  for (const trio of findValidTrios(board)) {
    const leftover = clearCells(board, trio.cells);
    if (isFullySolvable(leftover)) safe.push(trio);
  }
  safe.sort((a, b) => leftoverCount(board, a) - leftoverCount(board, b));
  return safe;
}

function leftoverCount(board: Board, trio: TrioHint): number {
  return filledCells(clearCells(board, trio.cells)).length;
}

/** Prefer an immediate win, then any shortest remaining winning path. */
export function pickSafeHint(board: Board): TrioHint | null {
  const safe = findSafeTrios(board);
  if (safe.length === 0) return null;
  const shortest = leftoverCount(board, safe[0]);
  const best = safe.filter((trio) => leftoverCount(board, trio) === shortest);
  return best[Math.floor(Math.random() * best.length)] ?? null;
}

export function isFullySolvable(board: Board): boolean {
  const remaining = filledCells(board);
  if (remaining.length === 0) return true;
  if (remaining.length % 3 !== 0) return false;

  const seen = new Set<string>();

  function key(next: Board): string {
    return next.flat().map((value) => (value === null ? "x" : value)).join(",");
  }

  function search(next: Board): boolean {
    const cells = filledCells(next);
    if (cells.length === 0) return true;
    const boardKey = key(next);
    if (seen.has(boardKey)) return false;
    seen.add(boardKey);

    for (const trio of findValidTrios(next)) {
      const attempt = cloneBoard(next);
      for (const cell of trio.cells) {
        attempt[cell.row][cell.col] = null;
      }
      if (search(attempt)) return true;
    }
    return false;
  }

  return search(board);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function makeKidEquation(): Equation {
  const op = OPERATORS[randomInt(0, OPERATORS.length - 1)] as Operator;

  if (op === "×") {
    const a = randomInt(2, 9);
    const b = randomInt(2, 9);
    return { a, op, b, c: a * b };
  }

  if (op === "÷") {
    const b = randomInt(2, 9);
    const c = randomInt(2, 9);
    return { a: b * c, op, b, c };
  }

  if (op === "+") {
    const a = randomInt(1, 12);
    const b = randomInt(1, 12);
    return { a, op, b, c: a + b };
  }

  const b = randomInt(1, 12);
  const c = randomInt(1, 12);
  return { a: b + c, op: "−", b, c };
}

function boardFromNumbers(numbers: number[]): Board {
  return [
    [numbers[0], numbers[1], numbers[2]],
    [numbers[3], numbers[4], numbers[5]],
    [numbers[6], numbers[7], numbers[8]],
  ];
}

export function generatePuzzle(): Board {
  for (let attempt = 0; attempt < 120; attempt++) {
    const equations = [makeKidEquation(), makeKidEquation(), makeKidEquation()];
    const numbers = equations.flatMap((eq) => [eq.a, eq.b, eq.c]);
    const board = boardFromNumbers(shuffle(numbers));
    if (findValidTrios(board).length > 0 && isFullySolvable(board)) {
      return board;
    }
  }
  return cloneBoard(EXAMPLE_BOARD);
}

export function clearCells(board: Board, cells: readonly CellRef[]): Board {
  const next = cloneBoard(board);
  for (const cell of cells) {
    next[cell.row][cell.col] = null;
  }
  return next;
}

export function isBoardEmpty(board: Board): boolean {
  return filledCells(board).length === 0;
}

export function isBoardStuck(board: Board): boolean {
  const remaining = filledCells(board).length;
  return remaining > 0 && findValidTrios(board).length === 0;
}
