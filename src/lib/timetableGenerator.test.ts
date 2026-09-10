import { describe, it, expect } from "vitest";
import {
  generateTimetable,
  isPlaceholderTeacherId,
  sanitizePlaceholderTeacher,
  type GenerateTimetableInput,
  type GeneratedSlot,
} from "./timetableGenerator";

// This generator writes directly into timetable_slots for every class in a
// school - the one invariant that must NEVER break, regardless of how the
// internal heuristics evolve, is "nobody is booked twice at the same moment"
// (a class in two places, a teacher teaching two classes, or a room over its
// physical capacity). These tests don't assert on the specific placement the
// algorithm chooses (that's free to change) - only on that invariant, so they
// keep guarding correctness even as the scheduling heuristics are tuned.

const baseInput = (): GenerateTimetableInput => ({
  classes: [
    { id: "c1", grade: "ז", class_number: 1 },
    { id: "c2", grade: "ז", class_number: 2 },
  ],
  periods: [1, 2, 3, 4],
  days: [0, 1, 2, 3, 4],
  requirements: [
    {
      class_id: "c1", grade: "ז", subject: "מתמטיקה",
      weekly_hours: 3, block_size: 1, group_count: 1,
      preferred_room_type: null, is_grade_wide: false, track_group: null,
      track_kind: null, base_subject: null, group_label: null,
    },
    {
      class_id: "c2", grade: "ז", subject: "מתמטיקה",
      weekly_hours: 3, block_size: 1, group_count: 1,
      preferred_room_type: null, is_grade_wide: false, track_group: null,
      track_kind: null, base_subject: null, group_label: null,
    },
  ],
  // Same teacher eligible for both classes' math - the generator must never
  // place them at the same day/period for both classes at once.
  eligibleTeachers: [
    { class_id: "c1", subject: "מתמטיקה", teacher_id: "t1", teacher_name: "מורה א" },
    { class_id: "c2", subject: "מתמטיקה", teacher_id: "t1", teacher_name: "מורה א" },
  ],
  unavailable: new Set<string>(),
  rooms: [{ name: "חדר 1", room_type: "classroom", capacity: 1 }],
  lockedSlots: [],
});

function assertNoDoubleBooking(slots: GeneratedSlot[], rooms: { name: string; capacity: number }[]) {
  // 1. A class can't be in two places in the same day/period - UNLESS both
  // rows carry a (distinct) group_name, matching timetable_slots' own two
  // partial unique indexes (one for group_name is null, one keyed including
  // group_name for group_name is not null): a shared track/הקבצה/ability-group
  // slot legitimately puts several parallel-group rows on one class at once.
  const perClassSlot = new Map<string, GeneratedSlot>();
  for (const s of slots) {
    const k = `${s.class_id}-${s.day_of_week}-${s.lesson_number}-${s.group_name ?? ""}`;
    expect(perClassSlot.has(k), `class ${s.class_id} double-booked at day ${s.day_of_week} period ${s.lesson_number}`).toBe(false);
    perClassSlot.set(k, s);
  }

  // 2. A (real, non-placeholder) teacher can't teach two classes at once -
  // UNLESS every row at that day/lesson shares the same (non-null)
  // group_name, meaning they're all copies of the SAME shared track/הקבצה/
  // ability-group lesson (one teacher, one time, replicated per attending
  // class for display) rather than the teacher genuinely being in two
  // places - see the class-booking comment above for the identical rationale.
  const teacherRows = new Map<string, GeneratedSlot[]>();
  for (const s of slots) {
    if (!s.teacher_id || isPlaceholderTeacherId(s.teacher_id)) continue;
    const k = `${s.teacher_id}-${s.day_of_week}-${s.lesson_number}`;
    if (!teacherRows.has(k)) teacherRows.set(k, []);
    teacherRows.get(k)!.push(s);
  }
  for (const [k, rows] of teacherRows) {
    if (rows.length <= 1) continue;
    const groupNames = new Set(rows.map((r) => r.group_name));
    expect(groupNames.size, `teacher double-booked across different groups at ${k}`).toBe(1);
    expect(rows[0].group_name, `teacher double-booked (no shared group) at ${k}`).not.toBeNull();
  }

  // 3. A room can't host more classes at once than its capacity allows.
  const roomCapacity = new Map(rooms.map((r) => [r.name, r.capacity]));
  const roomUsage = new Map<string, number>();
  for (const s of slots) {
    if (!s.room) continue;
    const k = `${s.room}-${s.day_of_week}-${s.lesson_number}`;
    const used = (roomUsage.get(k) || 0) + 1;
    roomUsage.set(k, used);
    const capacity = roomCapacity.get(s.room) ?? Infinity;
    expect(used, `room ${s.room} over capacity (${capacity}) at day ${s.day_of_week} period ${s.lesson_number}`).toBeLessThanOrEqual(capacity);
  }
}

describe("generateTimetable", () => {
  it("never double-books a class, a teacher, or a room", () => {
    const input = baseInput();
    const result = generateTimetable(input);
    assertNoDoubleBooking(result.slots, input.rooms);
  });

  it("never schedules outside the given days/periods", () => {
    const input = baseInput();
    const result = generateTimetable(input);
    for (const s of result.slots) {
      expect(input.days).toContain(s.day_of_week);
      expect(input.periods).toContain(s.lesson_number);
    }
  });

  it("respects pre-existing locked slots instead of overwriting them", () => {
    const input = baseInput();
    const locked: GeneratedSlot = {
      class_id: "c1", day_of_week: 0, lesson_number: 1,
      subject: "אנגלית", teacher_id: "t2", teacher_name: "מורה ב",
      room: null, group_name: null,
    };
    input.lockedSlots = [locked];
    const result = generateTimetable(input);

    // The locked slot's exact spot must survive untouched.
    const same = result.slots.find(
      (s) => s.class_id === "c1" && s.day_of_week === 0 && s.lesson_number === 1
    );
    expect(same).toBeDefined();
    expect(same?.subject).toBe("אנגלית");

    assertNoDoubleBooking(result.slots, input.rooms);
  });

  it("marks teachers assigned via placeholder ids for later manual completion", () => {
    const input = baseInput();
    input.eligibleTeachers = []; // force the generator to fall back to placeholders, if any are produced
    const result = generateTimetable(input);
    for (const slot of result.slots) {
      if (!isPlaceholderTeacherId(slot.teacher_id)) continue;
      const sanitized = sanitizePlaceholderTeacher(slot);
      expect(sanitized.teacher_id).toBeNull();
    }
  });

  it("places a grade-wide subject split into ability groups (same subject, several teachers, one shared slot)", () => {
    // Whole grade has "אנגלית" at the same slot, split into 3 cross-class
    // level groups, each with its own teacher - the exact scenario
    // track_kind='ability_group' exists for (see optionKey in timetableGenerator.ts).
    const input: GenerateTimetableInput = {
      classes: [
        { id: "c1", grade: "ז", class_number: 1 },
        { id: "c2", grade: "ז", class_number: 2 },
      ],
      periods: [1, 2, 3, 4],
      days: [0, 1, 2, 3, 4],
      requirements: [
        {
          class_id: "c1", grade: "ז", subject: "אנגלית",
          weekly_hours: 2, block_size: 1, group_count: 1, preferred_room_type: null,
          is_grade_wide: true, track_group: "אנגלית - קבוצות רמה",
          track_kind: "ability_group", base_subject: "אנגלית", group_label: "קבוצה א'",
        },
        {
          class_id: "c2", grade: "ז", subject: "אנגלית",
          weekly_hours: 2, block_size: 1, group_count: 1, preferred_room_type: null,
          is_grade_wide: true, track_group: "אנגלית - קבוצות רמה",
          track_kind: "ability_group", base_subject: "אנגלית", group_label: "קבוצה ב'",
        },
        {
          class_id: "c1", grade: "ז", subject: "אנגלית",
          weekly_hours: 2, block_size: 1, group_count: 1, preferred_room_type: null,
          is_grade_wide: true, track_group: "אנגלית - קבוצות רמה",
          track_kind: "ability_group", base_subject: "אנגלית", group_label: "קבוצה ג'",
        },
      ],
      eligibleTeachers: [
        { class_id: "c1", subject: "אנגלית", teacher_id: "t1", teacher_name: "מורה א" },
        { class_id: "c1", subject: "אנגלית", teacher_id: "t2", teacher_name: "מורה ב" },
        { class_id: "c1", subject: "אנגלית", teacher_id: "t3", teacher_name: "מורה ג" },
      ],
      unavailable: new Set<string>(),
      rooms: [],
      lockedSlots: [],
    };

    const result = generateTimetable(input);
    assertNoDoubleBooking(result.slots, input.rooms);

    // Every slot stays reported under the plain subject name - never a
    // composed "אנגלית (קבוצה א')"-style string.
    expect(result.slots.every((s) => s.subject === "אנגלית")).toBe(true);

    // Both classes get the identical day/lesson set (a true shared slot),
    // and each of the 3 groups gets its own distinct teacher.
    const groupsByLesson = new Map<string, Set<string>>();
    for (const s of result.slots) {
      const k = `${s.day_of_week}-${s.lesson_number}`;
      if (!groupsByLesson.has(k)) groupsByLesson.set(k, new Set());
      if (s.group_name) groupsByLesson.get(k)!.add(s.group_name);
    }
    const sharedSlotWithAllGroups = Array.from(groupsByLesson.values()).some((g) => g.size === 3);
    expect(sharedSlotWithAllGroups).toBe(true);

    const teacherIds = new Set(result.slots.map((s) => s.teacher_id).filter(Boolean));
    expect(teacherIds.size).toBe(3);
  });
});
