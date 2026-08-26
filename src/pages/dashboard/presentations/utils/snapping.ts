import type { SlideObject } from '../types';

export interface GuideLine {
  orientation: 'v' | 'h';
  pos: number;
}

const SNAP_THRESHOLD = 6; // px, at the canvas's native 960x540 scale

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function nearestSnap(value: number, targets: number[]): number | null {
  let best: number | null = null;
  let bestDist = SNAP_THRESHOLD + 1;
  for (const t of targets) {
    const dist = Math.abs(value - t);
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  return bestDist <= SNAP_THRESHOLD ? best : null;
}

/**
 * Snaps a dragged object's position to the canvas center/edges and to
 * sibling objects' edges/centers, independently per axis. Returns the
 * (possibly adjusted) x/y and the guide lines to display for whatever
 * snapped.
 */
export function computeSnap(dragging: Rect, siblings: SlideObject[], canvasW: number, canvasH: number): { x: number; y: number; guides: GuideLine[] } {
  const guides: GuideLine[] = [];

  const xTargets: number[] = [0, canvasW / 2, canvasW];
  const yTargets: number[] = [0, canvasH / 2, canvasH];
  for (const s of siblings) {
    xTargets.push(s.x, s.x + s.width / 2, s.x + s.width);
    yTargets.push(s.y, s.y + s.height / 2, s.y + s.height);
  }

  let x = dragging.x;
  const left = dragging.x;
  const centerX = dragging.x + dragging.width / 2;
  const right = dragging.x + dragging.width;

  const leftSnap = nearestSnap(left, xTargets);
  const centerXSnap = nearestSnap(centerX, xTargets);
  const rightSnap = nearestSnap(right, xTargets);
  if (centerXSnap !== null && (leftSnap === null || Math.abs(centerX - centerXSnap) <= Math.abs(left - (leftSnap ?? Infinity)))) {
    x = centerXSnap - dragging.width / 2;
    guides.push({ orientation: 'v', pos: centerXSnap });
  } else if (leftSnap !== null) {
    x = leftSnap;
    guides.push({ orientation: 'v', pos: leftSnap });
  } else if (rightSnap !== null) {
    x = rightSnap - dragging.width;
    guides.push({ orientation: 'v', pos: rightSnap });
  }

  let y = dragging.y;
  const top = dragging.y;
  const centerY = dragging.y + dragging.height / 2;
  const bottom = dragging.y + dragging.height;

  const topSnap = nearestSnap(top, yTargets);
  const centerYSnap = nearestSnap(centerY, yTargets);
  const bottomSnap = nearestSnap(bottom, yTargets);
  if (centerYSnap !== null && (topSnap === null || Math.abs(centerY - centerYSnap) <= Math.abs(top - (topSnap ?? Infinity)))) {
    y = centerYSnap - dragging.height / 2;
    guides.push({ orientation: 'h', pos: centerYSnap });
  } else if (topSnap !== null) {
    y = topSnap;
    guides.push({ orientation: 'h', pos: topSnap });
  } else if (bottomSnap !== null) {
    y = bottomSnap - dragging.height;
    guides.push({ orientation: 'h', pos: bottomSnap });
  }

  return { x, y, guides };
}
