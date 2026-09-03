export interface WeightedGradeInput {
  grade: number;
  maxGrade: number | null | undefined;
  weightPercent: number | null | undefined;
}

/**
 * The one weighted-average formula for "overall grade" across assignments,
 * shared by every page that shows one so they can't drift out of sync with
 * each other (parent dashboard, student grades, report card, coordinator/
 * principal stats) - previously each reimplemented this independently and
 * only one of them actually applied weight_percent.
 *
 * A missing/zero weight falls back to 10 so an unweighted assignment still
 * counts instead of being silently dropped from the average.
 */
export function computeWeightedAverage(entries: WeightedGradeInput[]): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const entry of entries) {
    const weight = entry.weightPercent || 10;
    const normalized = (entry.grade / (entry.maxGrade || 100)) * 100;
    weightedSum += normalized * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
}
