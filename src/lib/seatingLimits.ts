import type { ClassroomConfig } from '@/types/smartseat';

/**
 * Seating-map grid limits. A real classroom rarely goes past ~8 rows of desks
 * or 4-5 desk pairs across, so 10 × 10 (100 seats, 5 desk pairs per row) covers
 * any class of up to 40 students with room to spare, while keeping the grid
 * small enough to render and drag-and-drop smoothly. Huge values (e.g. 10000)
 * used to build millions of seats and froze the page.
 */
export const MAX_SEAT_ROWS = 10;
export const MAX_SEAT_COLS = 10;
export const MIN_SEAT_DIM = 1;

export const clampDim = (value: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(MIN_SEAT_DIM, Math.floor(value))) : MIN_SEAT_DIM;

/** Returns a config whose rows/cols are within the allowed range. */
export const clampConfig = (c: ClassroomConfig): ClassroomConfig => ({
    ...c,
    rows: clampDim(c.rows, MAX_SEAT_ROWS),
    cols: clampDim(c.cols, MAX_SEAT_COLS),
});
