import { Board3D } from "./board3d";
import {
  evaluateOrdered,
  formatDraftEquation,
  formatEquation,
  formatOrderedMiss,
  type Operator,
} from "./math";
import { formatOps, specForLevel, type LevelSpec } from "./progress";
import {
  clearSavedRun,
  readSavedRun,
  writeSavedRun,
  type RunSnapshot,
  type SavedStatusKind,
} from "./persist";
import {
  EXAMPLE_BOARD,
  clearCells,
  cloneBoard,
  generatePuzzle,
  pickSafeHint,
  isBoardEmpty,
  isBoardStuck,
  isFullySolvable,
  type Board,
  type CellRef,
} from "./puzzle";
import {
  armAudioUnlock,
  playBust,
  playDeny,
  playDeselect,
  playMiss,
  playPathWarn,
  playReform,
  playSelect,
  playStart,
  playWin,
  unlockAudio,
} from "./sfx";
import "./style.css";

type StatusKind = "idle" | "ready" | "hit" | "miss" | "win" | "stuck" | "path";
type Screen = "title" | "play";

const HS_KEY = "math-busters-high-score";
const TUT_KEY = "math-busters-tutorial-seen";
const BUST_POINTS = 100;
const CLEAR_BONUS = 250;
const START_HINTS = 5;

const TIPS = [
  { step: "1 / 3", body: "Tap three blocks in order: first number, then next, then the answer." },
  { step: "2 / 3", body: "Then tap × ÷ + − in the blank. Order counts — 4 □ 4 = 16 only busts with ×!" },
  { step: "3 / 3", body: "Stuck? Hint shows a winning equation. Undo takes a bust back." },
] as const;

function requireApp(): HTMLDivElement {
  const el = document.querySelector<HTMLDivElement>("#app");
  if (!el) throw new Error("Missing #app");
  return el;
}

function readHighScore(): number {
  try {
    const n = Number(window.localStorage.getItem(HS_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeHighScore(value: number): void {
  try {
    window.localStorage.setItem(HS_KEY, String(value));
  } catch {
    /* ignore quota / private mode */
  }
}

function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(TUT_KEY) === "1";
  } catch {
    return false;
  }
}

function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(TUT_KEY, "1");
  } catch {
    /* ignore */
  }
}

const app = requireApp();

let screen: Screen = "title";
let spec: LevelSpec = specForLevel(1);
let board: Board = cloneBoard(EXAMPLE_BOARD);
let selection: CellRef[] = [];
let busts = 0;
let score = 0;
let highScore = readHighScore();
let hints = START_HINTS;
let level = 1;
let celebrating = false;
let hintCells: CellRef[] = [];
let statusKind: StatusKind = "idle";
let statusText = "Tap three number blocks.";
let statusHtml: string | null = null;
let pendingClear: CellRef[] | null = null;
let press: { x: number; y: number } | null = null;
let animating = false;
let history: Array<{ board: Board; busts: number; score: number }> = [];
let reforming: CellRef[] = [];
let view: Board3D | null = null;
let pathBlocked = false;
let coachText = "";
let dealGen = 0;
let tipStep = -1;

function sameCell(a: CellRef, b: CellRef): boolean {
  return a.row === b.row && a.col === b.col;
}

function isSelected(cell: CellRef): boolean {
  return selection.some((picked) => sameCell(picked, cell));
}

function selectionValues(): [number, number, number] | null {
  if (selection.length !== 3) return null;
  const values = selection.map((cell) => board[cell.row][cell.col]);
  if (values.some((value) => value === null)) return null;
  return values as [number, number, number];
}

function setStatus(kind: StatusKind, text: string, html: string | null = null): void {
  statusKind = kind;
  statusText = text;
  statusHtml = html;
}

function statusWithEquation(
  kind: StatusKind,
  note: string,
  values: readonly (number | null | undefined)[] = [],
  op: Operator | null = null,
): void {
  setStatus(kind, note, renderEquationHtml(values, op, note));
}

function pickedNumbers(): Array<number | null> {
  return selection.map((cell) => board[cell.row][cell.col]);
}

function renderEquationHtml(
  values: readonly (number | null | undefined)[],
  op: Operator | null = null,
  note?: string,
): string {
  const slot = (value: number | null | undefined, kind: "num" | "ans"): string => {
    if (value == null) {
      return `<span class="eq-slot ${kind} blank"></span>`;
    }
    return `<span class="eq-slot ${kind}">${value}</span>`;
  };
  const opSlot = op
    ? `<span class="eq-slot op">${op}</span>`
    : `<span class="eq-slot op blank">□</span>`;
  const noteHtml = `<span class="eq-note">${note ?? "&nbsp;"}</span>`;
  return `<span class="eq-wrap"><span class="eq-line">${slot(values[0], "num")}${opSlot}${slot(values[1], "num")}<span class="eq-eq">=</span>${slot(values[2], "ans")}</span>${noteHtml}</span>`;
}

statusHtml = renderEquationHtml([], null, statusText);

function refreshPickStatus(): void {
  const nums = pickedNumbers();
  if (nums.length === 0) {
    statusWithEquation("idle", defaultIdleMessage());
    return;
  }
  const draft = formatDraftEquation(nums);
  const note = nums.length === 3 ? `Pick ${formatOps(spec.ops)}` : undefined;
  setStatus(nums.length === 3 ? "ready" : "idle", draft, renderEquationHtml(nums, null, note));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function bumpHighScore(): void {
  if (score > highScore) {
    highScore = score;
    writeHighScore(highScore);
  }
}

function defaultIdleMessage(): string {
  if (isBoardEmpty(board)) return "You busted every block!";
  if (isBoardStuck(board, spec.ops)) {
    return history.length
      ? "Those leftover numbers don’t make an equation. Undo and try a different trio!"
      : "Those leftover numbers don’t make an equation. Try a new game!";
  }
  return "Tap three number blocks.";
}

function dealMessage(next: LevelSpec, fallback: string): string {
  if (next.size === 9) return "Huge 9×9 board! Still tap three blocks, then an op.";
  if (next.size === 6) return "Big 6×6 board! Still tap three blocks, then an op.";
  if (next.ops.length === 2) return `Only ${formatOps(next.ops)} this level. Tap three blocks.`;
  return fallback;
}

function resetPicks(message?: string): void {
  selection = [];
  hintCells = [];
  pendingClear = null;
  if (isBoardEmpty(board)) {
    celebrating = true;
    setStatus("win", "You busted every block!");
  } else if (isBoardStuck(board)) {
    statusWithEquation("stuck", defaultIdleMessage());
  } else {
    celebrating = false;
    statusWithEquation("idle", message ?? defaultIdleMessage());
  }
}

function addToSelection(cell: CellRef): boolean {
  if (celebrating || pendingClear || animating) return false;
  if (board[cell.row][cell.col] === null) return false;
  if (isSelected(cell) || selection.length >= 3) return false;

  hintCells = [];
  if (pathBlocked) {
    pathBlocked = false;
    coachText = "";
  }
  selection = [...selection, cell];
  playSelect();
  refreshPickStatus();
  return true;
}

function removeFromSelection(cell: CellRef): void {
  if (pendingClear || animating) return;
  selection = selection.filter((picked) => !sameCell(picked, cell));
  playDeselect();
  refreshPickStatus();
}

function hiddenCells(): CellRef[] {
  if (pendingClear) return pendingClear;
  if (reforming.length) return reforming;
  return [];
}

function syncView(): void {
  view?.sync(board, selection, hintCells, hiddenCells());
}

function applyShellSize(size: LevelSpec["size"]): void {
  document.querySelector(".shell")?.classList.toggle("board-wide", size >= 6);
}

function levelFromQuery(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("level");
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

function startingLevel(): number {
  return levelFromQuery() ?? 1;
}

function snapshotRun(): RunSnapshot {
  return {
    level,
    score,
    hints,
    busts,
    board,
    selection,
    hintCells,
    history,
    pathBlocked,
    coachText,
    celebrating,
    statusKind: statusKind as SavedStatusKind,
    statusText,
    statusHtml,
    tipStep,
  };
}

function persistRun(): void {
  if (screen !== "play") return;
  writeSavedRun(snapshotRun());
}

function applyRun(saved: RunSnapshot): void {
  level = saved.level;
  spec = specForLevel(level);
  score = saved.score;
  hints = saved.hints;
  busts = saved.busts;
  board = cloneBoard(saved.board);
  selection = saved.selection.map((cell) => ({ row: cell.row, col: cell.col }));
  hintCells = saved.hintCells.map((cell) => ({ row: cell.row, col: cell.col }));
  history = saved.history.map((item) => ({
    board: cloneBoard(item.board),
    busts: item.busts,
    score: item.score,
  }));
  pathBlocked = saved.pathBlocked;
  coachText = saved.coachText;
  celebrating = saved.celebrating;
  statusKind = saved.statusKind;
  statusText = saved.statusText;
  statusHtml = saved.statusHtml;
  tipStep = saved.tipStep;
  pendingClear = null;
  reforming = [];
  animating = false;
  press = null;
}

function showPlayView(): void {
  applyShellSize(spec.size);
  ensureView();
  view?.configure(spec.size);
  syncView();
  updateChrome();
  renderTip();
  requestAnimationFrame(() => {
    view?.resize();
    drawLine();
  });
}

function resumeRun(saved: RunSnapshot): boolean {
  screen = "play";
  applyRun(saved);
  if (isBoardEmpty(board)) {
    celebrating = false;
    level += 1;
    dealBoard(false, dealMessage(specForLevel(level), "Fresh board! Tap three blocks."));
    return true;
  }
  showPlayView();
  persistRun();
  return true;
}

function tryResume(): boolean {
  if (levelFromQuery() != null) return false;
  const saved = readSavedRun();
  if (!saved) return false;
  return resumeRun(saved);
}

function dealBoard(useExample = false, message?: string): void {
  dealGen += 1;
  spec = specForLevel(level);
  applyShellSize(spec.size);
  view?.configure(spec.size);
  board = useExample && spec.size === 3 ? cloneBoard(EXAMPLE_BOARD) : generatePuzzle(spec);
  busts = 0;
  celebrating = false;
  press = null;
  pendingClear = null;
  history = [];
  reforming = [];
  pathBlocked = false;
  coachText = "";
  selection = [];
  hintCells = [];
  resetPicks(message ?? "Tap three number blocks.");
  syncView();
  updateChrome();
  drawLine();
  persistRun();
}

function ensureView(): Board3D {
  if (view) return view;
  const host = document.querySelector<HTMLElement>("#board3d");
  if (!host) throw new Error("Missing #board3d");
  view = new Board3D(host);
  return view;
}

function startRun(): void {
  clearSavedRun();
  screen = "play";
  score = 0;
  hints = START_HINTS;
  level = startingLevel();
  animating = false;
  updateChrome();
  ensureView();
  dealBoard(true, "Tap three blocks!");
  beginTutorialIfNeeded();
  persistRun();
  requestAnimationFrame(() => {
    view?.resize();
    drawLine();
  });
}

function beginTutorialIfNeeded(): void {
  tipStep = hasSeenTutorial() ? -1 : 0;
  renderTip();
}

function dismissTutorial(): void {
  if (tipStep >= 0) markTutorialSeen();
  tipStep = -1;
  renderTip();
}

function advanceTip(): void {
  if (tipStep < 0) return;
  tipStep += 1;
  if (tipStep >= TIPS.length) {
    tipStep = -1;
    markTutorialSeen();
  }
  renderTip();
}

function renderTip(): void {
  const slot = document.querySelector<HTMLElement>("#tip-slot");
  if (!slot) return;
  if (tipStep < 0 || tipStep >= TIPS.length) {
    slot.hidden = true;
    slot.replaceChildren();
    return;
  }
  const tip = TIPS[tipStep];
  const last = tipStep === TIPS.length - 1;
  slot.hidden = false;
  slot.innerHTML = `
    <div class="tip-card" role="dialog" aria-label="How to play">
      <p class="tip-step">${tip.step}</p>
      <p class="tip-body">${tip.body}</p>
      <div class="tip-actions">
        <button type="button" class="tip-skip" data-tip="skip">Skip</button>
        <button type="button" class="tip-next" data-tip="next">${last ? "Let’s play!" : "Got it"}</button>
      </div>
    </div>
  `;
}

function drawLine(): void {
  const svg = document.querySelector<SVGSVGElement>("#selection-line");
  const wrap = document.querySelector<HTMLElement>(".board-wrap");
  if (!svg || !wrap || !view) return;

  const rect = wrap.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.style.width = `${rect.width}px`;
  svg.style.height = `${rect.height}px`;

  const points = selection
    .map((cell) => view?.project(cell))
    .filter((point): point is { x: number; y: number } => Boolean(point))
    .map((point) => `${point.x},${point.y}`);

  svg.querySelector("polyline")?.setAttribute("points", points.join(" "));
}

async function undoBust(): Promise<void> {
  const previous = history.pop();
  if (!previous || pendingClear || animating || !view) return;

  const returning: CellRef[] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] === null && previous.board[row]?.[col] !== null) {
        returning.push({ row, col });
      }
    }
  }

  animating = true;
  board = cloneBoard(previous.board);
  busts = previous.busts;
  score = previous.score;
  celebrating = false;
  reforming = returning;
  pathBlocked = false;
  coachText = "";
  resetPicks("Bust undone. Try a different three blocks.");
  syncView();
  updateChrome();
  drawLine();
  playReform();
  await view.implode(returning);

  reforming = [];
  animating = false;
  syncView();
  updateChrome();
  drawLine();
  persistRun();
}

async function tryOperator(op: Operator): Promise<void> {
  const values = selectionValues();
  if (!values || animating || !view) return;
  if (!spec.ops.includes(op)) return;

  const result = evaluateOrdered(values, op);
  if ("miss" in result) {
    playMiss();
    view.shake();
    flashMiss();
    selection = [];
    hintCells = [];
    pendingClear = null;
    const missText = formatOrderedMiss(result.miss);
    setStatus(
      "miss",
      missText,
      renderEquationHtml(
        [result.miss.a, result.miss.b, result.miss.actual],
        result.miss.op,
        result.miss.actual === null
          ? result.miss.op === "÷"
            ? `not a whole number · you picked ${result.miss.expected}`
            : `doesn’t work · you picked ${result.miss.expected}`
          : `not ${result.miss.expected}`,
      ),
    );
    syncView();
    updateChrome();
    drawLine();
    persistRun();
    return;
  }
  const equation = result.hit;

  const cells = selection.slice();
  const preview = clearCells(board, cells);
  const wins = isBoardEmpty(preview);
  const stranded = !wins && !isFullySolvable(preview, spec.ops);

  pendingClear = cells;
  animating = true;
  const bustText = formatEquation(equation);
  setStatus(
    "hit",
    `${bustText}  ·  Bust!`,
    renderEquationHtml([equation.a, equation.b, equation.c], equation.op, "Bust!"),
  );
  updateChrome();
  syncView();
  drawLine();
  playBust();
  await view.explode(cells);

  if (stranded) {
    coachText = "That combination works but won’t complete the puzzle";
    pathBlocked = true;
    setStatus("path", `${bustText} · ${coachText}`);
    updateChrome();
    playPathWarn();
    await wait(240);
    reforming = cells;
    playReform();
    await view.implode(cells);
    pendingClear = null;
    reforming = [];
    selection = [];
    hintCells = [];
    animating = false;
    celebrating = false;
    resetPicks(coachText);
    setStatus("path", `${bustText} · ${coachText}`);
    syncView();
    updateChrome();
    drawLine();
    persistRun();
    return;
  }

  history.push({ board: cloneBoard(board), busts, score });
  board = preview;
  busts += 1;
  score += BUST_POINTS;
  if (wins) {
    score += CLEAR_BONUS;
    hints += 1;
  }
  bumpHighScore();
  pendingClear = null;
  reforming = [];
  pathBlocked = false;
  coachText = "";
  resetPicks(wins ? `${bustText}  ·  You busted every block!` : `${bustText}  ·  +${BUST_POINTS}! Keep going.`);
  syncView();
  updateChrome();
  drawLine();
  persistRun();

  if (wins) {
    playWin();
    const gen = dealGen;
    animating = false;
    setStatus("win", `${bustText}  ·  Level clear! +${CLEAR_BONUS}  ·  +1 hint`);
    updateChrome();
    await wait(1100);
    if (gen !== dealGen) return;
    level += 1;
    dismissTutorial();
    const next = specForLevel(level);
    dealBoard(false, dealMessage(next, "Fresh board! Tap three blocks."));
    return;
  }

  animating = false;
  updateChrome();
}

function showHint(): void {
  if (celebrating || pendingClear || animating) return;
  if (hints <= 0) {
    playDeny();
    const hintBtn = document.querySelector<HTMLButtonElement>("[data-action='hint']");
    hintBtn?.classList.remove("has-none");
    void hintBtn?.offsetWidth;
    hintBtn?.classList.add("has-none");
    setStatus("miss", "No hints left — win a board to earn one!");
    updateChrome();
    return;
  }
  const trio = pickSafeHint(board, spec.ops);
  if (!trio) {
    playDeny();
    if (!isFullySolvable(board, spec.ops)) {
      console.warn("Hint: current board is not fully solvable; no safe trio.");
    }
    setStatus("miss", "No safe hint right now — that path wouldn’t finish the board.");
    updateChrome();
    return;
  }
  hints -= 1;
  hintCells = trio.cells;
  selection = [];
  const hintEq = formatEquation(trio.equation);
  setStatus(
    "idle",
    `Hint: ${hintEq} — tap in that order!`,
    renderEquationHtml(
      [trio.equation.a, trio.equation.b, trio.equation.c],
      trio.equation.op,
      "tap in that order",
    ),
  );
  syncView();
  updateChrome();
  drawLine();
  persistRun();
}

function updateChrome(): void {
  const splash = document.querySelector<HTMLElement>("#splash");
  const play = document.querySelector<HTMLElement>("#play");
  if (splash) splash.hidden = screen !== "title";
  if (play) play.hidden = screen !== "play";

  const splashBest = document.querySelector("#splash-best");
  if (splashBest) {
    splashBest.textContent = highScore > 0 ? `Best ${highScore}` : "Beat your best score!";
  }

  const status = document.querySelector<HTMLElement>("#status");
  if (status) {
    status.className = `status status-${statusKind}${statusHtml ? " status-eq" : ""}`;
    if (statusHtml) status.innerHTML = statusHtml;
    else status.textContent = statusText;
  }

  const scoreEl = document.querySelector("#score");
  const bestEl = document.querySelector("#best");
  const levelEl = document.querySelector("#level");
  const hintsEl = document.querySelector("#hints-left");
  if (scoreEl) scoreEl.textContent = String(score);
  if (bestEl) bestEl.textContent = String(highScore);
  if (levelEl) levelEl.textContent = String(level);
  if (hintsEl) hintsEl.textContent = String(hints);

  const open = selection.length === 3 && !celebrating;
  const allowed = new Set(spec.ops);
  document.querySelector(".ops-bar")?.classList.toggle("open", open);
  document.querySelector(".ops")?.classList.toggle("pair", spec.ops.length === 2);
  document.querySelectorAll<HTMLButtonElement>("[data-op]").forEach((button) => {
    const op = button.dataset.op as Operator;
    const shown = allowed.has(op);
    button.hidden = !shown;
    button.disabled = !shown || !open || animating;
  });

  const undoBtn = document.querySelector<HTMLButtonElement>("[data-action='undo']");
  if (undoBtn) undoBtn.disabled = history.length === 0 || Boolean(pendingClear) || animating;

  const hintBtn = document.querySelector<HTMLButtonElement>("[data-action='hint']");
  if (hintBtn) {
    hintBtn.disabled = celebrating || animating || Boolean(pendingClear);
  }

  play?.classList.toggle("won", celebrating);
  play?.classList.toggle("wrong-path", pathBlocked);

  const coach = document.querySelector<HTMLElement>("#coach");
  if (coach) {
    coach.hidden = !pathBlocked;
    coach.textContent = pathBlocked ? coachText : "";
  }
}

function ensureShell(): void {
  if (app.querySelector(".shell")) return;

  app.innerHTML = `
    <div class="shell">
      <section id="splash" class="splash">
        <div class="splash-mark" aria-hidden="true">×</div>
        <h1>Math Busters</h1>
        <p class="splash-how">Tap <strong>3 blocks in order</strong> (first □ next = answer), then <strong>×</strong> <strong>÷</strong> <strong>+</strong> <strong>−</strong>. A true equation busts them!</p>
        <p id="splash-best" class="splash-best">${highScore > 0 ? `Best ${highScore}` : "Beat your best score!"}</p>
        <button type="button" class="play-cta" data-action="play">Play</button>
      </section>

      <div id="play" class="play" hidden>
        <header class="topbar">
          <div class="scores">
            <div class="score-now"><span id="score">${score}</span></div>
            <div class="score-best">Best <span id="best">${highScore}</span> · Lv <span id="level">${level}</span></div>
          </div>
          <p id="status" class="status status-${statusKind} status-eq" role="status">${renderEquationHtml([], null, statusText)}</p>
        </header>
        <div id="tip-slot" class="tip-slot" hidden></div>

        <div class="playfield">
          <div class="board-wrap">
            <div id="board3d" class="board3d" role="grid" aria-label="Number blocks"></div>
            <svg id="selection-line" class="selection-line" aria-hidden="true">
              <polyline points="" />
            </svg>
            <p id="coach" class="coach" hidden role="status"></p>
          </div>
          <div class="ops-bar">
            <div class="dock">
              <button type="button" class="dock-btn dock-undo" data-action="undo">Undo</button>
              <button type="button" class="dock-btn dock-hint" data-action="hint">Hint <span id="hints-left">${hints}</span></button>
            </div>
            <div class="ops">
              <button type="button" class="op op-mul" data-op="×">×</button>
              <button type="button" class="op op-div" data-op="÷">÷</button>
              <button type="button" class="op op-add" data-op="+">+</button>
              <button type="button" class="op op-sub" data-op="−">−</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  bindEvents();
}

function flashMiss(): void {
  const wrap = document.querySelector<HTMLElement>(".board-wrap");
  if (!wrap) return;
  wrap.classList.remove("miss");
  void wrap.offsetWidth;
  wrap.classList.add("miss");
}

function tapCell(clientX: number, clientY: number): void {
  if (screen !== "play" || celebrating || pendingClear || animating || !view) return;
  const cell = view.pick(clientX, clientY);
  if (!cell) return;
  if (isSelected(cell)) removeFromSelection(cell);
  else addToSelection(cell);
  syncView();
  updateChrome();
  drawLine();
  persistRun();
}

function bindEvents(): void {
  const wrap = document.querySelector<HTMLElement>(".board-wrap");
  if (!wrap) return;

  wrap.addEventListener("pointerdown", (event) => {
    unlockAudio();
    if (event.button !== 0 || celebrating || pendingClear || animating) return;
    press = { x: event.clientX, y: event.clientY };
  });

  wrap.addEventListener("pointerup", (event) => {
    if (!press) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    press = null;
    if (Math.hypot(dx, dy) > 12) return;
    tapCell(event.clientX, event.clientY);
  });

  wrap.addEventListener("pointercancel", () => {
    press = null;
  });

  app.querySelectorAll<HTMLButtonElement>("[data-op]").forEach((button) => {
    button.addEventListener("click", () => {
      unlockAudio();
      void tryOperator(button.dataset.op as Operator);
    });
  });

  app.querySelector("[data-action='play']")?.addEventListener("click", () => {
    unlockAudio();
    playStart();
    startRun();
  });
  app.querySelector("[data-action='undo']")?.addEventListener("click", () => {
    unlockAudio();
    void undoBust();
  });
  app.querySelector("[data-action='hint']")?.addEventListener("click", () => {
    unlockAudio();
    showHint();
  });
  app.querySelector("#tip-slot")?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tip]");
    if (!button) return;
    unlockAudio();
    if (button.dataset.tip === "skip") dismissTutorial();
    else advanceTip();
    persistRun();
  });
}

window.addEventListener("resize", () => {
  view?.resize();
  drawLine();
});
window.visualViewport?.addEventListener("resize", () => {
  view?.resize();
  drawLine();
});

function onBackground(): void {
  persistRun();
}

function onForeground(): void {
  if (screen === "play") return;
  tryResume();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") onBackground();
  else onForeground();
});
window.addEventListener("pagehide", onBackground);
window.addEventListener("blur", onBackground);
window.addEventListener("pageshow", onForeground);

armAudioUnlock();
ensureShell();
if (!tryResume()) {
  updateChrome();
  requestAnimationFrame(() => {
    view?.resize();
    drawLine();
  });
}
