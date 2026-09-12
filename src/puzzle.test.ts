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
): boolean {
  return isFullySolvable(clearCells(board, cells));
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

checkExampleBoard();
checkGeneratedBoards();
console.log("puzzle hint checks ok");
