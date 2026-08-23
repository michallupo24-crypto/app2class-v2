export type Tier = "support" | "standard" | "challenge";

// Shared between the teacher-facing distribution preview (AdaptiveTierMode)
// and the student-facing question filter (StudentPracticePage) so both sides
// agree on the same thresholds.
export const tierForAverage = (avg: number | null): Tier =>
  avg == null ? "standard" : avg < 60 ? "support" : avg > 85 ? "challenge" : "standard";
