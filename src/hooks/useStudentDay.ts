import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BellSlot {
  lesson_number: number;
  start_time: string;
  end_time: string;
}

export interface TimetableSlot {
  subject: string;
  teacher_name: string | null;
  room: string | null;
  group_name: string | null;
  color: string | null;
  lesson_number: number;
  day_of_week: number;
}

export interface DayLesson extends TimetableSlot {
  bellStart: string;
  bellEnd: string;
}

export type DayPhase = "before" | "lesson" | "break" | "after" | "no-school";

/** "יא" -> "י״א", "י" -> "י׳" (Hebrew numeral punctuation). */
export const formatGrade = (grade: string) =>
  grade.length === 1 ? `${grade}׳` : `${grade.slice(0, -1)}״${grade.slice(-1)}`;

/** "י״א-3" */
export const formatClassName = (grade: string, classNumber?: number | null) =>
  classNumber ? `${formatGrade(grade)}-${classNumber}` : formatGrade(grade);

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const minutesUntil = (from: Date, time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m - (from.getHours() * 60 + from.getMinutes());
};

/**
 * A student's school day: the bell schedule, their own lessons for any weekday
 * (track/group slots resolved to the student's tracks), and where "now" falls.
 * `studentId` defaults to the signed-in user; parents pass their child's id.
 */
export function useStudentDay(schoolId: string | null, studentId: string | null) {
  const [bell, setBell] = useState<BellSlot[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!schoolId || !studentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [bellRes, tracksRes, profileRes] = await Promise.all([
        supabase
          .from("bell_schedule")
          .select("lesson_number, start_time, end_time, is_break")
          .eq("school_id", schoolId)
          .order("lesson_number"),
        supabase.from("student_tracks").select("track_name").eq("user_id", studentId),
        supabase.from("profiles").select("class_id, classes(grade, class_number)").eq("id", studentId).single(),
      ]);
      if (cancelled) return;
      setBell(
        (bellRes.data || [])
          .filter((b: any) => !b.is_break)
          .map((b: any) => ({ lesson_number: b.lesson_number, start_time: b.start_time?.slice(0, 5), end_time: b.end_time?.slice(0, 5) }))
      );
      setTracks((tracksRes.data || []).map((t: any) => t.track_name));
      const classId = (profileRes.data as any)?.class_id;
      const cls = (profileRes.data as any)?.classes;
      if (cls?.grade) setClassName(formatClassName(cls.grade, cls.class_number));
      if (classId) {
        const { data } = await supabase
          .from("timetable_slots")
          .select("subject, teacher_name, room, group_name, color, lesson_number, day_of_week")
          .eq("school_id", schoolId)
          .eq("class_id", classId);
        if (!cancelled) setSlots(data || []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [schoolId, studentId]);

  // group_name is the plain option/level subject string (see tryPlaceTrackBlock
  // in timetableGenerator.ts), so a track slot matches on track_name alone.
  const pickSlot = useCallback(
    (candidates: TimetableSlot[]) => {
      if (candidates.length === 0) return undefined;
      const match = candidates.find((s) => s.group_name && tracks.includes(s.group_name));
      return match || candidates.find((s) => !s.group_name);
    },
    [tracks]
  );

  /** The student's lessons on a weekday (0 = Sunday), in bell order. */
  const lessonsForDay = useCallback(
    (day: number): DayLesson[] =>
      bell
        .map((b) => {
          const slot = pickSlot(slots.filter((s) => s.day_of_week === day && s.lesson_number === b.lesson_number));
          return slot ? { ...slot, bellStart: b.start_time, bellEnd: b.end_time } : null;
        })
        .filter((l): l is DayLesson => !!l),
    [bell, slots, pickSlot]
  );

  const today = useMemo(() => lessonsForDay(now.getDay()), [lessonsForDay, now]);

  const status = useMemo(() => {
    const t = hhmm(now);
    if (now.getDay() > 4 || today.length === 0) return { phase: "no-school" as DayPhase, current: null, next: null, minutesLeft: 0 };
    const current = today.find((l) => t >= l.bellStart && t < l.bellEnd) || null;
    const next = today.find((l) => l.bellStart > t) || null;
    const phase: DayPhase = current ? "lesson" : t < today[0].bellStart ? "before" : next ? "break" : "after";
    const minutesLeft = current ? minutesUntil(now, current.bellEnd) : next ? minutesUntil(now, next.bellStart) : 0;
    return { phase, current, next, minutesLeft };
  }, [today, now]);

  return { loading, now, bell, className, today, lessonsForDay, ...status };
}
