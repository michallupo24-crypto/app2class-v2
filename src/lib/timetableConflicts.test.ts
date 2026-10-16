import { describe, it, expect } from "vitest";
import { checkSlotConflict, findAlternativeSlots, type ConstraintLite } from "./timetableConflicts";
import type { GeneratedSlot } from "./timetableGenerator";

const slot = (over: Partial<GeneratedSlot>): GeneratedSlot => ({
  class_id: "c1",
  day_of_week: 0,
  lesson_number: 1,
  subject: "מתמטיקה",
  teacher_id: "t1",
  teacher_name: "מורה א",
  room: null,
  group_name: null,
  ...over,
});

describe("checkSlotConflict", () => {
  it("flags a teacher double-booking and reports the blocking slot", () => {
    const existing = slot({ class_id: "c2" });
    const candidate = slot({ class_id: "c1" });
    const conflict = checkSlotConflict(candidate, [existing], []);
    expect(conflict?.kind).toBe("teacher_double_booked");
    expect(conflict?.blockingSlots).toEqual([existing]);
  });

  it("does not flag two rows sharing the same non-null group_name as a conflict (a merged/shared lesson)", () => {
    const existing = slot({ class_id: "c2", group_name: "שיעור משותף — מתמטיקה" });
    const candidate = slot({ class_id: "c1", group_name: "שיעור משותף — מתמטיקה" });
    const conflict = checkSlotConflict(candidate, [existing], []);
    expect(conflict).toBeNull();
  });

  it("flags a hard, approved teacher_constraints violation", () => {
    const constraints: ConstraintLite[] = [{
      teacher_id: "t1",
      constraint_type: "staff_meeting",
      day_of_week: 0,
      lesson_number: 1,
      is_hard: true,
      status: "approved",
      note: "ישיבת צוות",
    }];
    const conflict = checkSlotConflict(slot({}), [], constraints);
    expect(conflict?.kind).toBe("teacher_constraint");
    expect(conflict?.message).toContain("ישיבת צוות");
  });

  it("ignores a soft or pending constraint", () => {
    const soft: ConstraintLite[] = [{
      teacher_id: "t1", constraint_type: "staff_meeting", day_of_week: 0, lesson_number: 1,
      is_hard: false, status: "approved",
    }];
    const pending: ConstraintLite[] = [{
      teacher_id: "t1", constraint_type: "staff_meeting", day_of_week: 0, lesson_number: 1,
      is_hard: true, status: "pending",
    }];
    expect(checkSlotConflict(slot({}), [], soft)).toBeNull();
    expect(checkSlotConflict(slot({}), [], pending)).toBeNull();
  });

  it("flags a room double-booking", () => {
    const existing = slot({ class_id: "c2", teacher_id: "t2", room: "חדר 1" });
    const candidate = slot({ class_id: "c1", teacher_id: null, room: "חדר 1" });
    const conflict = checkSlotConflict(candidate, [existing], []);
    expect(conflict?.kind).toBe("room_double_booked");
  });
});

describe("findAlternativeSlots", () => {
  it("only returns day/lesson combinations where the class is free and no conflict occurs", () => {
    const existing = slot({ class_id: "c1", day_of_week: 0, lesson_number: 2 }); // class already busy here
    const blockingElsewhere = slot({ class_id: "c2", day_of_week: 0, lesson_number: 1 }); // same teacher busy here (different class)
    const alternatives = findAlternativeSlots(
      "c1", "מתמטיקה", "t1", null, [existing, blockingElsewhere], [], [0], [1, 2, 3]
    );
    expect(alternatives).toEqual([{ day: 0, lesson: 3 }]);
  });
});
