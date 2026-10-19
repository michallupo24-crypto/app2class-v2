/* Swipe-to-mark logic for the roll call rows, kept free of React so it can be
   unit tested (real touch can't be emulated in the preview).

   Directions follow the RTL convention for row actions (iOS mirrors its
   trailing "delete" swipe in RTL): dragging the row to the right reveals red
   on the left = חיסור; dragging it to the left reveals green on the right =
   נוכח, which also undoes a חיסור/איחור. */

export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type SwipeAction = "absent" | "present";

/** Movement before we decide whether the gesture is a swipe or a scroll. */
export const SWIPE_SLOP_PX = 10;
/** Distance that commits a swipe; capped so wide rows don't need a long drag. */
export const SWIPE_COMMIT_MIN_PX = 64;
export const SWIPE_COMMIT_MAX_PX = 110;
export const SWIPE_COMMIT_FRACTION = 0.28;

export type SwipeAxis = "x" | "y" | null;

/** Lock the gesture to an axis once it moves past the slop. */
export function swipeAxis(dx: number, dy: number): SwipeAxis {
  if (Math.abs(dx) < SWIPE_SLOP_PX && Math.abs(dy) < SWIPE_SLOP_PX) return null;
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
}

export function swipeThreshold(rowWidth: number): number {
  return Math.min(SWIPE_COMMIT_MAX_PX, Math.max(SWIPE_COMMIT_MIN_PX, rowWidth * SWIPE_COMMIT_FRACTION));
}

/** Which action the current drag points at (for the colored reveal). */
export function swipeDirection(dx: number): SwipeAction | null {
  if (dx > 0) return "absent";
  if (dx < 0) return "present";
  return null;
}

/** The action a released drag commits, or null if it didn't go far enough. */
export function swipeOutcome(dx: number, rowWidth: number): SwipeAction | null {
  return Math.abs(dx) >= swipeThreshold(rowWidth) ? swipeDirection(dx) : null;
}

/** Offset to draw while dragging: follows the finger, with resistance past the threshold. */
export function swipeOffset(dx: number, rowWidth: number): number {
  const t = swipeThreshold(rowWidth);
  const a = Math.abs(dx);
  const shown = a <= t ? a : t + (a - t) * 0.35;
  return Math.sign(dx) * Math.min(shown, rowWidth * 0.6);
}

/** New status after a swipe. Swiping חיסור on an absent student undoes it. */
export function applySwipe(current: AttendanceStatus | null, action: SwipeAction): AttendanceStatus | null {
  if (action === "absent") return current === "absent" ? null : "absent";
  return "present";
}
