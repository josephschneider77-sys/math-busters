import { findEquation, formatEquation, type Operator } from "./math";
import {
  EXAMPLE_BOARD,
  clearCells,
  cloneBoard,
  findValidTrios,
  generatePuzzle,
  isBoardEmpty,
  isBoardStuck,
  type Board,
  type CellRef,
} from "./puzzle";
import "./style.css";

type StatusKind = "idle" | "ready" | "hit" | "miss" | "win" | "stuck";

function requireApp(): HTMLDivElement {
  const el = document.querySelector<HTMLDivElement>("#app");
  if (!el) throw new Error("Missing #app");
  return el;
}

const app = requireApp();

let board: Board = cloneBoard(EXAMPLE_BOARD);
let selection: CellRef[] = [];
let busts = 0;
let celebrating = false;
let hintCells: CellRef[] = [];
let statusKind: StatusKind = "idle";
let statusText = "Joe’s starter board. Tap three blocks!";
let dragging = false;
let dragAdded = false;
let pendingClear: CellRef[] | null = null;
let history: Array<{ board: Board; busts: number }> = [];

function sameCell(a: CellRef, b: CellRef): boolean {
  return a.row === b.row && a.col === b.col;
}

function isSelected(cell: CellRef): boolean {
  return selection.some((picked) => sameCell(picked, cell));
}

function filledCount(): number {
  return board.flat().filter((value) => value !== null).length;
}

function selectionValues(): [number, number, number] | null {
  if (selection.length !== 3) return null;
  const values = selection.map((cell) => board[cell.row][cell.col]);
  if (values.some((value) => value === null)) return null;
  return values as [number, number, number];
}

function setStatus(kind: StatusKind, text: string): void {
  statusKind = kind;
  statusText = text;
}

function defaultIdleMessage(): string {
  if (isBoardEmpty(board)) return "You busted every block!";
  if (isBoardStuck(board)) {
    return history.length
      ? "Those leftover numbers don’t make an equation. Undo and try a different trio!"
      : "Those leftover numbers don’t make an equation. Try a new puzzle!";
  }
  return "Tap three number blocks.";
}

function resetPicks(message?: string): void {
  selection = [];
  hintCells = [];
  pendingClear = null;
  if (isBoardEmpty(board)) {
    celebrating = true;
    setStatus("win", "You busted every block!");
  } else if (isBoardStuck(board)) {
    setStatus("stuck", defaultIdleMessage());
  } else {
    celebrating = false;
    setStatus("idle", message ?? defaultIdleMessage());
  }
}

function addToSelection(cell: CellRef): boolean {
  if (celebrating || pendingClear) return false;
  if (board[cell.row][cell.col] === null) return false;
  if (isSelected(cell) || selection.length >= 3) return false;

  hintCells = [];
  selection = [...selection, cell];
  if (selection.length < 3) {
    setStatus("idle", selection.length === 1 ? "Nice! Tap two more." : "One more block…");
  } else {
    setStatus("ready", "Pick a math tool: ×  ÷  +  −");
    queueMicrotask(() => {
      document.querySelector(".tools")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
  return true;
}

function removeFromSelection(cell: CellRef): void {
  if (pendingClear) return;
  selection = selection.filter((picked) => !sameCell(picked, cell));
  if (selection.length === 0) {
    setStatus("idle", "Tap three number blocks.");
  } else {
    setStatus("idle", selection.length === 1 ? "Nice! Tap two more." : "One more block…");
  }
}

function newPuzzle(useExample = false): void {
  board = useExample ? cloneBoard(EXAMPLE_BOARD) : generatePuzzle();
  busts = 0;
  celebrating = false;
  dragging = false;
  dragAdded = false;
  history = [];
  resetPicks(useExample ? "Joe’s starter board. Tap three blocks!" : "New puzzle! Tap three blocks.");
  render();
}

function undoBust(): void {
  const previous = history.pop();
  if (!previous || pendingClear) return;
  board = cloneBoard(previous.board);
  busts = previous.busts;
  celebrating = false;
  resetPicks("Bust undone. Try a different three blocks.");
  render();
}

function tryOperator(op: Operator): void {
  const values = selectionValues();
  if (!values) return;

  const equation = findEquation(values, op);
  if (!equation) {
    setStatus("miss", "Not quite! Try another tool, or pick different blocks.");
    updateChrome();
    const boardEl = document.querySelector(".board");
    boardEl?.classList.remove("shake");
    void boardEl?.getBoundingClientRect();
    boardEl?.classList.add("shake");
    return;
  }

  pendingClear = selection.slice();
  const bustText = formatEquation(equation);
  setStatus("hit", `${bustText}  ·  Bust!`);
  updateChrome();

  window.setTimeout(() => {
    if (!pendingClear) return;
    history.push({ board: cloneBoard(board), busts });
    board = clearCells(board, pendingClear);
    busts += 1;
    resetPicks(
      isBoardEmpty(board) ? `${bustText}  ·  You busted every block!` : `${bustText}  ·  Great bust! Keep going.`,
    );
    if (isBoardStuck(board) && !isBoardEmpty(board)) {
      setStatus("stuck", `${bustText}. ${defaultIdleMessage()}`);
    }
    render();
  }, 520);
}

function showHint(): void {
  if (celebrating || pendingClear) return;
  const trios = findValidTrios(board);
  if (trios.length === 0) {
    setStatus("stuck", defaultIdleMessage());
    updateChrome();
    return;
  }
  const trio = trios[Math.floor(Math.random() * trios.length)];
  hintCells = trio.cells;
  selection = [];
  setStatus("idle", `Hint: ${formatEquation(trio.equation)} — can you find those blocks?`);
  updateBoard();
  updateChrome();
  drawLine();
}

function cellFromPoint(x: number, y: number): CellRef | null {
  const el = document.elementFromPoint(x, y);
  const button = el?.closest<HTMLButtonElement>("[data-row][data-col]");
  if (!button || button.disabled) return null;
  return {
    row: Number(button.dataset.row),
    col: Number(button.dataset.col),
  };
}

function drawLine(): void {
  const svg = document.querySelector<SVGSVGElement>("#selection-line");
  const boardEl = document.querySelector<HTMLElement>("#board");
  if (!svg || !boardEl) return;

  const rect = boardEl.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.style.width = `${rect.width}px`;
  svg.style.height = `${rect.height}px`;

  const points = selection
    .map((cell) => {
      const button = boardEl.querySelector<HTMLElement>(
        `[data-row="${cell.row}"][data-col="${cell.col}"]`,
      );
      if (!button) return "";
      const box = button.getBoundingClientRect();
      return `${box.left - rect.left + box.width / 2},${box.top - rect.top + box.height / 2}`;
    })
    .filter(Boolean);

  svg.querySelector("polyline")?.setAttribute("points", points.join(" "));
}

function updateBoard(): void {
  const boardEl = document.querySelector<HTMLElement>("#board");
  if (!boardEl) return;

  boardEl.querySelectorAll<HTMLButtonElement>(".block").forEach((button) => {
    const cell = {
      row: Number(button.dataset.row),
      col: Number(button.dataset.col),
    };
    const value = board[cell.row][cell.col];
    const selected = isSelected(cell);
    const order = selection.findIndex((picked) => sameCell(picked, cell));
    const hinted = hintCells.some((picked) => sameCell(picked, cell));
    const empty = value === null;

    button.classList.toggle("empty", empty);
    button.classList.toggle("selected", selected);
    button.classList.toggle("hinted", hinted && !selected);
    button.disabled = empty || celebrating;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", empty ? "Cleared block" : `Number ${value}`);
    button.innerHTML = empty
      ? ""
      : `<span class="num">${value}</span>${selected ? `<span class="order">${order + 1}</span>` : ""}`;
  });
}

function updateChrome(): void {
  const status = document.querySelector<HTMLElement>("#status");
  if (status) {
    status.className = `status status-${statusKind}`;
    status.textContent = statusText;
  }

  const bustsEl = document.querySelector("#busts");
  const leftEl = document.querySelector("#left");
  if (bustsEl) bustsEl.textContent = String(busts);
  if (leftEl) leftEl.textContent = String(filledCount());

  const picks = selection
    .map((cell) => board[cell.row][cell.col])
    .filter((value): value is number => value !== null);
  const tools = document.querySelector(".tools");
  const toolsLabel = document.querySelector("#tools-label");
  const open = selection.length === 3 && !celebrating;
  tools?.classList.toggle("open", open);
  if (toolsLabel) {
    toolsLabel.innerHTML =
      picks.length === 3
        ? `Math tools for <strong>${picks.join(" · ")}</strong>`
        : "Pick three blocks first";
  }

  document.querySelectorAll<HTMLButtonElement>("[data-op]").forEach((button) => {
    button.disabled = !open;
  });

  const clearBtn = document.querySelector<HTMLButtonElement>("[data-action='clear']");
  if (clearBtn) clearBtn.disabled = selection.length === 0 || Boolean(pendingClear);
  const undoBtn = document.querySelector<HTMLButtonElement>("[data-action='undo']");
  if (undoBtn) undoBtn.disabled = history.length === 0 || Boolean(pendingClear);

  const win = document.querySelector<HTMLElement>("#win-banner");
  if (win) win.hidden = !celebrating;
  document.querySelector(".stage")?.classList.toggle("won", celebrating);
}

function render(): void {
  app.innerHTML = `
    <div class="shell">
      <header class="hero">
        <p class="eyebrow">Number-block puzzle</p>
        <h1>Math Busters</h1>
        <p class="lede">Line up three numbers. Pick a math tool. Bust the blocks!</p>
      </header>

      <section class="howto" aria-label="How to play">
        Tap <strong>3 blocks</strong>, then pick <strong>×</strong> <strong>÷</strong> <strong>+</strong> or <strong>−</strong>.
        A true equation busts them!
      </section>

      <div class="meter">
        <span>Busts <strong id="busts">${busts}</strong></span>
        <span>Blocks left <strong id="left">${filledCount()}</strong></span>
      </div>

      <p id="status" class="status status-${statusKind}" role="status">${statusText}</p>

      <div class="stage">
        <div class="board-wrap">
          <svg id="selection-line" class="selection-line" aria-hidden="true">
            <polyline points="" />
          </svg>
          <div id="board" class="board" role="grid" aria-label="Number blocks">
            ${board
              .map((row, rowIndex) =>
                row
                  .map((value, colIndex) => `
                    <button
                      type="button"
                      class="block${value === null ? " empty" : ""}"
                      data-row="${rowIndex}"
                      data-col="${colIndex}"
                      role="gridcell"
                    ></button>
                  `)
                  .join(""),
              )
              .join("")}
          </div>
        </div>

        <div class="tools">
          <p id="tools-label" class="tools-label">Pick three blocks first</p>
          <div class="ops">
            <button type="button" class="op op-mul" data-op="×">×</button>
            <button type="button" class="op op-div" data-op="÷">÷</button>
            <button type="button" class="op op-add" data-op="+">+</button>
            <button type="button" class="op op-sub" data-op="−">−</button>
          </div>
        </div>
      </div>

      <div id="win-banner" class="win-banner" hidden>
        <p>You cleared the whole board!</p>
        <button type="button" class="primary" data-action="again">Play again</button>
      </div>

      <div class="actions">
        <button type="button" data-action="clear">Clear picks</button>
        <button type="button" data-action="undo">Undo bust</button>
        <button type="button" data-action="hint">Hint</button>
        <button type="button" class="primary" data-action="new">New puzzle</button>
      </div>
    </div>
  `;

  bindEvents();
  updateBoard();
  updateChrome();
  requestAnimationFrame(drawLine);
}

function bindEvents(): void {
  const boardEl = document.querySelector<HTMLElement>("#board");
  if (!boardEl) return;

  boardEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || celebrating || pendingClear) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;

    dragging = true;
    dragAdded = false;
    boardEl.setPointerCapture(event.pointerId);

    if (!isSelected(cell)) {
      if (addToSelection(cell)) {
        dragAdded = true;
        updateBoard();
        updateChrome();
        drawLine();
      }
    }
  });

  boardEl.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell || isSelected(cell)) return;
    if (addToSelection(cell)) {
      dragAdded = true;
      updateBoard();
      updateChrome();
      drawLine();
    }
  });

  const endDrag = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (boardEl.hasPointerCapture(event.pointerId)) {
      boardEl.releasePointerCapture(event.pointerId);
    }
  };

  boardEl.addEventListener("pointerup", endDrag);
  boardEl.addEventListener("pointercancel", endDrag);

  boardEl.addEventListener("click", (event) => {
    if (pendingClear || celebrating) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-row]");
    if (!button) return;
    const cell = { row: Number(button.dataset.row), col: Number(button.dataset.col) };
    if (isSelected(cell) && !dragAdded) {
      removeFromSelection(cell);
      updateBoard();
      updateChrome();
      drawLine();
    }
    dragAdded = false;
  });

  app.querySelectorAll<HTMLButtonElement>("[data-op]").forEach((button) => {
    button.addEventListener("click", () => {
      tryOperator(button.dataset.op as Operator);
    });
  });

  app.querySelector("[data-action='clear']")?.addEventListener("click", () => {
    resetPicks("Picks cleared. Tap three blocks.");
    updateBoard();
    updateChrome();
    drawLine();
  });
  app.querySelector("[data-action='undo']")?.addEventListener("click", undoBust);
  app.querySelector("[data-action='hint']")?.addEventListener("click", showHint);
  app.querySelector("[data-action='new']")?.addEventListener("click", () => newPuzzle(false));
  app.querySelector("[data-action='again']")?.addEventListener("click", () => newPuzzle(false));
}

window.addEventListener("resize", drawLine);
render();
