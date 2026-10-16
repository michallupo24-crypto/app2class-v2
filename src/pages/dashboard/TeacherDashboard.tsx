import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Users,
  BookOpen,
  ClipboardList,
  FileText,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Lock,
  CalendarCheck2,
  UserCheck,
  HandHelping,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import SyllabusProgressTracker from "@/components/dashboard/SyllabusProgressTracker";
import ClassMessenger from "@/components/dashboard/ClassMessenger";
import type { UserProfile } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchGradeLessonPace, type GradeLessonPaceRow } from "@/lib/lessonPace";
import { useTeacherDay } from "@/hooks/useTeacherDay";
import { formatClassName } from "@/hooks/useStudentDay";
import { SubjectTile, subjectColor } from "@/components/SubjectSticker";
import {
  HomeHeader, HeroCard, HomeSection, HomeColumns, StatTiles, BarList, HomeRow, HomeEmpty, PillSwitch, IconTile, PersonBadge, RowTag,
  greeting, longHebrewDate, firstName, type Tone,
} from "@/components/home/HomeKit";

// Hero background: the subject color, a little darker so white text reads.
const shadeHex = (h: string, f = 0.84) =>
  "#" + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("");

interface TeacherStats {
  totalStudents: number;
  classCount: number;
  pendingSubmissions: number;
  todayLessons: number;
}

interface MissingSubmissionsInfo {
  assignmentId: string;
  assignmentTitle: string;
  className: string;
  students: { id: string; fullName: string }[];
}

const TeacherDashboard = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<TeacherStats>({ totalStudents: 0, classCount: 0, pendingSubmissions: 0, todayLessons: 0 });
  const [myClasses, setMyClasses] = useState<{id: string, name: string}[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [coordinatorSubject, setCoordinatorSubject] = useState<string>("");
  const [missingWeightsCount, setMissingWeightsCount] = useState(0);
  const [materialGapExams, setMaterialGapExams] = useState<{ id: string; title: string; dueDate: string }[]>([]);
  const [hasSkippedRollcall, setHasSkippedRollcall] = useState(false);
  const [weeklyAttendance, setWeeklyAttendance] = useState<{ day: string; present: number; absent: number; late: number }[]>([]);
  const [attendanceWatchList, setAttendanceWatchList] = useState<{ name: string; absences: number }[]>([]);
  const [missingSubmissions, setMissingSubmissions] = useState<MissingSubmissionsInfo | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [homeroomClassId, setHomeroomClassId] = useState<string | null>(null);
  const [lessonPaceRows, setLessonPaceRows] = useState<GradeLessonPaceRow[]>([]);
  const [showTutoringDialog, setShowTutoringDialog] = useState(false);
  const [tutoringSubject, setTutoringSubject] = useState("");
  const [tutoringReason, setTutoringReason] = useState("");
  const [submittingTutoringRequest, setSubmittingTutoringRequest] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [disciplinePatterns, setDisciplinePatterns] = useState<{ studentName: string; subject: string; count: number; total: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const [classesRes, submissionsRes] = await Promise.all([
        supabase.from("teacher_classes")
          .select("class_id, classes(grade, class_number)")
          .eq("user_id", profile.id),
        supabase.from("submissions").select("id", { count: "exact", head: true })
          .eq("status", "submitted"),
      ]);

      const classesData = (classesRes.data || []).map((c: any) => ({
        id: c.class_id,
        name: c.classes?.grade ? formatClassName(c.classes.grade, c.classes.class_number) : "כיתה"
      }));
      setMyClasses(classesData);
      if (classesData.length > 0) setSelectedClassId(classesData[0].id);

      const classIds = classesData.map(c => c.id);
      let studentCount = 0;
      if (classIds.length > 0) {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true })
          .in("class_id", classIds);
        studentCount = count || 0;
      }

      // ─── Missing Submissions for Most Recent Assignment ───
      setReminderSent(false);
      if (classIds.length > 0) {
        const { data: latestAssignment } = await supabase.from("assignments")
          .select("id, title, class_id, classes(grade, class_number)")
          .in("class_id", classIds)
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestAssignment) {
          const [{ data: classStudents }, { data: subs }] = await Promise.all([
            supabase.from("profiles").select("id, full_name").eq("class_id", latestAssignment.class_id),
            supabase.from("submissions").select("student_id, status").eq("assignment_id", latestAssignment.id),
          ]);
          const submittedIds = new Set(
            (subs || []).filter((s: any) => ["submitted", "graded", "revised"].includes(s.status)).map((s: any) => s.student_id)
          );
          const missing = (classStudents || []).filter((s: any) => !submittedIds.has(s.id));
          const cls = Array.isArray(latestAssignment.classes) ? latestAssignment.classes[0] : latestAssignment.classes;
          setMissingSubmissions({
            assignmentId: latestAssignment.id,
            assignmentTitle: latestAssignment.title,
            className: cls ? `${cls.grade}'${cls.class_number}` : "",
            students: missing.map((s: any) => ({ id: s.id, fullName: s.full_name })),
          });
        } else {
          setMissingSubmissions(null);
        }
      } else {
        setMissingSubmissions(null);
      }

      const { count: todayLessonsRecorded } = await supabase.from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", profile.id)
        .gte("lesson_date", new Date().toISOString().split("T")[0]);

      setStats({
        totalStudents: studentCount,
        classCount: classIds.length,
        pendingSubmissions: submissionsRes.count || 0,
        todayLessons: todayLessonsRecorded || 0,
      });

      if (profile.roles?.includes("subject_coordinator")) {
        let mySubject = coordinatorSubject;
        if (!mySubject) {
          const { data: myRole } = await supabase.from("user_roles")
            .select("subject").eq("user_id", profile.id).eq("role", "subject_coordinator" as any).maybeSingle();
          mySubject = myRole?.subject || "";
          setCoordinatorSubject(mySubject);
        }
        if (mySubject) {
          const { count: missing } = await supabase.from("grade_events")
            .select("id", { count: "exact", head: true })
            .eq("event_type", "exam")
            .eq("subject", mySubject)
            .is("weight", null);
          setMissingWeightsCount(missing || 0);

          // Exams (not quizzes) due within a week that still have no material
          // attached - reminder for the subject coordinator to follow up with
          // the teacher.
          const weekOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: gapExams } = await supabase.from("assignments")
            .select("id, title, due_date, description")
            .eq("subject", mySubject)
            .eq("published", true)
            .ilike("title", "%מבחן%")
            .not("title", "ilike", "%בוחן%")
            .not("due_date", "is", null)
            .gt("due_date", new Date().toISOString())
            .lte("due_date", weekOut);
          setMaterialGapExams(
            (gapExams || [])
              .filter((a: any) => !a.description || !a.description.trim())
              .map((a: any) => ({ id: a.id, title: a.title, dueDate: a.due_date }))
          );
          // Push a real (deduplicated) notification too, not just the dashboard card.
          (supabase as any).rpc("check_missing_exam_material").then(() => {});
        }
      }

      // ─── Skipped Roll Call Heuristic ───
      const today = new Date().getDay();
      const { data: slots } = await supabase.from("timetable_slots")
        .select("lesson_number")
        .eq("teacher_id", profile.id)
        .eq("day_of_week", today);

      if (slots && slots.length > 0) {
        // Teacher has lessons today. If it's past noon and none were reported yet, nudge them.
        if (!todayLessonsRecorded && new Date().getHours() >= 12) {
          setHasSkippedRollcall(true);
        }
      }

      // ─── Weekly Attendance Cockpit (homeroom educator only) ───
      const { data: myRoles } = await supabase.from("user_roles")
        .select("homeroom_class_id").eq("user_id", profile.id).eq("role", "educator" as any)
        .not("homeroom_class_id", "is", null).limit(1);
      const homeroomClassId = myRoles?.[0]?.homeroom_class_id;

      if (homeroomClassId) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString().split("T")[0];
        const todayStr = now.toISOString().split("T")[0];

        const { data: weekLessons } = await supabase.from("lessons")
          .select("id, lesson_date").eq("class_id", homeroomClassId)
          .gte("lesson_date", weekStartStr).lte("lesson_date", todayStr);
        const lessonIds = (weekLessons || []).map((l: any) => l.id);
        const lessonDateMap: Record<string, string> = {};
        (weekLessons || []).forEach((l: any) => { lessonDateMap[l.id] = l.lesson_date; });

        if (lessonIds.length > 0) {
          const { data: weekAtt } = await supabase.from("attendance")
            .select("lesson_id, student_id, status").in("lesson_id", lessonIds);
          const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
          const byDay: Record<string, { present: number; absent: number; late: number }> = {};
          const absenceCountByStudent: Record<string, number> = {};
          (weekAtt || []).forEach((a: any) => {
            const date = lessonDateMap[a.lesson_id];
            const dow = new Date(`${date}T12:00:00`).getDay();
            const label = dayNames[dow];
            if (!byDay[label]) byDay[label] = { present: 0, absent: 0, late: 0 };
            if (a.status === "present") byDay[label].present++;
            else if (a.status === "absent") {
              byDay[label].absent++;
              absenceCountByStudent[a.student_id] = (absenceCountByStudent[a.student_id] || 0) + 1;
            } else if (a.status === "late") byDay[label].late++;
          });
          const orderedDays = [0, 1, 2, 3, 4].map((d) => dayNames[d]).filter((d) => byDay[d]);
          setWeeklyAttendance(orderedDays.map((d) => ({ day: d, ...byDay[d] })));

          const watchIds = Object.entries(absenceCountByStudent).filter(([, c]) => c >= 2).map(([id]) => id);
          if (watchIds.length > 0) {
            const { data: watchProfiles } = await supabase.from("profiles").select("id, full_name").in("id", watchIds);
            setAttendanceWatchList((watchProfiles || []).map((p: any) => ({ name: p.full_name, absences: absenceCountByStudent[p.id] })));
          } else {
            setAttendanceWatchList([]);
          }
        }

        // ─── Discipline Pattern Detection ───
        const { data: classStudents } = await supabase.from("profiles").select("id, full_name").eq("class_id", homeroomClassId);
        const studentIds = (classStudents || []).map((s: any) => s.id);
        const nameMap: Record<string, string> = {};
        (classStudents || []).forEach((s: any) => { nameMap[s.id] = s.full_name; });

        if (studentIds.length > 0) {
          const { data: notes } = await supabase.from("lesson_notes")
            .select("student_id, category, lessons(subject)")
            .in("student_id", studentIds)
            .in("category", ["disruption", "phone", "no_homework", "disrespect", "no_equipment"] as any);

          const bySubjectByStudent: Record<string, Record<string, number>> = {};
          const totalByStudent: Record<string, number> = {};
          (notes || []).forEach((n: any) => {
            const subj = Array.isArray(n.lessons) ? n.lessons[0]?.subject : n.lessons?.subject;
            if (!subj) return;
            bySubjectByStudent[n.student_id] = bySubjectByStudent[n.student_id] || {};
            bySubjectByStudent[n.student_id][subj] = (bySubjectByStudent[n.student_id][subj] || 0) + 1;
            totalByStudent[n.student_id] = (totalByStudent[n.student_id] || 0) + 1;
          });

          const patterns: { studentName: string; subject: string; count: number; total: number }[] = [];
          Object.entries(bySubjectByStudent).forEach(([sid, subjMap]) => {
            const total = totalByStudent[sid];
            if (total < 2) return;
            const [topSubject, topCount] = Object.entries(subjMap).sort((a, b) => b[1] - a[1])[0];
            if (topCount / total >= 0.7) {
              patterns.push({ studentName: nameMap[sid] || "תלמיד/ה", subject: topSubject, count: topCount, total });
            }
          });
          setDisciplinePatterns(patterns);
        }
      }
    };
    load();
  }, [profile.id, coordinatorSubject]);

  // Lesson pace: how this homeroom class's actual lesson count compares to
  // the calendar-projected expectation, per subject, plus the grade average
  // for context - so a homeroom teacher can see it without having to ask a
  // coordinator.
  useEffect(() => {
    const loadPace = async () => {
      const { data: myRoles } = await supabase.from("user_roles")
        .select("homeroom_class_id").eq("user_id", profile.id).eq("role", "educator" as any)
        .not("homeroom_class_id", "is", null).limit(1);
      const classId = myRoles?.[0]?.homeroom_class_id;
      if (!classId) return;
      setHomeroomClassId(classId);
      const { data: cls } = await supabase.from("classes").select("grade").eq("id", classId).single();
      if (!cls?.grade) return;
      const rows = await fetchGradeLessonPace(cls.grade as any);
      setLessonPaceRows(rows);
    };
    loadPace();
  }, [profile.id]);

  const myClassPace = lessonPaceRows
    .filter(r => r.classId === homeroomClassId)
    .sort((a, b) => b.deficit - a.deficit);

  const gradeAvgDeficitBySubject = (() => {
    const totals = new Map<string, { sum: number; count: number }>();
    lessonPaceRows.forEach(r => {
      const entry = totals.get(r.subject) || { sum: 0, count: 0 };
      entry.sum += r.deficit;
      entry.count += 1;
      totals.set(r.subject, entry);
    });
    return new Map(Array.from(totals.entries()).map(([subject, { sum, count }]) => [subject, Math.round(sum / count)]));
  })();

  const submitTutoringRequest = async () => {
    if (!homeroomClassId || !tutoringSubject) return;
    setSubmittingTutoringRequest(true);
    try {
      const { error } = await supabase.from("tutoring_requests").insert({
        school_id: profile.schoolId!,
        class_id: homeroomClassId,
        subject: tutoringSubject,
        requested_by: profile.id,
        reason: tutoringReason.trim() || null,
      });
      if (error) throw error;
      toast({ title: "בקשת התגבור נשלחה לרכזים" });
      setShowTutoringDialog(false);
      setTutoringReason("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "שגיאה בשליחת הבקשה", description: e.message });
    } finally {
      setSubmittingTutoringRequest(false);
    }
  };

  const handleSendReminder = async () => {
    if (!missingSubmissions || missingSubmissions.students.length === 0) return;
    setSendingReminder(true);
    try {
      const { error } = await supabase.rpc("send_submission_reminders", {
        p_assignment_id: missingSubmissions.assignmentId,
      });
      if (error) throw error;
      setReminderSent(true);
      toast({
        title: "התזכורת נשלחה",
        description: `נשלחה תזכורת ל-${missingSubmissions.students.length} תלמידים והוריהם`,
      });
    } catch {
      toast({ title: "שגיאה בשליחת התזכורת", description: "נסה/י שוב מאוחר יותר", variant: "destructive" });
    } finally {
      setSendingReminder(false);
    }
  };

  const day = useTeacherDay(profile.schoolId, profile.id);
  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const todayAttendance = weeklyAttendance.find((d) => d.day === dayNames[new Date().getDay()]);
  const homeroomName = myClasses.find((c) => c.id === homeroomClassId)?.name;
  const roomText = (room: string | null) => (room ? (/^\d/.test(room) ? `חדר ${room}` : room) : null);

  // What matters right now: the lesson being taught, the homeroom's day, or the next lesson.
  let heroIsNextLesson = false;
  const hero = (() => {
    if (day.current) {
      const l = day.current;
      return {
        color: shadeHex(subjectColor(l.subject)), subject: l.subject, tag: `עכשיו · שיעור ${l.lesson_number}`,
        title: [l.subject, l.className].filter(Boolean).join(" · "),
        meta: [roomText(l.room), `${day.minutesLeft} דק׳ נותרו`].filter(Boolean).join(" · "),
        action: { label: "להזנת נוכחות", onClick: () => navigate("/dashboard/roll-call") },
      };
    }
    if (homeroomClassId && todayAttendance) {
      const total = todayAttendance.present + todayAttendance.absent + todayAttendance.late;
      return {
        color: "#178A52", icon: <IconTile icon={Users} color="#23B26D" size={92} />, tag: `${homeroomName ?? "הכיתה שלי"} היום`,
        title: `${todayAttendance.present + todayAttendance.late} מתוך ${total} הגיעו`,
        meta: [todayAttendance.absent && `${todayAttendance.absent} חסרים`, todayAttendance.late && `${todayAttendance.late} איחורים`].filter(Boolean).join(" · ") || "כולם כאן",
        action: { label: "למפת הכיתה", onClick: () => navigate("/dashboard/seating") },
      };
    }
    const next = day.upcoming[0];
    if (next) {
      heroIsNextLesson = true;
      return {
        color: shadeHex(subjectColor(next.subject)), subject: next.subject, tag: `השיעור הבא · ${next.bellStart}`,
        title: [next.subject, next.className].filter(Boolean).join(" · "), meta: [`שיעור ${next.lesson_number}`, roomText(next.room)].filter(Boolean).join(" · "),
      };
    }
    return {
      color: "#2B3350", icon: <IconTile icon={CalendarCheck2} color="#8E9BD6" size={92} />, tag: day.today.length ? "סיימת להיום" : "אין שיעורים היום",
      title: `${stats.classCount} כיתות · ${stats.totalStudents} תלמידים`, meta: stats.pendingSubmissions ? `${stats.pendingSubmissions} הגשות מחכות לבדיקה` : "אין הגשות שמחכות לבדיקה",
    };
  })();

  // The hero already shows the next lesson when there's nothing on now.
  const laterToday = heroIsNextLesson ? day.upcoming.slice(1) : day.upcoming;

  // Everything waiting on the teacher, most urgent first.
  const todo: { key: string; icon: React.ReactNode; title: string; meta: string; action?: { label: string; onClick: () => void }; tag?: { label: string; tone: Tone } }[] = [];
  if (profile.pendingApprovalsCount > 0) {
    todo.push({ key: "approvals", icon: <IconTile icon={UserCheck} color="#F2A007" />, title: `${profile.pendingApprovalsCount} בקשות הצטרפות ממתינות`,
      meta: "הורים ותלמידים שמחכים לאישור שלך", action: { label: "לטיפול", onClick: () => navigate("/dashboard/approvals") } });
  }
  if (missingSubmissions && missingSubmissions.students.length > 0) {
    todo.push({ key: "missing", icon: <IconTile icon={FileText} color="#F0572A" />, title: `${missingSubmissions.students.length} לא הגישו את "${missingSubmissions.assignmentTitle}"`,
      meta: `${missingSubmissions.className} · התזכורת תישלח לתלמידים ולהורים שלהם`,
      action: reminderSent ? undefined : { label: sendingReminder ? "שולח..." : "שליחת תזכורת", onClick: handleSendReminder },
      tag: reminderSent ? { label: "נשלחה", tone: "success" } : undefined });
  }
  if (profile.roles?.includes("subject_coordinator") && missingWeightsCount > 0) {
    todo.push({ key: "weights", icon: <IconTile icon={AlertTriangle} color="#E5484D" />, title: `${missingWeightsCount} מבחנים בלי משקל בציון`,
      meta: `${coordinatorSubject} · צריך להזין אחוז מהציון הסופי`, action: { label: "להזנה", onClick: () => navigate("/dashboard/schedule") } });
  }
  if (profile.roles?.includes("subject_coordinator")) {
    materialGapExams.forEach((e) => todo.push({ key: `gap-${e.id}`, icon: <IconTile icon={BookOpen} color="#F2A007" />, title: `"${e.title}" עדיין בלי חומר`,
      meta: `מבחן ב-${new Date(e.dueDate).toLocaleDateString("he-IL")}`, action: { label: "לבדיקה", onClick: () => navigate("/dashboard/schedule") } }));
  }
  disciplinePatterns.forEach((p) => todo.push({ key: `disc-${p.studentName}-${p.subject}`, icon: <PersonBadge name={p.studentName} />, title: p.studentName,
    meta: `רוב ההערות ב${p.subject} (${p.count} מתוך ${p.total})`, tag: { label: "דפוס", tone: "warning" } }));

  const main = (
    <>
      <HeroCard {...hero} />

      <HomeSection title="דורש טיפול">
        {todo.length === 0 ? (
          <HomeEmpty>אין כרגע משהו שמחכה לך. יפה!</HomeEmpty>
        ) : (
          todo.map((t, i) => <HomeRow key={t.key} index={i} icon={t.icon} title={t.title} meta={t.meta} action={t.action} tag={t.tag} />)
        )}
      </HomeSection>

      {laterToday.length > 0 && (
        <HomeSection title="בהמשך היום">
          {laterToday.map((l, i) => (
            <HomeRow key={l.lesson_number} index={i} subject={l.subject} title={[l.className, `שיעור ${l.lesson_number}`].filter(Boolean).join(" · ")}
              meta={[l.bellStart, roomText(l.room)].filter(Boolean).join(" · ")} />
          ))}
        </HomeSection>
      )}

      <HomeSection
        title="תקשורת כיתתית"
        action={myClasses.length > 1 ? (
          <PillSwitch options={myClasses.map((c) => ({ value: c.id, label: c.name }))} value={selectedClassId || myClasses[0].id} onChange={setSelectedClassId} />
        ) : undefined}
      >
        {selectedClassId ? (
          <ClassMessenger classId={selectedClassId} userId={profile.id} isTeacher={true} />
        ) : (
          <HomeEmpty>עדיין לא שובצו לך כיתות</HomeEmpty>
        )}
      </HomeSection>

      <SyllabusProgressTracker teacherId={profile.id} schoolId={profile.schoolId || ""} />
    </>
  );

  const side = (
    <>
      <HomeSection title="סיכום פעילות">
        <StatTiles
          size="sm"
          items={[
            { value: stats.totalStudents, label: "תלמידים", tone: "info" },
            { value: stats.pendingSubmissions, label: "הגשות לבדיקה", tone: stats.pendingSubmissions ? "warning" : "success" },
            { value: stats.todayLessons, label: "שיעורים שדווחו היום", tone: "success" },
          ]}
        />
      </HomeSection>

      {profile.roles?.includes("subject_coordinator") && (
        <HomeSection title="המקצוע שלי">
          <Select value={coordinatorSubject} onValueChange={setCoordinatorSubject}>
            <SelectTrigger className="bg-card"><SelectValue placeholder="בחר/י מקצוע" /></SelectTrigger>
            <SelectContent>
              {["מתמטיקה", "אנגלית", "לשון", "היסטוריה", "אזרחות", "ספרות", "מדעים"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {missingWeightsCount === 0 && (
            <HomeRow icon={<IconTile icon={CheckCircle2} color="#23B26D" />} title="כל המשקלים הוזנו" meta="לכל המבחנים במקצוע יש אחוז מהציון" />
          )}
        </HomeSection>
      )}

      {weeklyAttendance.length > 0 && (
        <HomeSection title={`נוכחות השבוע${homeroomName ? ` · ${homeroomName}` : ""}`}>
          <BarList
            items={weeklyAttendance.map((d) => {
              const total = d.present + d.absent + d.late;
              return { label: d.day, value: total ? Math.round(((d.present + d.late) / total) * 100) : 0 };
            })}
          />
          {attendanceWatchList.map((s, i) => (
            <HomeRow key={s.name} index={i} person={s.name} title={s.name} meta="חיסורים חוזרים השבוע"
              tag={{ label: `${s.absences} היעדרויות`, tone: "alert" }} />
          ))}
        </HomeSection>
      )}

      {myClassPace.length > 0 && (
        <HomeSection
          title="קצב שיעורים מול השכבה"
          action={
            <button type="button" onClick={() => { setTutoringSubject(myClassPace[0]?.subject || ""); setShowTutoringDialog(true); }}
              className="flex items-center gap-1 font-body text-[13px] font-extrabold text-link">
              <HandHelping className="h-3.5 w-3.5" />בקשת תגבור
            </button>
          }
        >
          <div className="flex flex-col gap-2 rounded-card bg-card p-[18px] shadow-card">
            {myClassPace.map((row) => {
              const gradeAvg = gradeAvgDeficitBySubject.get(row.subject) ?? 0;
              const tone: Tone = row.deficit >= 4 ? "alert" : row.deficit > 0 ? "warning" : "success";
              return (
                <div key={row.subject} className="flex items-center gap-3 py-1">
                  <SubjectTile subject={row.subject} size={30} flat />
                  <span className="flex-1 font-heading text-sm font-extrabold text-foreground">{row.subject}</span>
                  <span className="font-body text-xs font-bold text-hint">שכבה: {gradeAvg}</span>
                  <RowTag label={row.deficit > 0 ? `פער ${row.deficit}` : "בזמן"} tone={tone} />
                </div>
              );
            })}
          </div>
        </HomeSection>
      )}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <Dialog open={hasSkippedRollcall}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
             <div className="mx-auto mb-2"><IconTile icon={Lock} color="#E5484D" size={64} /></div>
             <DialogTitle className="text-center font-heading font-black text-2xl">חסר דיווח נוכחות להיום</DialogTitle>
             <DialogDescription className="text-center text-base mt-2">
               לפי מערכת השעות היו לך שיעורים היום, ועדיין לא הוזנה בהם נוכחות. אחרי ההזנה ההורים יקבלו עדכון.
             </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:justify-center w-full mt-4">
             <Button className="w-full h-12" onClick={() => { setHasSkippedRollcall(false); navigate("/dashboard/roll-call"); }}>
                להזנת נוכחות
             </Button>
             <Button variant="outline" className="w-full" onClick={() => setHasSkippedRollcall(false)}>
                השיעור התבטל / אירוע מיוחד
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTutoringDialog} onOpenChange={setShowTutoringDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">בקשת תגבור לכיתה</DialogTitle>
            <DialogDescription>הבקשה תישלח לרכז/ת השכבה ולרכז/ת המקצוע לאישור.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={tutoringSubject} onValueChange={setTutoringSubject}>
              <SelectTrigger><SelectValue placeholder="מקצוע" /></SelectTrigger>
              <SelectContent>
                {myClassPace.map(r => <SelectItem key={r.subject} value={r.subject}>{r.subject} (פער {r.deficit})</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea placeholder="סיבה / הקשר (אופציונלי)" value={tutoringReason} onChange={e => setTutoringReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button onClick={submitTutoringRequest} disabled={submittingTutoringRequest || !tutoringSubject} className="w-full">
              {submittingTutoringRequest ? "שולח..." : "שליחת הבקשה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HomeHeader
        title={`${greeting()}, ${firstName(profile.fullName)}`}
        subtitle={[longHebrewDate(), homeroomName ? `מחנך/ת ${homeroomName}` : null, stats.classCount ? `${stats.classCount} כיתות` : null].filter(Boolean).join(" · ")}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/chat")} className="gap-2">
            <MessageSquare className="h-4 w-4" /> שיחות
          </Button>
          <Button onClick={() => navigate("/dashboard/roll-call")} className="gap-2">
            <ClipboardList className="h-4 w-4" /> הקראת שמות
          </Button>
        </div>
      </HomeHeader>

      <HomeColumns main={main} side={side} />
    </motion.div>
  );
};

export default TeacherDashboard;
