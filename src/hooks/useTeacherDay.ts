import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatClassName, type BellSlot } from "@/hooks/useStudentDay";

export interface TeacherLesson {
  subject: string;
  room: string | null;
  lesson_number: number;
  className: string | null;
  classId: string | null;
  bellStart: string;
  bellEnd: string;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const minutesUntil = (from: Date, time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m - (from.getHours() * 60 + from.getMinutes());
};

/** A teacher's lessons today (their own timetable_slots rows) and where "now" falls. */
export function useTeacherDay(schoolId: string | null, teacherId: string) {
  const [bell, setBell] = useState<BellSlot[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const day = now.getDay();
  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    Promise.all([
      supabase.from("bell_schedule").select("lesson_number, start_time, end_time, is_break").eq("school_id", schoolId).order("lesson_number"),
      supabase.from("timetable_slots")
        .select("subject, room, lesson_number, class_id, classes(grade, class_number)")
        .eq("school_id", schoolId)
        .eq("teacher_id", teacherId)
        .eq("day_of_week", day),
    ]).then(([b, s]) => {
      if (cancelled) return;
      setBell((b.data || []).filter((x: any) => !x.is_break).map((x: any) => ({ lesson_number: x.lesson_number, start_time: x.start_time?.slice(0, 5), end_time: x.end_time?.slice(0, 5) })));
      setRows(s.data || []);
    });
    return () => { cancelled = true; };
  }, [schoolId, teacherId, day]);

  const today = useMemo<TeacherLesson[]>(() =>
    rows
      .map((r) => {
        const b = bell.find((x) => x.lesson_number === r.lesson_number);
        if (!b) return null;
        const cls = Array.isArray(r.classes) ? r.classes[0] : r.classes;
        return {
          subject: r.subject, room: r.room, lesson_number: r.lesson_number, classId: r.class_id,
          className: cls?.grade ? formatClassName(cls.grade, cls.class_number) : null,
          bellStart: b.start_time, bellEnd: b.end_time,
        };
      })
      .filter((l): l is TeacherLesson => !!l)
      .sort((a, b) => a.bellStart.localeCompare(b.bellStart)),
  [rows, bell]);

  const t = hhmm(now);
  const current = today.find((l) => t >= l.bellStart && t < l.bellEnd) || null;
  const upcoming = today.filter((l) => l.bellStart > t);
  return {
    now,
    today,
    current,
    upcoming,
    minutesLeft: current ? minutesUntil(now, current.bellEnd) : 0,
  };
}
