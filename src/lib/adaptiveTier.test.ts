import { describe, it, expect } from "vitest";
import { tierForAverage } from "./adaptiveTier";

// Shared by AdaptiveTierMode's teacher-facing preview and StudentPracticePage's
// actual question filter - if these two ever disagree, a student sees a
// different tier than the teacher previewed. Pinning the exact thresholds here
// stops either side from drifting independently.
describe("tierForAverage", () => {
  it("defaults to standard when there's no grade history yet", () => {
    expect(tierForAverage(null)).toBe("standard");
  });

  it("routes below 60 to support", () => {
    expect(tierForAverage(0)).toBe("support");
    expect(tierForAverage(59)).toBe("support");
    expect(tierForAverage(59.9)).toBe("support");
  });

  it("routes above 85 to challenge", () => {
    expect(tierForAverage(85.1)).toBe("challenge");
    expect(tierForAverage(100)).toBe("challenge");
  });

  it("keeps the [60, 85] band (inclusive both ends) at standard", () => {
    expect(tierForAverage(60)).toBe("standard");
    expect(tierForAverage(72.5)).toBe("standard");
    expect(tierForAverage(85)).toBe("standard");
  });
});
