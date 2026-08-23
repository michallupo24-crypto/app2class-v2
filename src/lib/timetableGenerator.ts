import type { GradeLevel } from "@/lib/constants";

const MIDDLE_SCHOOL_GRADES: GradeLevel[] = ["ז", "ח", "ט"];

export interface GeneratorClass {
  id: string;
  grade: GradeLevel;
  class_number: number;
}

// subject_requirements already resolved so class_id always points at a real class
// (a grade-wide default row is expanded into one entry per class of that grade).
export interface GeneratorRequirement {
  class_id: string;
  grade: GradeLevel;
  subject: string;
  weekly_hours: number;
  block_size: number;
  group_count: number;
  preferred_room_type: string | null;
  // Every class in this grade must get this subject at the exact same
  // day/period (cross-class ability grouping like math/English) - grouped by
  // (grade, subject) and placed as one atomic unit per week-block instead of
  // independently per class. Ignored when track_group is set (see below).
  is_grade_wide: boolean;
  // Tracks/electives (מגמות): rows sharing the same (grade, track_group)
  // are the option set for ONE shared block - every class in the grade
  // attends simultaneously, but each option is a DIFFERENT subject with its
  // own teacher/room (unlike is_grade_wide, where every class gets the same
  // subject). Implies grade-wide placement regardless of is_grade_wide.
  track_group: string | null;
}

export interface EligibleTeacher {
  class_id: string;
  subject: string;
  teacher_id: string;
  teacher_name: string;
}

export interface RoomInfo {
  name: string;
  room_type: string;
  // How many classes can use this room at the same day/period - a normal
  // classroom is 1, but a shared space (gym, hall) can be higher, letting
  // several classes occupy it simultaneously instead of needing one distinct
  // room instance per class.
  capacity: number;
}

export interface GeneratedSlot {
  class_id: string;
  day_of_week: number;
  lesson_number: number;
  subject: string;
  teacher_id: string | null;
  teacher_name: string | null;
  room: string | null;
  group_name: string | null;
}

export interface TimetableConflict {
  class_id: string | null;
  grade: GradeLevel | null;
  subject: string;
  reason: string;
  severity: "error" | "warning";
}

export interface GenerateTimetableInput {
  classes: GeneratorClass[];
  periods: number[]; // non-break lesson_numbers, in daily order
  days: number[];
  requirements: GeneratorRequirement[];
  eligibleTeachers: EligibleTeacher[];
  unavailable: Set<string>; // `${teacherId}-${day}-${lesson}`
  rooms: RoomInfo[];
  lockedSlots: GeneratedSlot[];
}

export interface GenerateTimetableResult {
  slots: GeneratedSlot[];
  conflicts: TimetableConflict[];
}

interface Unit {
  class_id: string;
  grade: GradeLevel;
  subject: string;
  blockLen: number;
  groupName: string | null;
  preferredRoomType: string | null;
}

const key = (...parts: (string | number)[]) => parts.join("-");

// Placeholder teacher ids (synthesized from subject_teacher_counts, not a
// real profiles row) are only valid as in-memory occupancy keys - they are
// not UUIDs and must never be written to timetable_slots.teacher_id, which
// is a real uuid column. Callers should sanitize with this before persisting
// or displaying results, which also keeps the slot open for a coordinator to
// fill a real teacher in via the "השלמות ותיקונים" flow.
const PLACEHOLDER_PREFIX = "placeholder-";
export const isPlaceholderTeacherId = (id: string | null | undefined): boolean =>
  !!id && id.startsWith(PLACEHOLDER_PREFIX);

export function sanitizePlaceholderTeacher(slot: GeneratedSlot): GeneratedSlot {
  if (!isPlaceholderTeacherId(slot.teacher_id)) return slot;
  return { ...slot, teacher_id: null, teacher_name: slot.teacher_name ? `${slot.teacher_name} (לשיבוץ)` : null };
}

/**
 * Deterministic, hand-rolled constraint-satisfaction timetable generator.
 * Not an LLM call - exact scheduling constraints (no double-booking, no gaps)
 * need a real solver, not a language model.
 *
 * Builds the schedule's subject/time/room skeleton first; teacher assignment
 * is NOT a prerequisite (a class/day/period never fails to schedule for lack
 * of a teacher_classes-linked teacher) - it's filled in opportunistically
 * when a free eligible teacher happens to be known, and otherwise left for a
 * coordinator to complete afterwards in the "השלמות ותיקונים" tab.
 *
 * Grade-wide subjects (is_grade_wide, e.g. math/English taught in cross-class
 * ability groups) are placed as one atomic unit per week-block across every
 * class in the grade simultaneously, before any per-class unit - so the whole
 * grade shares the identical free day/period, each class getting its own
 * (distinct) teacher and room where possible.
 *
 * Track blocks (track_group, e.g. מגמות) go a step further: several rows
 * sharing the same (grade, track_group) are DIFFERENT subjects (the track
 * options) that all meet at the one shared slot - every class attends
 * simultaneously, but each option gets its own teacher/room, and the output
 * duplicates every option into every class's rows (tagged via group_name)
 * so the app's existing per-student track lookup (see student_tracks /
 * WeeklyTimetable "pickSlot") can pick the row matching each student's
 * actual track choice. Track blocks are placed before anything else, since
 * they're the most resource-constrained unit.
 *
 * Both grade-wide and track-block slots, once placed, are never relocated
 * independently in the gap-repair pass, since moving just one class (or one
 * option) would break the shared-slot guarantee for the rest of the grade.
 *
 * Known simplification: group_count > 1 (parallel ability/elective groups for
 * the same class+subject) schedules each group on its own independent free
 * slot rather than guaranteeing all groups land on the exact same slot -
 * true concurrent same-class splitting would need a more involved co-placement
 * search. group_count is also currently ignored for is_grade_wide subjects
 * (only weekly_hours/block_size/preferred_room_type are read from them). The
 * DB schema (group_name-aware unique indexes) supports true concurrency for
 * manual placement; the generator doesn't exploit it yet.
 */
export function generateTimetable(input: GenerateTimetableInput): GenerateTimetableResult {
  const { classes, periods, days, requirements, eligibleTeachers, unavailable, rooms, lockedSlots } = input;
  const classesById = new Map(classes.map(c => [c.id, c]));

  const slots: GeneratedSlot[] = [...lockedSlots];
  const conflicts: TimetableConflict[] = [];

  // class occupancy: classId-day-lesson -> slot (only ever one entry per key
  // in this generator, since units always require a fully free class slot)
  const classOccupied = new Map<string, GeneratedSlot>();
  const teacherOccupied = new Set<string>();
  // room-day-lesson -> how many classes are currently using that room then.
  // A room is available as long as usage stays below its own capacity - a
  // shared space (gym, hall) can host several classes at once, so this is a
  // counter, not a boolean "taken" flag.
  const roomUsage = new Map<string, number>();
  const roomCapacity = new Map(rooms.map(r => [r.name, Math.max(1, r.capacity || 1)]));
  // classId-day -> Set of occupied indices into `periods`
  const classDayPeriodIdx = new Map<string, Set<number>>();

  const periodIndex = new Map(periods.map((p, i) => [p, i]));

  const roomHasCapacity = (room: string, day: number, lesson: number): boolean =>
    (roomUsage.get(key(room, day, lesson)) ?? 0) < (roomCapacity.get(room) ?? 1);

  const markOccupied = (slot: GeneratedSlot) => {
    classOccupied.set(key(slot.class_id, slot.day_of_week, slot.lesson_number), slot);
    if (slot.teacher_id) teacherOccupied.add(key(slot.teacher_id, slot.day_of_week, slot.lesson_number));
    if (slot.room) {
      const k = key(slot.room, slot.day_of_week, slot.lesson_number);
      roomUsage.set(k, (roomUsage.get(k) ?? 0) + 1);
    }
    const idx = periodIndex.get(slot.lesson_number);
    if (idx !== undefined) {
      const dayKey = key(slot.class_id, slot.day_of_week);
      if (!classDayPeriodIdx.has(dayKey)) classDayPeriodIdx.set(dayKey, new Set());
      classDayPeriodIdx.get(dayKey)!.add(idx);
    }
  };

  const unmarkOccupied = (slot: GeneratedSlot) => {
    classOccupied.delete(key(slot.class_id, slot.day_of_week, slot.lesson_number));
    if (slot.teacher_id) teacherOccupied.delete(key(slot.teacher_id, slot.day_of_week, slot.lesson_number));
    if (slot.room) {
      const k = key(slot.room, slot.day_of_week, slot.lesson_number);
      roomUsage.set(k, Math.max(0, (roomUsage.get(k) ?? 0) - 1));
    }
    const idx = periodIndex.get(slot.lesson_number);
    if (idx !== undefined) {
      classDayPeriodIdx.get(key(slot.class_id, slot.day_of_week))?.delete(idx);
    }
  };

  for (const s of lockedSlots) markOccupied(s);

  // 1. Split requirements into three buckets, most-shared-constraint first:
  //    track blocks (multiple different subjects, one shared grade-wide slot)
  //    > grade-wide (one subject, every class simultaneously) > per-class.
  const trackReqs = requirements.filter(r => r.track_group);
  const gradeWideReqs = requirements.filter(r => !r.track_group && r.is_grade_wide);
  const perClassReqs = requirements.filter(r => !r.track_group && !r.is_grade_wide);

  interface TrackOption {
    subject: string;
    preferredRoomType: string | null;
  }
  interface TrackBlockUnit {
    grade: GradeLevel;
    trackGroup: string;
    classIds: string[];
    options: TrackOption[];
    blockLen: number;
  }

  const trackBlockUnits: TrackBlockUnit[] = [];
  {
    const grouped = new Map<string, GeneratorRequirement[]>();
    for (const r of trackReqs) {
      const k = key(r.grade, r.track_group!);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(r);
    }
    for (const reqs of grouped.values()) {
      // Every class needing any option in this track group must attend -
      // classIds should be identical across options in practice (the whole
      // grade), deduplicated defensively in case of partial per-class data.
      const classIds = Array.from(new Set(reqs.map(r => r.class_id)));
      const optionsBySubject = new Map(reqs.map(r => [r.subject, r]));
      const options: TrackOption[] = Array.from(optionsBySubject.values()).map(r => ({ subject: r.subject, preferredRoomType: r.preferred_room_type }));
      // Options can carry different weekly_hours (e.g. a 5-יח"ל הקבצה level
      // meeting more hours/week than 3-יח"ל) - block_size is still assumed
      // uniform across options (they share the same slot while both are
      // still active, so a per-option block size wouldn't mean anything).
      // Build one round per block_size-sized chunk up to the longest
      // option's total, each round including only the options that still
      // have hours remaining at that point - once a shorter option's hours
      // are used up it simply drops out of later rounds, while a longer
      // option keeps meeting (still with the whole grade free, since the
      // remaining option isn't necessarily the only one - a superset
      // constraint, but always correct).
      const base = reqs[0];
      const maxHours = Math.max(...Array.from(optionsBySubject.values()).map(r => r.weekly_hours));
      let covered = 0;
      while (covered < maxHours) {
        const blockLen = Math.min(base.block_size, maxHours - covered);
        const activeOptions = options.filter(o => optionsBySubject.get(o.subject)!.weekly_hours > covered);
        if (activeOptions.length > 0) {
          trackBlockUnits.push({ grade: base.grade, trackGroup: base.track_group!, classIds, options: activeOptions, blockLen });
        }
        covered += blockLen;
      }
    }
  }

  interface GradeWideUnit {
    grade: GradeLevel;
    subject: string;
    classIds: string[];
    blockLen: number;
    preferredRoomType: string | null;
  }

  const gradeWideUnits: GradeWideUnit[] = [];
  {
    const grouped = new Map<string, GeneratorRequirement[]>();
    for (const r of gradeWideReqs) {
      const k = key(r.grade, r.subject);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(r);
    }
    for (const reqs of grouped.values()) {
      const classIds = reqs.map(r => r.class_id);
      // All classes of a grade-wide subject are expected to share the same
      // weekly_hours/block_size/preferred_room_type - take them from the first.
      const base = reqs[0];
      let remaining = base.weekly_hours;
      while (remaining > 0) {
        const blockLen = Math.min(base.block_size, remaining);
        gradeWideUnits.push({ grade: base.grade, subject: base.subject, classIds, blockLen, preferredRoomType: base.preferred_room_type });
        remaining -= blockLen;
      }
    }
  }

  const units: Unit[] = [];
  for (const r of perClassReqs) {
    const groupCount = Math.max(1, r.group_count);
    for (let g = 0; g < groupCount; g++) {
      const groupName = groupCount > 1 ? `קבוצה ${g + 1}` : null;
      let remaining = r.weekly_hours;
      while (remaining > 0) {
        const blockLen = Math.min(r.block_size, remaining);
        units.push({
          class_id: r.class_id,
          grade: r.grade,
          subject: r.subject,
          blockLen,
          groupName,
          preferredRoomType: r.preferred_room_type,
        });
        remaining -= blockLen;
      }
    }
  }

  // 2. Eligible teachers per class+subject.
  const teachersFor = new Map<string, EligibleTeacher[]>();
  for (const t of eligibleTeachers) {
    const k = key(t.class_id, t.subject);
    if (!teachersFor.has(k)) teachersFor.set(k, []);
    teachersFor.get(k)!.push(t);
  }

  // 3. Placement order heuristic: units needing a specific room type go
  // first - a scarce resource (e.g. only 2 gyms school-wide for every class's
  // PE) gets first pick of the class's still-mostly-free week, rather than
  // being scheduled last just because its block happens to be small. Placing
  // it last (the previous ordering: bigger blocks first, PE's 1-hour blocks
  // sorted after every 2-hour subject) meant PE was fighting over whatever
  // few slots were left once the class's schedule was already dense - often
  // only one day per class had both a free period AND a free gym, forcing
  // the "must land on separate days" rule below into its relaxed fallback
  // and doubling PE onto a single day anyway. After room-type, units with
  // fewer already-eligible teachers and bigger blocks go first (doesn't gate
  // feasibility, just ordering).
  units.sort((a, b) => {
    const aRoom = a.preferredRoomType ? 1 : 0;
    const bRoom = b.preferredRoomType ? 1 : 0;
    if (aRoom !== bRoom) return bRoom - aRoom;
    const ta = teachersFor.get(key(a.class_id, a.subject))?.length ?? 0;
    const tb = teachersFor.get(key(b.class_id, b.subject))?.length ?? 0;
    if (ta !== tb) return ta - tb;
    return b.blockLen - a.blockLen;
  });

  const classLabel = (classId: string) => {
    const c = classesById.get(classId);
    return c ? `${c.grade}'${c.class_number}` : classId;
  };

  const roomsByType = new Map<string, string[]>();
  for (const r of rooms) {
    if (!roomsByType.has(r.room_type)) roomsByType.set(r.room_type, []);
    roomsByType.get(r.room_type)!.push(r.name);
  }
  const allRoomNames = rooms.map(r => r.name);

  const findRoom = (preferredType: string | null, day: number, lessons: number[]): string | null => {
    const candidates = preferredType ? (roomsByType.get(preferredType) || []) : allRoomNames;
    for (const room of candidates) {
      if (lessons.every(l => roomHasCapacity(room, day, l))) return room;
    }
    return null; // general subjects: fine to leave room unset; a required type with no capacity left is a hard miss
  };

  // Assign `count` simultaneous bookings of `preferredType` (or general
  // rooms) across the smallest number of rooms their combined capacity
  // allows - e.g. 5 classes + one gym with capacity 5 all share that one
  // room, rather than requiring 5 distinct room instances. Returns null if
  // there isn't enough combined capacity across all matching rooms.
  const assignRoomsForGroup = (preferredType: string | null, day: number, lessons: number[], count: number): (string | null)[] | null => {
    if (!preferredType) return Array(count).fill(null);
    const candidates = roomsByType.get(preferredType) || [];
    const assignment: (string | null)[] = [];
    const tentative = new Map<string, number>();
    for (let i = 0; i < count; i++) {
      const room = candidates.find(r => {
        const capacity = roomCapacity.get(r) ?? 1;
        const worstCaseUsed = Math.max(...lessons.map(l => roomUsage.get(key(r, day, l)) ?? 0));
        return worstCaseUsed + (tentative.get(r) ?? 0) < capacity;
      });
      if (!room) return null;
      tentative.set(room, (tentative.get(room) ?? 0) + 1);
      assignment.push(room);
    }
    return assignment;
  };

  // Placing a lesson never depends on a teacher already being linked to the
  // class (teacher_classes) - that assignment happens afterwards, by a
  // coordinator, in the "השלמות ותיקונים" tab. A free eligible teacher is
  // used opportunistically when one is available (scored higher), but its
  // absence never blocks building the schedule's subject/time/room skeleton.
  const tryPlace = (unit: Unit, relaxed: boolean): boolean => {
    const teacherOptions = teachersFor.get(key(unit.class_id, unit.subject)) || [];

    type Candidate = { day: number; startIdx: number; teacher: EligibleTeacher | null; room: string | null; score: number };
    let best: Candidate | null = null;

    for (const day of days) {
      const occupiedIdx = classDayPeriodIdx.get(key(unit.class_id, day)) || new Set<number>();
      for (let startIdx = 0; startIdx <= periods.length - unit.blockLen; startIdx++) {
        const idxRange = Array.from({ length: unit.blockLen }, (_, i) => startIdx + i);
        if (idxRange.some(i => occupiedIdx.has(i))) continue;
        const lessons = idxRange.map(i => periods[i]);

        const room = findRoom(unit.preferredRoomType, day, lessons);
        if (unit.preferredRoomType && !room) continue; // a required room type is still a hard constraint

        if (!relaxed) {
          const sameDaySubjectElsewhere = Array.from(classOccupied.values()).some(
            s => s.class_id === unit.class_id && s.day_of_week === day && s.subject === unit.subject
          );
          // Hard constraint (not just a scoring nudge): a subject split into
          // several separate blocks (e.g. 2x1-hour PE) must land on distinct
          // days in the primary pass. A soft penalty here isn't enough - it
          // gets outweighed by the adjacency bonus below whenever a day is
          // otherwise attractive, producing exactly the "PE twice on the same
          // day" clustering this guards against. Only the relaxed fallback
          // may double up, as a last resort.
          if (sameDaySubjectElsewhere) continue;
        }

        let score = 0;
        const adjacentBefore = occupiedIdx.has(startIdx - 1);
        const adjacentAfter = occupiedIdx.has(startIdx + unit.blockLen);
        if (adjacentBefore || adjacentAfter) score += 100;
        // Balance load across the whole week: a day already carrying more of
        // this class's periods is penalized, so lessons spread as evenly as
        // possible across every school day rather than clumping some days
        // and leaving others nearly empty. Quadratic (not linear) so this
        // outgrows the +100 adjacency bonus once a day is moderately full
        // (4 periods -> 128) instead of always losing to it - a linear
        // penalty let "fill the gap in an already-busy day" keep winning over
        // "use the untouched day," snowballing into some days packed solid
        // and others left completely empty.
        score -= occupiedIdx.size * occupiedIdx.size * 8;
        score -= startIdx; // mild preference for earlier periods

        const freeTeacher = teacherOptions.find(teacher =>
          !lessons.some(l => teacherOccupied.has(key(teacher.teacher_id, day, l)) || unavailable.has(key(teacher.teacher_id, day, l)))
        ) || null;
        const candidateScore = freeTeacher ? score + 200 : score; // prefer a slot where a teacher can already be filled in

        if (!best || candidateScore > best.score) {
          best = { day, startIdx, teacher: freeTeacher, room, score: candidateScore };
        }
      }
    }

    if (!best) return false;

    const lessons = Array.from({ length: unit.blockLen }, (_, i) => periods[best!.startIdx + i]);
    for (const lessonNumber of lessons) {
      const slot: GeneratedSlot = {
        class_id: unit.class_id,
        day_of_week: best.day,
        lesson_number: lessonNumber,
        subject: unit.subject,
        teacher_id: best.teacher?.teacher_id || null,
        teacher_name: best.teacher?.teacher_name || null,
        room: best.room,
        group_name: unit.groupName,
      };
      slots.push(slot);
      markOccupied(slot);
    }
    return true;
  };

  // Grade-wide and track-block slots, once placed, must never be moved
  // independently per class (that would break the "same slot for the whole
  // grade" guarantee) - the gap-repair pass below checks this set first.
  const sharedSlotKeys = new Set<string>();

  // Eligible teachers for a subject, pooled across every class in a group
  // (a track/grade-wide teacher isn't tied to one specific home class the
  // way teacher_classes normally implies).
  const teachersForAnyClass = (classIds: string[], subject: string): EligibleTeacher[] => {
    const seen = new Set<string>();
    const result: EligibleTeacher[] = [];
    for (const cid of classIds) {
      for (const t of teachersFor.get(key(cid, subject)) || []) {
        if (seen.has(t.teacher_id)) continue;
        seen.add(t.teacher_id);
        result.push(t);
      }
    }
    return result;
  };

  // A track block is several DIFFERENT subjects (the track options) sharing
  // ONE slot across the whole grade - unlike grade-wide, each class doesn't
  // get the same subject, each attending student picks their own option.
  // Output duplicates every option into every class (matching how the app's
  // read side already looks up a student's own track via group_name), so a
  // block with N classes and M options produces N*blockLen*M slot rows.
  const tryPlaceTrackBlock = (tb: TrackBlockUnit, relaxed: boolean): boolean => {
    type Candidate = {
      day: number;
      startIdx: number;
      teacherByOption: Map<string, EligibleTeacher | null>;
      roomByOption: Map<string, string | null>;
      score: number;
    };
    let best: Candidate | null = null;

    for (const day of days) {
      const occSets = new Map(tb.classIds.map(cid => [cid, classDayPeriodIdx.get(key(cid, day)) || new Set<number>()]));
      for (let startIdx = 0; startIdx <= periods.length - tb.blockLen; startIdx++) {
        const idxRange = Array.from({ length: tb.blockLen }, (_, i) => startIdx + i);
        const allClassesFree = tb.classIds.every(cid => !idxRange.some(i => occSets.get(cid)!.has(i)));
        if (!allClassesFree) continue;
        const lessons = idxRange.map(i => periods[i]);

        // Rooms and teachers are assigned per OPTION (not per class) - every
        // class shares the same physical option/teacher/room for that option.
        const roomByOption = new Map<string, string | null>();
        let roomsOk = true;
        for (const opt of tb.options) {
          if (!opt.preferredRoomType) {
            roomByOption.set(opt.subject, null);
            continue;
          }
          const alreadyUsed = new Set(Array.from(roomByOption.values()).filter((r): r is string => !!r));
          const room = (roomsByType.get(opt.preferredRoomType) || []).find(r =>
            !alreadyUsed.has(r) && lessons.every(l => roomHasCapacity(r, day, l))
          );
          if (!room) {
            roomsOk = false;
            break;
          }
          roomByOption.set(opt.subject, room);
        }
        if (!roomsOk) continue;

        const usedTeachers = new Set<string>();
        const teacherByOption = new Map<string, EligibleTeacher | null>();
        let filledCount = 0;
        for (const opt of tb.options) {
          const options = teachersForAnyClass(tb.classIds, opt.subject);
          const free = options.find(t =>
            !usedTeachers.has(t.teacher_id) &&
            !lessons.some(l => teacherOccupied.has(key(t.teacher_id, day, l)) || unavailable.has(key(t.teacher_id, day, l)))
          ) || null;
          if (free) {
            usedTeachers.add(free.teacher_id);
            filledCount++;
          }
          teacherByOption.set(opt.subject, free);
        }

        let score = 0;
        for (const cid of tb.classIds) {
          const occ = occSets.get(cid)!;
          score -= occ.size * 15;
          if (occ.has(startIdx - 1) || occ.has(startIdx + tb.blockLen)) score += 100 / tb.classIds.length;
        }
        score -= startIdx;
        score += filledCount * 50;
        if (!relaxed) {
          const sameDaySubjectElsewhere = tb.classIds.some(cid =>
            Array.from(classOccupied.values()).some(s => s.class_id === cid && s.day_of_week === day && s.group_name)
          );
          if (sameDaySubjectElsewhere) score -= 30;
        }

        if (!best || score > best.score) {
          best = { day, startIdx, teacherByOption, roomByOption, score };
        }
      }
    }

    if (!best) return false;

    const lessons = Array.from({ length: tb.blockLen }, (_, i) => periods[best!.startIdx + i]);
    for (const cid of tb.classIds) {
      for (const opt of tb.options) {
        const teacher = best.teacherByOption.get(opt.subject) || null;
        const room = best.roomByOption.get(opt.subject) || null;
        for (const lessonNumber of lessons) {
          const slot: GeneratedSlot = {
            class_id: cid,
            day_of_week: best.day,
            lesson_number: lessonNumber,
            subject: opt.subject,
            teacher_id: teacher?.teacher_id || null,
            teacher_name: teacher?.teacher_name || null,
            room,
            group_name: opt.subject,
          };
          slots.push(slot);
          markOccupied(slot);
          sharedSlotKeys.add(key(cid, best.day, lessonNumber));
        }
      }
    }
    return true;
  };

  const tryPlaceGradeWide = (gw: GradeWideUnit, relaxed: boolean): boolean => {
    type Candidate = {
      day: number;
      startIdx: number;
      teacherByClass: Map<string, EligibleTeacher | null>;
      roomByClass: Map<string, string | null>;
      score: number;
    };
    let best: Candidate | null = null;

    for (const day of days) {
      const occSets = new Map(gw.classIds.map(cid => [cid, classDayPeriodIdx.get(key(cid, day)) || new Set<number>()]));
      for (let startIdx = 0; startIdx <= periods.length - gw.blockLen; startIdx++) {
        const idxRange = Array.from({ length: gw.blockLen }, (_, i) => startIdx + i);
        const allClassesFree = gw.classIds.every(cid => !idxRange.some(i => occSets.get(cid)!.has(i)));
        if (!allClassesFree) continue;
        const lessons = idxRange.map(i => periods[i]);

        // Classes sharing this grade-wide slot can share a room too, up to
        // its capacity (e.g. 5 classes of PE together in one gym) - only
        // opens a second room instance if the first one(s) don't have room.
        const roomAssignments = assignRoomsForGroup(gw.preferredRoomType, day, lessons, gw.classIds.length);
        if (!roomAssignments) continue;
        const roomByClass = new Map<string, string | null>();
        gw.classIds.forEach((cid, i) => roomByClass.set(cid, roomAssignments[i]));

        // A distinct teacher per class where possible - never the same
        // teacher for two classes in this simultaneous slot.
        const usedTeachers = new Set<string>();
        const teacherByClass = new Map<string, EligibleTeacher | null>();
        let filledCount = 0;
        for (const cid of gw.classIds) {
          const options = teachersFor.get(key(cid, gw.subject)) || [];
          const free = options.find(t =>
            !usedTeachers.has(t.teacher_id) &&
            !lessons.some(l => teacherOccupied.has(key(t.teacher_id, day, l)) || unavailable.has(key(t.teacher_id, day, l)))
          ) || null;
          if (free) {
            usedTeachers.add(free.teacher_id);
            filledCount++;
          }
          teacherByClass.set(cid, free);
        }

        let score = 0;
        for (const cid of gw.classIds) {
          const occ = occSets.get(cid)!;
          score -= occ.size * 15;
          if (occ.has(startIdx - 1) || occ.has(startIdx + gw.blockLen)) score += 100 / gw.classIds.length;
        }
        score -= startIdx;
        score += filledCount * 50; // prefer slots where more classes already have a teacher filled in
        if (!relaxed) {
          const sameDaySubjectElsewhere = gw.classIds.some(cid =>
            Array.from(classOccupied.values()).some(s => s.class_id === cid && s.day_of_week === day && s.subject === gw.subject)
          );
          if (sameDaySubjectElsewhere) score -= 30;
        }

        if (!best || score > best.score) {
          best = { day, startIdx, teacherByClass, roomByClass, score };
        }
      }
    }

    if (!best) return false;

    const lessons = Array.from({ length: gw.blockLen }, (_, i) => periods[best!.startIdx + i]);
    for (const cid of gw.classIds) {
      const teacher = best.teacherByClass.get(cid) || null;
      const room = best.roomByClass.get(cid) || null;
      for (const lessonNumber of lessons) {
        const slot: GeneratedSlot = {
          class_id: cid,
          day_of_week: best.day,
          lesson_number: lessonNumber,
          subject: gw.subject,
          teacher_id: teacher?.teacher_id || null,
          teacher_name: teacher?.teacher_name || null,
          room,
          group_name: null,
        };
        slots.push(slot);
        markOccupied(slot);
        sharedSlotKeys.add(key(cid, best.day, lessonNumber));
      }
    }
    return true;
  };

  // Track blocks are placed before everything else - they're the most
  // constrained (every class in the grade simultaneously free, PLUS a
  // distinct teacher/room per option) - so grade-wide and per-class units
  // below fill in around them rather than greedily consuming good slots first.
  for (const tb of trackBlockUnits) {
    const placed = tryPlaceTrackBlock(tb, false) || tryPlaceTrackBlock(tb, true);
    if (!placed) {
      conflicts.push({
        class_id: null,
        grade: tb.grade,
        subject: tb.options.map(o => o.subject).join(" / "),
        reason: `לא נמצאה שעה משותפת פנויה לכל כיתות שכבה ${tb.grade}' למגמה "${tb.trackGroup}" (${tb.options.length} אפשרויות)`,
        severity: "error",
      });
    }
  }

  // Grade-wide units are placed next - the most constrained thing left (need
  // every class in the grade simultaneously free), so per-class units below
  // fill in around them rather than greedily consuming the good slots first.
  for (const gw of gradeWideUnits) {
    const placed = tryPlaceGradeWide(gw, false) || tryPlaceGradeWide(gw, true);
    if (!placed) {
      conflicts.push({
        class_id: null,
        grade: gw.grade,
        subject: gw.subject,
        reason: `לא נמצאה שעה משותפת פנויה לכל כיתות שכבה ${gw.grade}' במקצוע ${gw.subject} (מקצוע שכבתי)`,
        severity: "error",
      });
    }
  }

  for (const unit of units) {
    const placed = tryPlace(unit, false) || tryPlace(unit, true);
    if (!placed) {
      const reason = unit.preferredRoomType
        ? `אין ${unit.preferredRoomType} פנוי/ה בשעה מתאימה למקצוע ${unit.subject} בכיתה ${classLabel(unit.class_id)}`
        : `לא נמצאה שעה פנויה למקצוע ${unit.subject} בכיתה ${classLabel(unit.class_id)}`;
      conflicts.push({ class_id: unit.class_id, grade: unit.grade, subject: unit.subject, reason, severity: "error" });
    }
  }

  // 4. Gap-repair pass, per class per day.
  for (const cls of classes) {
    for (const day of days) {
      repairGapsForClassDay(cls, day);
    }
  }

  function repairGapsForClassDay(cls: GeneratorClass, day: number) {
    const dayKey = key(cls.id, day);
    let occupiedIdx = classDayPeriodIdx.get(dayKey);
    if (!occupiedIdx || occupiedIdx.size < 2) return;

    let attempts = 0;
    while (attempts < periods.length) {
      attempts++;
      occupiedIdx = classDayPeriodIdx.get(dayKey);
      if (!occupiedIdx || occupiedIdx.size < 2) break;
      const sorted = Array.from(occupiedIdx).sort((a, b) => a - b);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const holeIdx = Array.from({ length: last - first + 1 }, (_, i) => first + i).find(i => !occupiedIdx!.has(i));
      if (holeIdx === undefined) break;

      // Find a later lesson on this class-day that can move into the hole.
      const laterIdx = sorted.filter(i => i > holeIdx).sort((a, b) => a - b);
      let moved = false;
      for (const fromIdx of laterIdx) {
        const fromLesson = periods[fromIdx];
        const slot = classOccupied.get(key(cls.id, day, fromLesson));
        if (!slot) continue;
        if (sharedSlotKeys.has(key(cls.id, day, fromLesson))) continue; // never relocate a grade-wide slot on its own
        const toLesson = periods[holeIdx];

        const teacherFree = !slot.teacher_id || !teacherOccupied.has(key(slot.teacher_id, day, toLesson));
        const roomFree = !slot.room || roomHasCapacity(slot.room, day, toLesson);
        const targetFree = !classOccupied.has(key(cls.id, day, toLesson));
        if (!teacherFree || !roomFree || !targetFree) continue;

        unmarkOccupied(slot);
        slot.lesson_number = toLesson;
        markOccupied(slot);
        moved = true;
        break;
      }
      if (!moved) break;
    }

    occupiedIdx = classDayPeriodIdx.get(dayKey);
    if (!occupiedIdx || occupiedIdx.size < 2) return;
    const sorted = Array.from(occupiedIdx).sort((a, b) => a - b);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const remainingHoles = Array.from({ length: last - first + 1 }, (_, i) => first + i).filter(i => !occupiedIdx!.has(i));
    if (remainingHoles.length === 0) return;

    const isMiddleSchool = MIDDLE_SCHOOL_GRADES.includes(cls.grade);
    conflicts.push({
      class_id: cls.id,
      grade: cls.grade,
      subject: "-",
      reason: isMiddleSchool
        ? `נותר חלון בלוח הזמנים של כיתה ${cls.grade}'${cls.class_number} ביום ${day} — נדרש טיפול ידני`
        : `קיים חלון בלוח הזמנים של כיתה ${cls.grade}'${cls.class_number} ביום ${day} (ייתכן שבלתי נמנע עקב מקצועות בחירה)`,
      severity: isMiddleSchool ? "error" : "warning",
    });
  }

  return { slots, conflicts };
}
