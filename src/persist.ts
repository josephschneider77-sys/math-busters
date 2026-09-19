import { OPERATORS, type Equation, type Operator } from "./math";
import { specForLevel, type BoardSize } from "./progress";
import {
  boardSeeds,
  restoreBoardSeeds,
  type Board,
  type CellRef,
  type TrioHint,
} from "./puzzle";

export const RUN_KEY = "math-busters-run";
export const SAVE_VERSION = 1;

export const STATUS_KINDS = ["idle", "ready", "hit", "miss", "win", "stuck", "path"] as const;
export type SavedStatusKind = (typeof STATUS_KINDS)[number];

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type HistorySnap = {
  board: Board;
  busts: number;
  score: number;
};

export type RunSnapshot = {
  level: number;
  score: number;
  hints: number;
  busts: number;
  board: Board;
  selection: CellRef[];
  hintCells: CellRef[];
  history: HistorySnap[];
  pathBlocked: boolean;
  coachText: string;
  celebrating: boolean;
  statusKind: SavedStatusKind;
  statusText: string;
  statusHtml: string | null;
  tipStep: number;
};

type SavedCell = { row: number; col: number };
type SavedEquation = { a: number; op: Operator; b: number; c: number };
type SavedSeed = { cells: [SavedCell, SavedCell, SavedCell]; equation: SavedEquation };
type SavedHistory = {
  board: Board;
  busts: number;
  score: number;
  seeds?: SavedSeed[];
};
type SavedRun = {
  v: number;
  level: number;
  score: number;
  hints: number;
  busts: number;
  board: Board;
  seeds?: SavedSeed[];
  selection: SavedCell[];
  hintCells: SavedCell[];
  history: SavedHistory[];
  pathBlocked: boolean;
  coachText: string;
  celebrating: boolean;
  statusKind: SavedStatusKind;
  statusText: string;
  statusHtml: string | null;
  tipStep: number;
};

const BOARD_SIZES = new Set<BoardSize>([3, 6, 9]);

function tryLocalStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isCell(value: unknown, size: number): value is CellRef {
  if (!value || typeof value !== "object") return false;
  const cell = value as { row?: unknown; col?: unknown };
  return isInt(cell.row, 0, size - 1) && isInt(cell.col, 0, size - 1);
}

function isOperator(value: unknown): value is Operator {
  return typeof value === "string" && (OPERATORS as readonly string[]).includes(value);
}

function isEquation(value: unknown): value is Equation {
  if (!value || typeof value !== "object") return false;
  const eq = value as { a?: unknown; op?: unknown; b?: unknown; c?: unknown };
  return (
    typeof eq.a === "number" &&
    Number.isFinite(eq.a) &&
    typeof eq.b === "number" &&
    Number.isFinite(eq.b) &&
    typeof eq.c === "number" &&
    Number.isFinite(eq.c) &&
    isOperator(eq.op)
  );
}

function isBoard(value: unknown, size: number): value is Board {
  if (!Array.isArray(value) || value.length !== size) return false;
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === size &&
      row.every((cell) => cell === null || (typeof cell === "number" && Number.isFinite(cell))),
  );
}

function parseCells(value: unknown, size: number): CellRef[] | null {
  if (!Array.isArray(value) || value.length > 3) return null;
  const cells: CellRef[] = [];
  for (const item of value) {
    if (!isCell(item, size)) return null;
    cells.push({ row: item.row, col: item.col });
  }
  return cells;
}

function parseSeeds(value: unknown, size: number): TrioHint[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.length > (size * size) / 3) return undefined;
  const seeds: TrioHint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const raw = item as { cells?: unknown; equation?: unknown };
    if (!Array.isArray(raw.cells) || raw.cells.length !== 3) return undefined;
    if (!raw.cells.every((cell) => isCell(cell, size)) || !isEquation(raw.equation)) return undefined;
    const cells = raw.cells as [CellRef, CellRef, CellRef];
    seeds.push({
      cells: [{ row: cells[0].row, col: cells[0].col }, { row: cells[1].row, col: cells[1].col }, { row: cells[2].row, col: cells[2].col }],
      equation: { a: raw.equation.a, op: raw.equation.op, b: raw.equation.b, c: raw.equation.c },
    });
  }
  return seeds;
}

function serializeSeeds(seeds: TrioHint[] | undefined): SavedSeed[] | undefined {
  if (!seeds?.length) return undefined;
  return seeds.map((trio) => ({
    cells: [
      { row: trio.cells[0].row, col: trio.cells[0].col },
      { row: trio.cells[1].row, col: trio.cells[1].col },
      { row: trio.cells[2].row, col: trio.cells[2].col },
    ],
    equation: { ...trio.equation },
  }));
}

function hydrateBoard(grid: Board, seeds?: TrioHint[]): Board {
  const board = grid.map((row) => row.slice());
  if (seeds) restoreBoardSeeds(board, seeds);
  return board;
}

export function parseSavedRun(raw: unknown): RunSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<SavedRun>;
  if (data.v !== SAVE_VERSION) return null;
  if (!isInt(data.level, 1, 999)) return null;
  if (!isInt(data.score, 0, 1_000_000_000)) return null;
  if (!isInt(data.hints, 0, 999)) return null;
  if (!isInt(data.busts, 0, 999)) return null;
  if (typeof data.pathBlocked !== "boolean") return null;
  if (typeof data.coachText !== "string") return null;
  if (typeof data.celebrating !== "boolean") return null;
  if (typeof data.statusText !== "string") return null;
  if (data.statusHtml !== null && typeof data.statusHtml !== "string") return null;
  if (!isInt(data.tipStep, -1, 8)) return null;
  if (typeof data.statusKind !== "string" || !STATUS_KINDS.includes(data.statusKind)) return null;

  const spec = specForLevel(data.level);
  const size = spec.size;
  if (!BOARD_SIZES.has(size) || !isBoard(data.board, size)) return null;

  const selection = parseCells(data.selection, size);
  const hintCells = parseCells(data.hintCells, size);
  if (!selection || !hintCells) return null;
  if (!Array.isArray(data.history) || data.history.length > size * size) return null;

  const history: HistorySnap[] = [];
  for (const item of data.history) {
    if (!item || typeof item !== "object") return null;
    if (!isInt(item.busts, 0, 999) || !isInt(item.score, 0, 1_000_000_000)) return null;
    if (!isBoard(item.board, size)) return null;
    history.push({
      board: hydrateBoard(item.board, parseSeeds(item.seeds, size)),
      busts: item.busts,
      score: item.score,
    });
  }

  return {
    level: data.level,
    score: data.score,
    hints: data.hints,
    busts: data.busts,
    board: hydrateBoard(data.board, parseSeeds(data.seeds, size)),
    selection,
    hintCells,
    history,
    pathBlocked: data.pathBlocked,
    coachText: data.coachText,
    celebrating: data.celebrating,
    statusKind: data.statusKind,
    statusText: data.statusText,
    statusHtml: data.statusHtml,
    tipStep: data.tipStep,
  };
}

export function serializeRun(snap: RunSnapshot): SavedRun {
  return {
    v: SAVE_VERSION,
    level: snap.level,
    score: snap.score,
    hints: snap.hints,
    busts: snap.busts,
    board: snap.board.map((row) => row.slice()),
    seeds: serializeSeeds(boardSeeds(snap.board)),
    selection: snap.selection.map((cell) => ({ row: cell.row, col: cell.col })),
    hintCells: snap.hintCells.map((cell) => ({ row: cell.row, col: cell.col })),
    history: snap.history.map((item) => ({
      board: item.board.map((row) => row.slice()),
      busts: item.busts,
      score: item.score,
      seeds: serializeSeeds(boardSeeds(item.board)),
    })),
    pathBlocked: snap.pathBlocked,
    coachText: snap.coachText,
    celebrating: snap.celebrating,
    statusKind: snap.statusKind,
    statusText: snap.statusText,
    statusHtml: snap.statusHtml,
    tipStep: snap.tipStep,
  };
}

export function readSavedRun(storage: StorageLike | null = tryLocalStorage()): RunSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RUN_KEY);
    if (!raw) return null;
    return parseSavedRun(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeSavedRun(
  snap: RunSnapshot,
  storage: StorageLike | null = tryLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(RUN_KEY, JSON.stringify(serializeRun(snap)));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedRun(storage: StorageLike | null = tryLocalStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(RUN_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
  };
}
