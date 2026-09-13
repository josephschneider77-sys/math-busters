import {
  FIRST_NINE_LEVEL,
  FIRST_SIX_LEVEL,
  FIRST_TWO_OP_LEVEL,
  TWO_OP_PAIRS,
  specForLevel,
} from "./progress";
import {
  EXAMPLE_BOARD,
  clearCells,
  findSafeTrios,
  findValidTrios,
  generatePuzzle,
  isFullySolvable,
  pickSafeHint,
} from "./puzzle";

function assert(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

function leftoverSolvable(
  board: ReturnType<typeof generatePuzzle>,
  cells: Parameters<typeof clearCells>[1],
  ops?: Parameters<typeof isFullySolvable>[1],
): boolean {
  return isFullySolvable(clearCells(board, cells), ops);
}

function checkLadder(): void {
  const lv1 = specForLevel(1);
  assert(lv1.size === 3 && lv1.ops.length === 4, "lv1 should be 3×3 with all four ops");

  const lv2 = specForLevel(2);
  const lv5 = specForLevel(5);
  assert(lv2.size === 3 && lv2.ops.length === 4, "lv2 should stay 3×3 all ops");
  assert(lv5.size === 3 && lv5.ops.length === 4, "lv5 should stay 3×3 all ops");
  assert(
    lv5.factorMax > lv2.factorMax || lv5.addMax > lv2.addMax,
    "early 3×3 levels should grow the number pool",
  );

  for (let level = FIRST_TWO_OP_LEVEL; level < FIRST_SIX_LEVEL; level++) {
    const spec = specForLevel(level);
    const pair = TWO_OP_PAIRS[level - FIRST_TWO_OP_LEVEL];
    assert(spec.size === 3, `lv${level} should stay 3×3`);
    assert(spec.ops.length === 2, `lv${level} should use exactly two ops`);
    assert(spec.ops[0] === pair[0] && spec.ops[1] === pair[1], `lv${level} pair mismatch`);
  }

  const lv11 = specForLevel(FIRST_SIX_LEVEL);
  assert(lv11.size === 6 && lv11.ops.length === 4, "lv11 should be 6×6 with all four ops");
  assert(specForLevel(14).size === 6, "lv14 should still be 6×6");

  const lv15 = specForLevel(FIRST_NINE_LEVEL);
  assert(lv15.size === 9 && lv15.ops.length === 4, "lv15 should be 9×9 with all four ops");
  assert(specForLevel(20).size === 9, "later levels should stay 9×9");
}

function checkExampleBoard(): void {
  assert(isFullySolvable(EXAMPLE_BOARD), "EXAMPLE_BOARD should be fully solvable");

  const valid = findValidTrios(EXAMPLE_BOARD);
  const safe = findSafeTrios(EXAMPLE_BOARD);
  assert(valid.length > 0, "EXAMPLE_BOARD should have valid trios");
  assert(safe.length > 0, "EXAMPLE_BOARD should have at least one safe hint");
  assert(safe.length <= valid.length, "safe trios should be a subset of valid trios");

  for (const trio of safe) {
    assert(
      leftoverSolvable(EXAMPLE_BOARD, trio.cells),
      `safe trio ${trio.equation.a} ${trio.equation.op} ${trio.equation.b} = ${trio.equation.c} stranded the board`,
    );
  }

  const stranding = valid.filter((trio) => !leftoverSolvable(EXAMPLE_BOARD, trio.cells));
  for (const trio of stranding) {
    const hinted = safe.some(
      (safeTrio) =>
        safeTrio.cells.every((cell, i) => cell.row === trio.cells[i].row && cell.col === trio.cells[i].col),
    );
    assert(!hinted, `stranding trio leaked into safe hints: ${trio.equation.a} ${trio.equation.op} ${trio.equation.b}`);
  }

  for (let i = 0; i < 12; i++) {
    const hint = pickSafeHint(EXAMPLE_BOARD);
    if (!hint) throw new Error("pickSafeHint should find a trio on EXAMPLE_BOARD");
    assert(leftoverSolvable(EXAMPLE_BOARD, hint.cells), "pickSafeHint returned a stranding trio on EXAMPLE_BOARD");
  }
}

function checkGeneratedBoards(): void {
  for (let n = 0; n < 8; n++) {
    const board = generatePuzzle();
    assert(board.length === 3 && board[0].length === 3, "default generatePuzzle should be 3×3");
    assert(isFullySolvable(board), "generatePuzzle returned an unsolvable board");
    const safe = findSafeTrios(board);
    assert(safe.length > 0, "solvable generated board had no safe hint");
    for (const trio of safe) {
      assert(leftoverSolvable(board, trio.cells), "generated-board safe trio stranded leftovers");
    }
    const hint = pickSafeHint(board);
    if (!hint) throw new Error("pickSafeHint missed a generated solvable board");
    assert(leftoverSolvable(board, hint.cells), "pickSafeHint stranded a generated board");
  }
}

function checkTwoOpLevels(): void {
  for (const pair of TWO_OP_PAIRS) {
    const spec = specForLevel(FIRST_TWO_OP_LEVEL + TWO_OP_PAIRS.indexOf(pair));
    assert(spec.ops[0] === pair[0] && spec.ops[1] === pair[1], "two-op spec should match pair");
    for (let n = 0; n < 3; n++) {
      const board = generatePuzzle(spec);
      assert(board.length === 3, "two-op boards should stay 3×3");
      assert(isFullySolvable(board, spec.ops), `two-op ${pair.join("")} board was not solvable`);
      const valid = findValidTrios(board, spec.ops);
      assert(valid.length > 0, `two-op ${pair.join("")} board had no valid trios`);
      for (const trio of valid) {
        assert(spec.ops.includes(trio.equation.op), `two-op hint used illegal op ${trio.equation.op}`);
      }
      const hint = pickSafeHint(board, spec.ops);
      if (!hint) throw new Error(`pickSafeHint missed a two-op ${pair.join("")} board`);
      assert(spec.ops.includes(hint.equation.op), "safe hint used an illegal op");
      assert(leftoverSolvable(board, hint.cells, spec.ops), "two-op hint stranded leftovers");
    }
  }
}

function checkSixBySix(): void {
  const spec = specForLevel(FIRST_SIX_LEVEL);
  for (let n = 0; n < 3; n++) {
    const board = generatePuzzle(spec);
    assert(board.length === 6 && board[0].length === 6, "lv11–14 boards should be 6×6");
    assert(
      board.every((row) => row.every((value) => value !== null)),
      "6×6 board should start full",
    );
    assert(isFullySolvable(board, spec.ops), "6×6 generatePuzzle returned an unsolvable board");
    const hint = pickSafeHint(board, spec.ops);
    if (!hint) throw new Error("pickSafeHint missed a 6×6 board");
    assert(spec.ops.includes(hint.equation.op), "6×6 hint used an illegal op");
    assert(leftoverSolvable(board, hint.cells, spec.ops), "6×6 hint stranded leftovers");
  }
}

function checkNineByNine(): void {
  const spec = specForLevel(FIRST_NINE_LEVEL);
  for (let n = 0; n < 2; n++) {
    const board = generatePuzzle(spec);
    assert(board.length === 9 && board[0].length === 9, "lv15+ boards should be 9×9");
    assert(
      board.every((row) => row.every((value) => value !== null)),
      "9×9 board should start full",
    );
    assert(isFullySolvable(board, spec.ops), "9×9 generatePuzzle returned an unsolvable board");
    const hint = pickSafeHint(board, spec.ops);
    if (!hint) throw new Error("pickSafeHint missed a 9×9 board");
    assert(spec.ops.includes(hint.equation.op), "9×9 hint used an illegal op");
    assert(leftoverSolvable(board, hint.cells, spec.ops), "9×9 hint stranded leftovers");
  }
}

checkLadder();
checkExampleBoard();
checkGeneratedBoards();
checkTwoOpLevels();
checkSixBySix();
checkNineByNine();
console.log("puzzle hint + progression checks ok");
