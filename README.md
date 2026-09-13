# Math Busters

A cozy 3D number-block puzzle for kids. Line up **three numbers**, pick a math tool (**× ÷ + −**), and bust the blocks when they make a true equation. Correct busts shatter the cubes into candy pieces; a wrong-order bust explodes then flies back. Clearing a board auto-deals the next one.

The playfield is real **Three.js** (chunky pastel blocks, isometric-ish camera, Lisa Frank candy lighting) inspired by [Division Drop](https://josephschneider77-sys.github.io/division-drop/).

## How to play

1. Tap **Play** on the title screen.
2. Tap three number blocks (one tap each — no dragging).
3. Pick a math tool. A true equation busts those blocks.
4. Clear the whole board to win the level — a new solvable board deals itself.

**Hint** (bottom bar) highlights a true equation that can still finish the board and spends 1 hint (you start a run with 5; each level win gives +1). **Undo** (next to Hint) puts the last successful bust back and returns those points. A run starts from the title **Play** button; winning a board auto-deals the next one.

A wrong operator clears your picks. A true equation that would strand the board still explodes, then auto-reverses with a coach note.

## Level ladder

A Play run keeps your level across auto-restocks (each win deals the next board and +1 hint):

1. **Lv 1–5** — 3×3, all four ops (`+ − × ÷`). Numbers get bigger across these levels (still ~3rd-grade; no huge multi-digit monsters).
2. **Lv 6–10** — 3×3, exactly two ops. Cycles `−÷`, `+×`, `−×`, `+÷`, `×÷`. Unused op buttons hide. Generation and hints only use the pair on screen.
3. **Lv 11–14** — 6×6, all four ops. Same rule: tap exactly three numbers, then one op, until all 36 cells are gone (12 busts).
4. **Lv 15+** — 9×9, all four ops. Same three-number + one-op rule, until all 81 cells are gone (27 busts).

Every dealt board has a winning path under the current ops and size.

## Scoring

- **+100** per successful bust (a trio that stays cleared).
- **+250** bonus when you clear the whole board (level win).
- Wrong-order reverse and wrong-operator misses score 0.
- **Undo** restores the score from before that bust.
- High score is saved in `localStorage` and shown as **Best**.

## Play

https://josephschneider77-sys.github.io/math-busters/

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default [http://127.0.0.1:43127/math-busters/](http://127.0.0.1:43127/math-busters/)). Vite `base` is `/math-busters/` so GitHub Pages project URLs resolve.

```bash
npm run build
npm run preview
```

Source of truth is the Origin repo. The public site is GitHub Pages from [`josephschneider77-sys/math-busters`](https://github.com/josephschneider77-sys/math-busters).

## Play Store (PWA → AAB)

Installable PWA (`display: standalone`, service worker, maskable icons). Package ID **`com.josephschneider77.mathbusters`**. See [`store/PLAY_STORE.md`](store/PLAY_STORE.md) — same PWABuilder path as Division Drop; **prefer WebView fallback** after TWA URL-bar issues on GitHub Project Pages.

## Stack

Vite, TypeScript, and vanilla Three.js. No React / R3F. Juicy SFX are synthesized with the Web Audio API (unlocked on the first tap).
