# Math Busters

A cozy 3D number-block puzzle for kids. Line up **three numbers**, pick a math tool (**× ÷ + −**), and bust the blocks when they make a true equation. Correct busts shatter the cubes into candy pieces; **Undo** plays that explosion in reverse as the tiles reform.

The playfield is real **Three.js** (chunky pastel blocks, isometric-ish camera, Lisa Frank candy lighting) inspired by [Division Drop](https://josephschneider77-sys.github.io/division-drop/). Gameplay stays Math Busters: pick 3 numbers → pick an operator → clear the equation.

Inspired by Joe’s handwritten design paper: clear every number from a 3×3 board. Example first move on the starter puzzle: `4 × 5 = 20`.

## How to play

1. Tap three number blocks (one tap each — no dragging).
2. Pick a math tool.
3. If any order of those numbers makes `a op b = c` — with exact whole-number division only — those three blocks clear.
4. Clear the whole board to win.

**Hint** highlights one true equation. **Undo bust** puts the last three blocks back if a move leaves leftovers that no longer work. If a true equation would strand the board, a coach banner asks you to Undo — the math still counts, it just isn’t the finishing order.

**New puzzle** builds a fresh 3×3 board that has at least one valid trio and can be cleared all the way.

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

## Stack

Vite, TypeScript, and vanilla Three.js. No React / R3F. Juicy SFX are synthesized with the Web Audio API (unlocked on the first tap).
