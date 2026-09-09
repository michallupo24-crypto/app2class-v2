import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface ClassLessonPace {
  weeklyHours: number;
  expectedLessons: number;
  actualLessons: number;
  deficit: number;
}

export interface GradeLessonPaceRow {
  classId: string;
  classNumber: number;
  subject: string;
  weeklyHours: number;
  expectedLessons: number;
  actualLessons: number;
  deficit: number;
}

/** A class is meaningfully "behind" once it's missed this many lessons vs. the calendar-projected expectation. */
export const LESSON_DEFICIT_ALERT_THRESHOLD = 4;

export async function fetchClassLessonPace(classId: string, subject: string): Promise<ClassLessonPace | null> {
  const { data, error } = await supabase.rpc("get_class_lesson_pace", { p_class_id: classId, p_subject: subject });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    weeklyHours: row.weekly_hours,
    expectedLessons: row.expected_lessons,
    actualLessons: row.actual_lessons,
    deficit: row.deficit,
  };
}

export async function fetchGradeLessonPace(
  grade: Database["public"]["Enums"]["grade_level"],
  subject?: string
): Promise<GradeLessonPaceRow[]> {
  const { data, error } = await supabase.rpc("get_grade_lesson_pace", { p_grade: grade, p_subject: subject });
  if (error || !data) return [];
  return data.map((row) => ({
    classId: row.class_id,
    classNumber: row.class_number,
    subject: row.subject,
    weeklyHours: row.weekly_hours,
    expectedLessons: row.expected_lessons,
    actualLessons: row.actual_lessons,
    deficit: row.deficit,
  }));
}
