import { useOutletContext, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { SubjectFolder, type FolderChip } from "@/components/SubjectFolder";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useStudentSubjects } from "@/hooks/useStudentSubjects";

interface TimetableSubject {
  subject: string;
  teacher: string | null;
}

const SubjectHubsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { subjects: studentSubjects } = useStudentSubjects(profile.id, profile.schoolId);
  const [timetableSubjects, setTimetableSubjects] = useState<TimetableSubject[]>([]);
  const [currentSubject, setCurrentSubject] = useState<string | null>(null);

  // Per subject: open (unsubmitted, not yet due) tasks and the student's average.
  const [openTasks, setOpenTasks] = useState<Record<string, number>>({});
  const [averages, setAverages] = useState<Record<string, number>>({});

  // Fetch subjects from timetable
  useEffect(() => {
    if (!profile.schoolId || !profile.id) return;
    const load = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("class_id")
        .eq("id", profile.id)
        .single();
      if (!p?.class_id) return;

      const { data: slots } = await supabase
        .from("timetable_slots")
        .select("subject, teacher_name")
        .eq("school_id", profile.schoolId!)
        .eq("class_id", p.class_id);

      if (slots) {
        const uniqueMap = new Map<string, string | null>();
        slots.forEach((s) => {
          if (!uniqueMap.get(s.subject)) uniqueMap.set(s.subject, s.teacher_name);
        });
        setTimetableSubjects(
          Array.from(uniqueMap.entries()).map(([subject, teacher]) => ({ subject, teacher }))
        );
      }

      const [{ data: tasks }, { data: subs }] = await Promise.all([
        supabase.from("assignments").select("id, subject, due_date").eq("class_id", p.class_id).eq("published", true)
          .gte("due_date", new Date().toISOString()),
        supabase.from("submissions").select("assignment_id, grade, status, assignments(subject, max_grade)").eq("student_id", profile.id),
      ]);
      const done = new Set((subs || []).filter((x) => x.status !== "draft").map((x) => x.assignment_id));
      const open: Record<string, number> = {};
      (tasks || []).forEach((t) => { if (!done.has(t.id)) open[t.subject] = (open[t.subject] || 0) + 1; });
      setOpenTasks(open);
      const sums: Record<string, [number, number]> = {};
      (subs || []).forEach((x: any) => {
        const a = Array.isArray(x.assignments) ? x.assignments[0] : x.assignments;
        if (x.grade == null || !a?.subject) return;
        const cur = sums[a.subject] || [0, 0];
        sums[a.subject] = [cur[0] + (x.grade / (a.max_grade || 100)) * 100, cur[1] + 1];
      });
      setAverages(Object.fromEntries(Object.entries(sums).map(([k, [t, n]]) => [k, Math.round(t / n)])));
    };
    load();
  }, [profile.id, profile.schoolId]);

  // Check current lesson
  useEffect(() => {
    if (!profile.schoolId || !profile.id) return;
    const load = async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("class_id")
        .eq("id", profile.id)
        .single();
      if (!p?.class_id) return;

      const { data: bells } = await supabase
        .from("bell_schedule")
        .select("lesson_number, start_time, end_time, is_break")
        .eq("school_id", profile.schoolId!)
        .order("lesson_number");

      if (!bells) return;

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const dayOfWeek = now.getDay();
      if (dayOfWeek > 4) return;

      const currentBell = bells.find(
        (b: any) => !b.is_break && currentTime >= b.start_time?.slice(0, 5) && currentTime <= b.end_time?.slice(0, 5)
      );
      if (!currentBell) return;

      const { data: slots } = await supabase
        .from("timetable_slots")
        .select("subject, group_name")
        .eq("school_id", profile.schoolId!)
        .eq("class_id", p.class_id)
        .eq("day_of_week", dayOfWeek)
        .eq("lesson_number", currentBell.lesson_number);

      if (slots && slots.length > 0) {
        // Pick the right slot (simplified - first non-group or matching group)
        const slot = slots.find((s: any) => !s.group_name) || slots[0];
        if (slot) setCurrentSubject(slot.subject);
      }
    };
    load();
  }, [profile.id, profile.schoolId]);

  // Show only the student's personal subjects, with teachers from the timetable
  const subjects = useMemo(() => {
    const teacherMap = new Map(timetableSubjects.map(ts => [ts.subject, ts.teacher]));
    return studentSubjects.map(s => ({
      name: s,
      teacher: teacherMap.get(s) || null,
      isLive: s === currentSubject,
    }));
  }, [timetableSubjects, studentSubjects, currentSubject]);

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading font-black text-[26px] md:text-[30px] leading-none">המקצועות שלי</h1>
        <p className="font-body font-semibold text-[13px] md:text-sm leading-snug text-muted-foreground">לחצ/י על תיקייה לחומרים, משימות, ציונים וצ׳אט</p>
      </div>

      {subjects.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-[22px] border-2 border-dashed border-input">
          <p className="font-heading font-bold text-muted-foreground">אין מקצועות במערכת עדיין</p>
          <p className="font-body text-sm text-muted-foreground mt-1">המקצועות יופיעו כאן ברגע שמערכת השעות שלך תוזן</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-5 md:gap-x-[18px] md:gap-y-[30px] pt-3">
          {subjects.map((subject, i) => {
            const open = openTasks[subject.name] || 0;
            const avg = averages[subject.name];
            const chips: FolderChip[] = [
              ...(open ? [{ text: `${open} משימות פתוחות`, tone: "info" as const }] : []),
              ...(avg != null ? [{ text: `ממוצע ${avg}`, tone: "neutral" as const }] : []),
            ];
            return (
              <SubjectFolder
                key={subject.name}
                index={i}
                subject={subject.name}
                subtitle={subject.teacher || undefined}
                chips={chips}
                live={subject.isLive}
                onOpen={() => navigate(`/dashboard/subjects/${encodeURIComponent(subject.name)}${subject.isLive ? "?tab=live" : ""}`)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubjectHubsPage;
