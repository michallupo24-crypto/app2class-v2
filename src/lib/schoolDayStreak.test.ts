import { describe, it, expect } from "vitest";
import { computeSchoolDayStreak } from "./schoolDayStreak";

describe("computeSchoolDayStreak", () => {
  it("counts consecutive attended school days and skips weekends (no records)", () => {
    // Thu, then Sun/Mon after the weekend
    const r = computeSchoolDayStreak([
      { date: "2026-10-15", status: "present" },
      { date: "2026-10-18", status: "late" },
      { date: "2026-10-19", status: "present" },
    ]);
    expect(r).toEqual({ current: 3, longest: 3, totalDays: 3 });
  });

  it("an unexcused absence day breaks the streak", () => {
    const r = computeSchoolDayStreak([
      { date: "2026-10-12", status: "present" },
      { date: "2026-10-13", status: "present" },
      { date: "2026-10-14", status: "absent" },
      { date: "2026-10-15", status: "present" },
    ]);
    expect(r).toEqual({ current: 1, longest: 2, totalDays: 3 });
  });

  it("attending one lesson that day keeps the streak even if absent from another", () => {
    const r = computeSchoolDayStreak([
      { date: "2026-10-14", status: "present" },
      { date: "2026-10-15", status: "absent" },
      { date: "2026-10-15", status: "present" },
    ]);
    expect(r.current).toBe(2);
  });

  it("excused or justified absence days neither add nor break", () => {
    const r = computeSchoolDayStreak([
      { date: "2026-10-13", status: "present" },
      { date: "2026-10-14", status: "excused" },
      { date: "2026-10-15", status: "absent", justified: true },
      { date: "2026-10-18", status: "present" },
    ]);
    expect(r).toEqual({ current: 2, longest: 2, totalDays: 2 });
  });

  it("is order-independent and empty-safe", () => {
    expect(computeSchoolDayStreak([])).toEqual({ current: 0, longest: 0, totalDays: 0 });
    const r = computeSchoolDayStreak([
      { date: "2026-10-15", status: "present" },
      { date: "2026-10-13", status: "absent" },
      { date: "2026-10-14", status: "present" },
    ]);
    expect(r.current).toBe(2);
  });
});
