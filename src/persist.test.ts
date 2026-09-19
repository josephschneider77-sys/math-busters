import { OPERATORS } from "./math";
import {
  RUN_KEY,
  SAVE_VERSION,
  clearSavedRun,
  memoryStorage,
  parseSavedRun,
  readSavedRun,
  serializeRun,
  writeSavedRun,
  type RunSnapshot,
} from "./persist";
import { specForLevel } from "./progress";
import { EXAMPLE_BOARD, boardSeeds, cloneBoard, generatePuzzle, restoreBoardSeeds } from "./puzzle";

function assert(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

function baseSnap(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    level: 1,
    score: 200,
    hints: 4,
    busts: 2,
    board: cloneBoard(EXAMPLE_BOARD),
    selection: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    hintCells: [{ row: 2, col: 2 }],
    history: [{ board: cloneBoard(EXAMPLE_BOARD), busts: 0, score: 0 }],
    pathBlocked: false,
    coachText: "",
    celebrating: false,
    statusKind: "idle",
    statusText: "Tap three number blocks.",
    statusHtml: "<span>eq</span>",
    tipStep: -1,
    ...overrides,
  };
}

function checkRoundtrip(): void {
  const snap = baseSnap();
  const restored = parseSavedRun(serializeRun(snap));
  assert(restored !== null, "valid snapshot should parse");
  assert(restored.level === 1 && restored.score === 200 && restored.hints === 4, "scalars should match");
  assert(restored.busts === 2, "busts should match");
  assert(restored.board[0][0] === 20 && restored.board[2][2] === 2, "board numbers should match");
  assert(restored.selection.length === 2 && restored.selection[0].row === 0, "selection should match");
  assert(restored.hintCells[0].col === 2, "hint cells should match");
  assert(restored.history.length === 1 && restored.history[0].score === 0, "undo history should match");
  assert(restored.statusHtml === "<span>eq</span>", "equation HUD html should match");
}

function checkSeedsSurvive(): void {
  const packed = generatePuzzle(specForLevel(15));
  const seeds = boardSeeds(packed);
  assert(!!seeds && seeds.length === 27, "9×9 deal should keep packed seeds");
  const snap = baseSnap({
    level: 15,
    board: packed,
    selection: [],
    hintCells: [],
    history: [{ board: cloneBoard(packed), busts: 0, score: 0 }],
  });
  const restored = parseSavedRun(serializeRun(snap));
  assert(restored !== null, "seeded snapshot should parse");
  const again = boardSeeds(restored.board);
  assert(!!again && again.length === seeds.length, "restored board should keep seed count");
  assert(again[0].equation.op === seeds[0].equation.op, "seed equations should survive");
  assert(again[0].cells[0].row === seeds[0].cells[0].row, "seed cells should survive");
  const histSeeds = boardSeeds(restored.history[0].board);
  assert(!!histSeeds && histSeeds.length === seeds.length, "undo boards should keep seeds");
}

function checkRejectsGarbage(): void {
  assert(parseSavedRun(null) === null, "null is not a save");
  assert(parseSavedRun({ v: 99, level: 1 }) === null, "unknown version is rejected");
  assert(parseSavedRun({ ...serializeRun(baseSnap()), v: 2 }) === null, "future version is rejected");
  assert(parseSavedRun({ ...serializeRun(baseSnap()), board: [[1]] }) === null, "wrong board size is rejected");
  assert(parseSavedRun({ ...serializeRun(baseSnap()), level: 0 }) === null, "level 0 is rejected");
  assert(parseSavedRun({ ...serializeRun(baseSnap()), hints: -1 }) === null, "negative hints are rejected");
  assert(
    parseSavedRun({ ...serializeRun(baseSnap()), selection: [{ row: 9, col: 0 }] }) === null,
    "out-of-range selection is rejected",
  );
}

function checkStorageLifecycle(): void {
  const store = memoryStorage();
  assert(readSavedRun(store) === null, "empty storage has no mid-run save");

  const snap = baseSnap({ score: 350, hints: 3, level: 2, board: generatePuzzle(specForLevel(2)) });
  assert(writeSavedRun(snap, store), "write should succeed");
  assert(store.getItem(RUN_KEY)?.includes(`"v":${SAVE_VERSION}`) === true, "save uses the run key");

  const loaded = readSavedRun(store);
  assert(loaded !== null && loaded.score === 350 && loaded.hints === 3 && loaded.level === 2, "read should restore run");
  assert(loaded.board.length === 3, "restored lv2 board stays 3×3");

  store.setItem("math-busters-high-score", "900");
  clearSavedRun(store);
  assert(readSavedRun(store) === null, "clear removes the mid-run save");
  assert(store.getItem("math-busters-high-score") === "900", "clear must not touch high score");
}

function checkClearedCells(): void {
  const board = cloneBoard(EXAMPLE_BOARD);
  board[0][0] = null;
  board[1][1] = null;
  const restored = parseSavedRun(serializeRun(baseSnap({ board, selection: [], hintCells: [] })));
  assert(restored !== null, "partially cleared board should parse");
  assert(restored.board[0][0] === null && restored.board[1][1] === null, "cleared cells stay cleared");
  assert(restored.board[0][1] === 5, "remaining numbers stay");
}

function checkRestoreBoardSeedsHelper(): void {
  const board = cloneBoard(EXAMPLE_BOARD);
  assert(boardSeeds(board) === undefined, "example board has no packed seeds");
  restoreBoardSeeds(board, [
    {
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      equation: { a: 20, op: "+", b: 5, c: 25 },
    },
  ]);
  const seeds = boardSeeds(board);
  assert(!!seeds && seeds[0].equation.op === OPERATORS[2], "restoreBoardSeeds should attach +");
  const copy = cloneBoard(board);
  assert(boardSeeds(copy)?.[0].equation.c === 25, "cloneBoard should copy restored seeds");
}

function checkBadJson(): void {
  const store = memoryStorage({ [RUN_KEY]: "{not-json" });
  assert(readSavedRun(store) === null, "corrupt JSON should be ignored");
}

checkRoundtrip();
checkSeedsSurvive();
checkRejectsGarbage();
checkStorageLifecycle();
checkClearedCells();
checkRestoreBoardSeedsHelper();
checkBadJson();

console.log("persist.test.ts: ok");
