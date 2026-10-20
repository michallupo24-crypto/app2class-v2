import { describe, expect, it } from "vitest";
import {
  applySwipe, swipeAxis, swipeDirection, swipeOffset, swipeOutcome, swipeThreshold,
  SWIPE_COMMIT_MAX_PX, SWIPE_COMMIT_MIN_PX,
} from "./attendanceSwipe";

describe("swipeAxis", () => {
  it("waits until the finger moves past the slop", () => {
    expect(swipeAxis(4, 3)).toBeNull();
  });
  it("locks to horizontal for a sideways drag", () => {
    expect(swipeAxis(30, 5)).toBe("x");
    expect(swipeAxis(-30, -8)).toBe("x");
  });
  it("treats a vertical or diagonal drag as a scroll", () => {
    expect(swipeAxis(5, 30)).toBe("y");
    expect(swipeAxis(20, 20)).toBe("y");
  });
});

describe("swipeThreshold", () => {
  it("scales with the row but stays within bounds", () => {
    expect(swipeThreshold(100)).toBe(SWIPE_COMMIT_MIN_PX);
    expect(swipeThreshold(300)).toBeCloseTo(84);
    expect(swipeThreshold(1200)).toBe(SWIPE_COMMIT_MAX_PX);
  });
});

describe("swipeDirection / swipeOutcome (RTL)", () => {
  const width = 343; // phone row; threshold ≈ 96px
  it("right = חיסור, left = נוכח", () => {
    expect(swipeDirection(10)).toBe("absent");
    expect(swipeDirection(-10)).toBe("present");
    expect(swipeDirection(0)).toBeNull();
  });
  it("commits only past the threshold", () => {
    expect(swipeOutcome(60, width)).toBeNull();
    expect(swipeOutcome(-60, width)).toBeNull();
    expect(swipeOutcome(120, width)).toBe("absent");
    expect(swipeOutcome(-120, width)).toBe("present");
  });
});

describe("swipeOffset", () => {
  it("follows the finger up to the threshold, then resists", () => {
    expect(swipeOffset(50, 343)).toBe(50);
    expect(swipeOffset(-50, 343)).toBe(-50);
    const t = swipeThreshold(343);
    expect(swipeOffset(t + 100, 343)).toBeCloseTo(t + 35);
  });
  it("never slides the row more than 60% of its width", () => {
    expect(swipeOffset(5000, 343)).toBeCloseTo(343 * 0.6);
  });
});

describe("applySwipe", () => {
  it("marks absent, and a second חיסור swipe undoes it", () => {
    expect(applySwipe(null, "absent")).toBe("absent");
    expect(applySwipe("present", "absent")).toBe("absent");
    expect(applySwipe("absent", "absent")).toBeNull();
  });
  it("נוכח marks present and clears absent/late", () => {
    expect(applySwipe(null, "present")).toBe("present");
    expect(applySwipe("absent", "present")).toBe("present");
    expect(applySwipe("late", "present")).toBe("present");
  });
  it("marks a whole class by swiping each row", () => {
    const statuses: (ReturnType<typeof applySwipe>)[] = [null, null, null, null];
    const swipes = [-120, 120, -120, -120];
    swipes.forEach((dx, i) => {
      const action = swipeOutcome(dx, 343);
      if (action) statuses[i] = applySwipe(statuses[i], action);
    });
    expect(statuses).toEqual(["present", "absent", "present", "present"]);
  });
});
