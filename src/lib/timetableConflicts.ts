import type { GeneratedSlot } from "./timetableGenerator";

// A trimmed view of teacher_constraints - only the fields a manual-edit
// conflict check needs, so this module doesn't depend on the full DB row shape.
export interface ConstraintLite {
  teacher_id: string;
  constraint_type: string;
  day_of_week: number | null;
  lesson_number: number | null;
  is_hard: boolean;
  status: string;
  note?: string | null;
}

export interface SlotConflict {
  kind: "teacher_double_booked" | "room_double_booked" | "teacher_constraint";
  message: string;
}

const CONSTRAINT_TYPE_LABEL: Record<string, string> = {
  unavailable_slot: "אי-זמינות קבועה",
  staff_meeting: "ישיבת צוות/מקצוע",
};

/**
 * Checks whether placing `candidate` (a manual edit, not yet in `otherSlots`)
 * would violate a hard invariant: the same teacher or room already booked
 * elsewhere at that exact day/lesson, or an approved hard teacher_constraints
 * row for that teacher at that day/lesson. `otherSlots` must NOT include the
 * slot being replaced (the caller filters that out before calling this).
 */
export function checkSlotConflict(
  candidate: GeneratedSlot,
  otherSlots: GeneratedSlot[],
  constraints: ConstraintLite[]
): SlotConflict | null {
  if (candidate.teacher_id) {
    const doubleBooked = otherSlots.some(
      s => s.teacher_id === candidate.teacher_id && s.day_of_week === candidate.day_of_week && s.lesson_number === candidate.lesson_number
    );
    if (doubleBooked) {
      return { kind: "teacher_double_booked", message: "המורה כבר משובץ/ת לכיתה אחרת באותה שעה בדיוק" };
    }

    const violated = constraints.find(
      c => c.teacher_id === candidate.teacher_id
        && c.is_hard
        && c.status === "approved"
        && (c.constraint_type === "unavailable_slot" || c.constraint_type === "staff_meeting")
        && c.day_of_week === candidate.day_of_week
        && c.lesson_number === candidate.lesson_number
    );
    if (violated) {
      const label = CONSTRAINT_TYPE_LABEL[violated.constraint_type] || violated.constraint_type;
      return {
        kind: "teacher_constraint",
        message: `המורה לא זמינ/ה בשעה זו — אילוץ: ${label}${violated.note ? ` (${violated.note})` : ""}`,
      };
    }
  }

  if (candidate.room) {
    const roomTaken = otherSlots.some(
      s => s.room === candidate.room && s.day_of_week === candidate.day_of_week && s.lesson_number === candidate.lesson_number
    );
    if (roomTaken) {
      return { kind: "room_double_booked", message: "החדר תפוס על ידי כיתה אחרת באותה שעה בדיוק" };
    }
  }

  return null;
}

export interface AlternativeSlot {
  day: number;
  lesson: number;
}

/**
 * Scans every (day, lesson) combination for one class and returns the ones
 * where placing the same subject/teacher/room would NOT conflict - i.e. a
 * ready-made list of valid alternatives to offer a coordinator when their
 * manual edit collides with something (see ConflictResolutionDialog).
 */
export function findAlternativeSlots(
  classId: string,
  subject: string,
  teacherId: string | null,
  room: string | null,
  otherSlots: GeneratedSlot[],
  constraints: ConstraintLite[],
  days: number[],
  lessons: number[]
): AlternativeSlot[] {
  const results: AlternativeSlot[] = [];
  for (const day of days) {
    for (const lesson of lessons) {
      const classOccupied = otherSlots.some(s => s.class_id === classId && s.day_of_week === day && s.lesson_number === lesson);
      if (classOccupied) continue;
      const candidate: GeneratedSlot = {
        class_id: classId,
        day_of_week: day,
        lesson_number: lesson,
        subject,
        teacher_id: teacherId,
        teacher_name: null,
        room,
        group_name: null,
      };
      if (!checkSlotConflict(candidate, otherSlots, constraints)) {
        results.push({ day, lesson });
      }
    }
  }
  return results;
}
