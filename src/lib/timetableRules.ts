import type { TimetableRules } from "@/lib/timetableGenerator";

/** School rules as stored in school_timetable_settings.rules (jsonb). */
export interface SchoolTimetableRules {
  shortDays?: Record<string, number>;
  subjectEarliest?: Record<string, number>;
  subjectLatest?: Record<string, number>;
  morningSubjects?: string[];
}

interface ConstraintRow {
  teacher_id: string;
  constraint_type: string;
  is_hard: boolean;
  max_value: number | null;
}

const numMap = <K extends string | number>(obj: Record<string, number> | undefined, keyOf: (k: string) => K) =>
  new Map(Object.entries(obj || {}).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [keyOf(k), Number(v)]));

/** Builds the generator's rules from the school rules and the approved, hard teacher constraints. */
export function buildTimetableRules(school: SchoolTimetableRules | null | undefined, constraints: ConstraintRow[]): TimetableRules {
  const teacherMaxDaily = new Map<string, number>();
  const teacherNoEdge = new Set<string>();
  for (const c of constraints) {
    if (!c.is_hard) continue;
    if (c.constraint_type === "max_daily_hours" && c.max_value) {
      const prev = teacherMaxDaily.get(c.teacher_id);
      teacherMaxDaily.set(c.teacher_id, prev === undefined ? c.max_value : Math.min(prev, c.max_value));
    }
    if (c.constraint_type === "no_edge_lesson") teacherNoEdge.add(c.teacher_id);
  }
  return {
    teacherMaxDaily,
    teacherNoEdge,
    dayLastPeriod: numMap(school?.shortDays, Number),
    subjectEarliestPeriod: numMap(school?.subjectEarliest, String),
    subjectLatestPeriod: numMap(school?.subjectLatest, String),
    morningSubjects: new Set(school?.morningSubjects || []),
  };
}
