import type { BoardSize } from "./progress";

/** Phone play column. 3×3 boards always stay inside this cap. */
export const PHONE_SHELL_MAX_PX = 430;

/**
 * CSS viewport width where a 6×6 board may leave the phone column.
 * Matches `@media (min-width: 640px)` in `style.css`.
 */
export const TABLET_MIN_WIDTH_PX = 640;

/** Upper cap so a desktop window does not stretch 6×6 into a mural. */
export const TABLET_SIX_SHELL_MAX_PX = 960;

export type BoardLayout = {
  size: BoardSize;
  step: number;
  scale: number;
};

export type CameraFitInsets = {
  pad: number;
  margin: number;
};

export function isTabletViewport(widthPx: number): boolean {
  return widthPx >= TABLET_MIN_WIDTH_PX;
}

/**
 * Tablet scale rule (shell width):
 *
 * - 3×3 always uses the phone column (`PHONE_SHELL_MAX_PX`), even on tablet,
 *   so early boards do not balloon.
 * - 6×6 on phone stays in that same column so portrait still fits.
 * - 6×6 on tablet / wide viewports expands toward the viewport (capped) so
 *   the square grid can grow on both axes until it hits the nearer canvas side.
 */
export function shellWidthCapPx(boardSize: BoardSize, viewportWidth: number): number {
  const width = Math.max(0, viewportWidth);
  if (boardSize >= 6 && isTabletViewport(width)) {
    return Math.min(TABLET_SIX_SHELL_MAX_PX, width);
  }
  return Math.min(PHONE_SHELL_MAX_PX, width);
}

export function layoutFor(size: BoardSize, viewportWidth = 0): BoardLayout {
  if (size >= 6) {
    if (isTabletViewport(viewportWidth)) {
      // Chunkier tiles / tighter gutters once the shell has room to grow.
      return { size: 6, step: 0.66, scale: 0.6 };
    }
    return { size: 6, step: 0.6, scale: 0.5 };
  }
  return { size: 3, step: 1.18, scale: 1 };
}

/**
 * World-space padding and extra camera margin around the board AABB.
 * Tablet 6×6 uses a tighter fit so the larger shell is actually filled.
 */
export function cameraFitInsets(size: BoardSize, viewportWidth: number): CameraFitInsets {
  if (size >= 6 && isTabletViewport(viewportWidth)) {
    return { pad: 0.55, margin: 1.035 };
  }
  if (size >= 6) return { pad: 0.7, margin: 1.08 };
  return { pad: 0.95, margin: 1.12 };
}

export function layoutsEqual(a: BoardLayout, b: BoardLayout): boolean {
  return a.size === b.size && a.step === b.step && a.scale === b.scale;
}

/** Approx. HUD + op dock height; used only to compare board CSS spans. */
const CHROME_H = 180;

/**
 * Approximate CSS pixels the fitted square board occupies in the canvas.
 * Isometric camera adds a little extra, but this is enough to lock the rule:
 * tablet 6×6 must grow on both axes vs phone 6×6; tablet 3×3 must not balloon.
 */
export function estimatedBoardCssPx(
  boardSize: BoardSize,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const canvasW = shellWidthCapPx(boardSize, viewportWidth);
  const canvasH = Math.max(1, viewportHeight - CHROME_H);
  const { margin } = cameraFitInsets(boardSize, canvasW);
  const span = Math.min(canvasW, canvasH) / margin;
  return { width: span, height: span };
}
