import { OPERATORS, anyValidEquation, type Equation, type Operator } from "./math";
import { specForLevel, type LevelSpec } from "./progress";

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

export function emptyBoard(size: number): Board {
  return Array.from({ length: size }, () => Array<CellValue>(size).fill(null));
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

export function findValidTrios(
  board: Board,
  ops: readonly Operator[] = OPERATORS,
): TrioHint[] {
  const cells = filledCells(board);
  const trios: TrioHint[] = [];

  for (const trio of combinations(cells, 3)) {
    const values: [number, number, number] = [
      trio[0].value,
      trio[1].value,
      trio[2].value,
    ];
    const equation = anyValidEquation(values, ops);
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
export function findSafeTrios(
  board: Board,
  ops: readonly Operator[] = OPERATORS,
): TrioHint[] {
  const safe: TrioHint[] = [];
  for (const trio of findValidTrios(board, ops)) {
    const leftover = clearCells(board, trio.cells);
    if (isFullySolvable(leftover, ops)) safe.push(trio);
  }
  safe.sort((a, b) => leftoverCount(board, a) - leftoverCount(board, b));
  return safe;
}

function leftoverCount(board: Board, trio: TrioHint): number {
  return filledCells(clearCells(board, trio.cells)).length;
}

type CoverHit = {
  cover: TrioHint[] | null;
  unknown: boolean;
};

const COVER_NODE_LIMIT = 80_000;

/** One exact cover of remaining cells by valid (allowed-op) trios. */
function solveCover(board: Board, ops: readonly Operator[]): CoverHit {
  const cells = filledCells(board);
  if (cells.length === 0) return { cover: [], unknown: false };
  if (cells.length % 3 !== 0) return { cover: null, unknown: false };

  const indexOf = new Map<string, number>();
  for (let i = 0; i < cells.length; i++) {
    indexOf.set(`${cells[i].row},${cells[i].col}`, i);
  }
  const n = cells.length;
  const trios = findValidTrios(board, ops);
  if (trios.length === 0) return { cover: null, unknown: false };

  const masks: bigint[] = [];
  const covers: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < trios.length; t++) {
    let mask = 0n;
    for (const cell of trios[t].cells) {
      const idx = indexOf.get(`${cell.row},${cell.col}`);
      if (idx === undefined) continue;
      mask |= 1n << BigInt(idx);
      covers[idx].push(t);
    }
    masks.push(mask);
  }

  const usedTrio = new Uint8Array(trios.length);
  const picked: number[] = [];
  let nodes = 0;
  let aborted = false;

  function search(uncovered: bigint): boolean {
    if (uncovered === 0n) return true;
    if (++nodes > COVER_NODE_LIMIT) {
      aborted = true;
      return false;
    }

    let best = -1;
    let bestCount = Infinity;
    for (let i = 0; i < n; i++) {
      if ((uncovered & (1n << BigInt(i))) === 0n) continue;
      let count = 0;
      for (const t of covers[i]) {
        if (!usedTrio[t] && (masks[t] & uncovered) === masks[t]) count += 1;
      }
      if (count === 0) return false;
      if (count < bestCount) {
        bestCount = count;
        best = i;
        if (count === 1) break;
      }
    }
    if (best < 0) return false;

    for (const t of covers[best]) {
      if (usedTrio[t]) continue;
      if ((masks[t] & uncovered) !== masks[t]) continue;
      usedTrio[t] = 1;
      picked.push(t);
      if (search(uncovered & ~masks[t])) return true;
      picked.pop();
      usedTrio[t] = 0;
      if (aborted) return false;
    }
    return false;
  }

  const full = (1n << BigInt(n)) - 1n;
  const ok = search(full);
  if (aborted) return { cover: null, unknown: true };
  if (!ok) return { cover: null, unknown: false };
  return { cover: picked.map((t) => trios[t]), unknown: false };
}

/** Prefer an immediate win, then any trio on a still-winnable path. */
export function pickSafeHint(
  board: Board,
  ops: readonly Operator[] = OPERATORS,
): TrioHint | null {
  const hit = solveCover(board, ops);
  if (!hit.cover || hit.cover.length === 0) return null;
  if (hit.cover.length === 1) return hit.cover[0];
  return hit.cover[Math.floor(Math.random() * hit.cover.length)] ?? null;
}

export function isFullySolvable(
  board: Board,
  ops: readonly Operator[] = OPERATORS,
): boolean {
  const hit = solveCover(board, ops);
  if (hit.unknown) return true;
  return hit.cover !== null;
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

function makeKidEquation(spec: LevelSpec): Equation {
  const op = spec.ops[randomInt(0, spec.ops.length - 1)] as Operator;

  if (op === "×") {
    const a = randomInt(spec.factorMin, spec.factorMax);
    const b = randomInt(spec.factorMin, spec.factorMax);
    return { a, op, b, c: a * b };
  }

  if (op === "÷") {
    const b = randomInt(spec.factorMin, spec.factorMax);
    const c = randomInt(spec.factorMin, spec.factorMax);
    return { a: b * c, op, b, c };
  }

  if (op === "+") {
    const a = randomInt(spec.addMin, spec.addMax);
    const b = randomInt(spec.addMin, spec.addMax);
    return { a, op, b, c: a + b };
  }

  const b = randomInt(spec.addMin, spec.addMax);
  const c = randomInt(spec.addMin, spec.addMax);
  return { a: b + c, op: "−", b, c };
}

function boardFromNumbers(numbers: number[], size: number): Board {
  const board = emptyBoard(size);
  for (let i = 0; i < numbers.length; i++) {
    board[Math.floor(i / size)][i % size] = numbers[i];
  }
  return board;
}

/**
 * Pack `size² / 3` kid equations using only `spec.ops`, then shuffle onto the grid.
 * The packed triples stay pickable (any three cells), so a winning path always exists.
 */
export function generatePuzzle(spec: LevelSpec = specForLevel(3)): Board {
  const size = spec.size;
  const count = (size * size) / 3;
  for (let attempt = 0; attempt < 40; attempt++) {
    const equations = Array.from({ length: count }, () => makeKidEquation(spec));
    const numbers = shuffle(equations.flatMap((eq) => [eq.a, eq.b, eq.c]));
    const board = boardFromNumbers(numbers, size);
    if (isFullySolvable(board, spec.ops)) return board;
  }
  const packed = Array.from({ length: count }, () => makeKidEquation(spec)).flatMap((eq) => [
    eq.a,
    eq.b,
    eq.c,
  ]);
  return boardFromNumbers(packed, size);
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

export function isBoardStuck(
  board: Board,
  ops: readonly Operator[] = OPERATORS,
): boolean {
  const remaining = filledCells(board).length;
  return remaining > 0 && findValidTrios(board, ops).length === 0;
}
