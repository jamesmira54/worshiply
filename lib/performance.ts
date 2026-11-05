// Performance mode settings and scroll math. No React or DOM, so it can be tested directly.

/** Text sizes offered in performance mode, in pt. */
export const TEXT_SIZES = [18, 22, 26, 32, 40, 48];
/** Auto-scroll speeds, in CSS pixels per second. */
export const SCROLL_SPEEDS = [10, 15, 20, 30, 40, 60, 80];
export const DEFAULT_SPEED_INDEX = 2;

const DEFAULT_TEXT_SIZE = 26;
// A frame gap longer than this (a tab returning from the background) is not
// allowed to jump the song forward.
const MAX_FRAME_MS = 100;

/** Start at 26pt, or at the song's own size when that is larger. */
export function initialTextSizeIndex(songFontSize: number) {
  const target = Math.max(DEFAULT_TEXT_SIZE, songFontSize);
  const index = TEXT_SIZES.findIndex((size) => size >= target);
  return index === -1 ? TEXT_SIZES.length - 1 : index;
}

export function stepIndex(length: number, index: number, delta: number) {
  return Math.min(length - 1, Math.max(0, index + delta));
}

export function nextScrollPosition(
  position: number,
  pxPerSecond: number,
  elapsedMs: number,
  maxPosition: number,
) {
  const elapsed = Math.min(MAX_FRAME_MS, Math.max(0, elapsedMs));
  const next = Math.min(maxPosition, position + (pxPerSecond * elapsed) / 1000);
  return { position: next, atEnd: next >= maxPosition };
}
