# Math Busters

A cozy number-block puzzle for kids. Line up **three numbers**, pick a math tool (**× ÷ + −**), and bust the blocks when they make a true equation.

Inspired by Joe’s handwritten design paper: clear every number from a 3×3 board. Example first move on the starter puzzle: `4 × 5 = 20`.

## How to play

1. Tap three number blocks (or drag a line through them).
2. Pick a math tool.
3. If any order of those numbers makes `a op b = c` — with exact whole-number division only — those three blocks clear.
4. Clear the whole board to win.

**Hint** highlights one true equation. **Undo bust** puts the last three blocks back if a move leaves leftovers that no longer work.

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

Source of truth is the Origin repo. The public site is GitHub Pages from [`josephschneider77-sys/math-busters`](https://github.com/josephschneider77-sys/math-busters) (`dist/` via GitHub Actions).

## Stack

Vite, TypeScript, and plain DOM/CSS. No framework.
