import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Attendance is entered per lesson: one `lessons` row per class + date + lesson
// number (the period in the bell schedule). A row only exists once the roll
// call was saved, so its existence means "attendance entered" and its topic
// means "lesson details entered".

export type LessonReportStatus = "done" | "no_topic" | "missing";

export interface LessonRef {
  classId: string;
  date: string; // YYYY-MM-DD, local day
  lesson: number;
  subject?: string;
}

/** Local YYYY-MM-DD (toISOString would give yesterday between midnight and 02:00/03:00). */
export const localIsoDate = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Link to the roll call of one specific lesson. */
export function rollCallUrl({ classId, date, lesson, subject }: LessonRef): string {
  const q = new URLSearchParams({ class: classId, date, lesson: String(lesson) });
  if (subject) q.set("subject", subject);
  return `/dashboard/roll-call?${q}`;
}

const key = (classId: string, date: string, lesson: number) => `${classId}|${date}|${lesson}`;

export const REPORT_STYLE: Record<LessonReportStatus, { label: string; short: string; bg: string; ink: string; dot: string }> = {
  done: { label: "נוכחות ופרטי שיעור הוזנו", short: "הוזן", bg: "#E3F6EC", ink: "#11734A", dot: "#23B26D" },
  no_topic: { label: "הוזנה נוכחות, חסר נושא שיעור", short: "חסר נושא", bg: "#FFF0C2", ink: "#7A5200", dot: "#F2A007" },
  missing: { label: "לא הוזנה נוכחות", short: "לא הוזן", bg: "#FFE1D6", ink: "#A8320F", dot: "#E5484D" },
};

/** Which of a teacher's lessons between two dates already have attendance / a topic. */
export function useLessonReports(teacherId: string | null | undefined, from: string, to: string) {
  const [reports, setReports] = useState<Map<string, { id: string; topic: string | null }>>(new Map());

  const load = useCallback(async () => {
    if (!teacherId) return;
    const { data } = await supabase.from("lessons")
      .select("id, class_id, lesson_date, lesson_number, topic")
      .eq("teacher_id", teacherId)
      .gte("lesson_date", from)
      .lte("lesson_date", to);
    setReports(new Map((data || []).map((l) => [key(l.class_id, l.lesson_date, l.lesson_number), { id: l.id, topic: l.topic }])));
  }, [teacherId, from, to]);

  useEffect(() => { load(); }, [load]);

  /** Status of a lesson that already started (future lessons have none). */
  const statusOf = useCallback((classId: string | null | undefined, date: string, lesson: number): LessonReportStatus => {
    const r = classId ? reports.get(key(classId, date, lesson)) : undefined;
    if (!r) return "missing";
    return r.topic?.trim() ? "done" : "no_topic";
  }, [reports]);

  return { statusOf, reload: load };
}
