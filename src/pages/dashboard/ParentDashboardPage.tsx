import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, MessageSquare, Loader2, CalendarDays, FileText, PartyPopper, Moon } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { computeWeightedAverage } from "@/lib/gradeMath";
import { useStudentDay, formatClassName } from "@/hooks/useStudentDay";
import { subjectColor } from "@/components/SubjectSticker";
import { displayName } from "@/lib/displayName";
import {
  HomeHeader, HeroCard, HomeSection, HomeColumns, StatTiles, HomeRow, HomeEmpty, PillSwitch, IconTile,
  greeting, longHebrewDate, firstName, type Tone,
} from "@/components/home/HomeKit";

/* ─── Types ───────────────────────────────────────────── */
interface ChildInfo {
  id: string;
  fullName: string;
  grade: string | null;
  classNumber: number | null;
  schoolName: string | null;
  classId: string | null;
  schoolId: string | null;
}

interface WeeklyItem {
  id: string;
  title: string;
  type: 'exam' | 'holiday' | 'assignment' | 'event';
  date: string;
  dayLabel: string;
}

interface RecentGrade {
  id: string;
  grade: number;
  graded_at: string | null;
  assignments: { title: string; subject: string | null; max_grade: number | null } | null;
}

// Icon tile per roadmap item type (exam orange, submission yellow, event blue).
const ROADMAP_ICON: Record<WeeklyItem["type"], { icon: typeof CalendarDays; color: string }> = {
  exam: { icon: FileText, color: "#F0572A" },
  assignment: { icon: FileText, color: "#F2A007" },
  event: { icon: PartyPopper, color: "#3B7BF2" },
  holiday: { icon: CalendarDays, color: "#14B8A6" },
};

const ROADMAP_TAG: Record<WeeklyItem["type"], { label: string; tone: Tone }> = {
  exam: { label: "מבחן", tone: "alert" },
  assignment: { label: "הגשה", tone: "warning" },
  event: { label: "אירוע", tone: "info" },
  holiday: { label: "חופשה", tone: "info" },
};

const shortDate = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" });
const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long" });

const ParentDashboardPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [state, setState] = useState({
    overallAvg: null as number | null,
    classAvg: null as number | null,
    attendancePct: 100,
    absentCount: 0,
    weeklyRoadmap: [] as WeeklyItem[],
    recentGrades: [] as RecentGrade[],
    educators: { teacherId: "", educatorName: "", counselorId: "", counselorName: "" },
    classComparison: null as {
      childAbsenceRate: number; classAbsenceRate: number;
      childFocusAvg: number; classFocusAvg: number;
      childSubmissionRate: number; classSubmissionRate: number;
    } | null,
  });
  const [aiInsight, setAiInsight] = useState<string>("");
  const [aiInsightLoading, setAiInsightLoading] = useState(false);

  const day = useStudentDay(selectedChild?.schoolId ?? null, selectedChild?.id ?? null);

  const syncCommunity = useCallback(async (child: ChildInfo) => {
    if (!child.classId || !child.schoolId) return;
    try {
      const { data: convos } = await supabase.from("conversations")
        .select("id")
        .or(`class_id.eq.${child.classId},and(type.eq.parent_grade,school_id.eq.${child.schoolId})`);

      if (convos?.length) {
        const participants = convos.map(c => ({ conversation_id: c.id, user_id: profile.id }));
        const { error } = await supabase.from("conversation_participants").upsert(participants, { onConflict: 'conversation_id,user_id' });
        if (error) throw error;
      }
    } catch (e) { console.error("Sync error", e); }
  }, [profile.id]);

  const loadData = useCallback(async (child: ChildInfo) => {
    const today = new Date().toISOString().split('T')[0];
    await syncCommunity(child);

    // 1. PERFORMANCE: Factual Grades
    const [{ data: subs }, { data: recent }] = await Promise.all([
      supabase.from("submissions")
        .select("grade, assignments(max_grade, weight_percent)")
        .eq("student_id", child.id)
        .not("grade", "is", null),
      supabase.from("submissions")
        .select("id, grade, graded_at, assignments(title, subject, max_grade)")
        .eq("student_id", child.id)
        .not("grade", "is", null)
        .order("graded_at", { ascending: false })
        .limit(3),
    ]);

    const gradedEntries = (subs || []).flatMap((s: any) => {
      const assign = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
      if (!assign) return [];
      return [{ grade: s.grade, maxGrade: assign.max_grade, weightPercent: assign.weight_percent }];
    });
    const cAvg = computeWeightedAverage(gradedEntries);

    // 2. STAFF: Unified Educator & Counselor Lookup
    let staff = { teacherId: "", educatorName: "", counselorId: "", counselorName: "" };
    if (child.classId) {
       // Two queries: user_roles has no FK to profiles, so an embedded
       // profiles!inner(...) select failed outright and both rows showed "לא שובצ/ה".
       const { data: roles } = await supabase.from("user_roles")
         .select("user_id, role")
         .or(`homeroom_class_id.eq.${child.classId},and(role.eq.counselor,grade.eq.${child.grade})`);
       const ids = [...new Set((roles || []).map(r => r.user_id))];
       const { data: people } = ids.length
         ? await supabase.from("profiles").select("id, full_name, display_name, school_id").in("id", ids)
         : { data: [] as { id: string; full_name: string; school_id: string | null }[] };
       // Counselors are matched by grade only, so keep the child's school.
       const byId = new Map((people || []).filter(p => !child.schoolId || p.school_id === child.schoolId).map(p => [p.id, displayName(p)]));

       roles?.forEach(r => {
         const name = byId.get(r.user_id);
         if (!name) return;
         if (r.role === 'educator') {
            staff.teacherId = r.user_id;
            staff.educatorName = name;
         } else if (r.role === 'counselor') {
            staff.counselorId = r.user_id;
            staff.counselorName = name;
         }
       });
    }

    // 3. ROADMAP: Triple-Source Sync
    const [{ data: gEvs }, { data: sEvs }, { data: assigns }, { data: attH }] = await Promise.all([
       supabase.from("grade_events").select("id, title, event_date").eq("school_id", child.schoolId).gte("event_date", today),
       supabase.from("school_events").select("id, title, start_date").eq("school_id", child.schoolId).gte("start_date", today),
       supabase.from("assignments").select("id, title, due_date, type").eq("class_id", child.classId).gte("due_date", today),
       supabase.from("attendance").select("status").eq("student_id", child.id)
    ]);

    const combined: WeeklyItem[] = [];
    gEvs?.forEach(e => combined.push({ id: e.id, title: e.title, type: 'exam', date: e.event_date, dayLabel: new Date(e.event_date).toLocaleDateString("he-IL", { weekday: "short" }) }));
    sEvs?.forEach(e => combined.push({ id: e.id, title: e.title, type: 'event', date: e.start_date, dayLabel: new Date(e.start_date).toLocaleDateString("he-IL", { weekday: "short" }) }));
    assigns?.forEach(e => {
       if (e.due_date) combined.push({ id: e.id, title: e.title, type: e.type === 'exam' ? 'exam' : 'assignment', date: e.due_date, dayLabel: new Date(e.due_date).toLocaleDateString("he-IL", { weekday: "short" }) });
    });

    const finalRoadmap = combined
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);

    const absences = (attH || []).filter(a => a.status === "absent").length;
    const attPct = attH?.length ? Math.round(((attH.length - absences) / attH.length) * 100) : 100;

    let classAvg: number | null = null;
    if (child.classId) {
      const { data: avgData } = await supabase.rpc("get_class_average", { p_class_id: child.classId });
      classAvg = avgData ?? null;
    }

    // "Soft" comparisons alongside grades: is my kid's attendance/focus/
    // homework-follow-through normal for this class, or a real outlier?
    // Previously each showed only the child's own raw number.
    const { data: cmpRows } = await supabase.rpc("get_child_class_comparison", { p_student_id: child.id });
    const cmp = cmpRows?.[0];
    const classComparison = cmp ? {
      childAbsenceRate: cmp.child_absence_rate,
      classAbsenceRate: cmp.class_absence_rate,
      childFocusAvg: cmp.child_focus_avg,
      classFocusAvg: cmp.class_focus_avg,
      childSubmissionRate: cmp.child_submission_rate,
      classSubmissionRate: cmp.class_submission_rate,
    } : null;

    setState({
      overallAvg: cAvg,
      classAvg,
      attendancePct: attPct,
      absentCount: absences,
      weeklyRoadmap: finalRoadmap,
      recentGrades: (recent || []) as any,
      educators: staff,
      classComparison,
    });

    setAiInsightLoading(true);
    setAiInsight("");
    try {
      const contextStr = `ילד/ה: ${child.fullName}, כיתה ${child.grade || ""}'${child.classNumber || ""}.
ממוצע ציונים אישי: ${cAvg ?? "אין נתונים"}. ממוצע כיתה: ${classAvg ?? "אין נתונים"}.
אחוז נוכחות: ${attPct}%. מספר היעדרויות: ${absences}.
אירועים קרובים: ${finalRoadmap.length > 0 ? finalRoadmap.map(r => r.title).join(", ") : "אין אירועים קרובים"}.`;
      const { data } = await supabase.functions.invoke("ai-tutor", {
        body: { context: "parent_insight", message: contextStr, studentId: child.id },
      });
      setAiInsight(data?.message || "לא ניתן לטעון תובנה כרגע");
    } catch {
      setAiInsight("שגיאה בטעינת התובנה, נסה/י שוב מאוחר יותר");
    } finally {
      setAiInsightLoading(false);
    }
  }, [syncCommunity]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: lks } = await supabase.from("parent_student").select("student_id").eq("parent_id", profile.id);
      if (!lks?.length) { setLoading(false); return; }
      const ids = lks.map(l => l.student_id);
      const { data: prs } = await supabase.from("profiles").select("id, full_name, display_name, class_id, school_id, schools(name), classes(grade, class_number)").in("id", ids);
      if (prs) {
        const kids = prs.map((p: any) => ({
          id: p.id, fullName: displayName(p), grade: p.classes?.grade || null, classNumber: p.classes?.class_number || null,
          schoolName: p.schools?.name || null, classId: p.class_id || null, schoolId: p.school_id || null,
        }));
        setChildren(kids);
        if (kids.length) setSelectedChild(kids[0]);
      }
      setLoading(false);
    };
    init();
  }, [profile.id]);

  useEffect(() => { if (selectedChild) loadData(selectedChild); }, [selectedChild, loadData]);

  // Live attendance alerts: attendance realtime + RLS were already set up
  // server-side for this, but nothing ever subscribed to it.
  useEffect(() => {
    if (!selectedChild) return;
    const channel = supabase
      .channel(`parent-attendance-${selectedChild.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `student_id=eq.${selectedChild.id}` },
        (payload) => {
          const status = (payload.new as any)?.status;
          if (status === "absent" || status === "late") {
            toast({
              title: status === "absent" ? `${selectedChild.fullName} סומן/ה נעדר/ת` : `${selectedChild.fullName} סומן/ה כמאחר/ת`,
              description: "עודכן כרגע במערכת הנוכחות",
              variant: status === "absent" ? "destructive" : "default",
            });
          }
          loadData(selectedChild);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChild, loadData, toast]);

  const goToGrades = () => selectedChild && navigate(`/dashboard/grades/${selectedChild.id}`);
  const goToAttendance = () => selectedChild && navigate(`/dashboard/attendance/${selectedChild.id}`);
  const goToChat = (id?: string) => id && navigate("/dashboard/chat", { state: { targetUserId: id } });
  const goToCommunity = (type: string) => navigate("/dashboard/chat", { state: { initialType: type } });

  if (loading) return <div className="flex h-[60vh] items-center justify-center text-muted-foreground">טוען...</div>;

  const childLabel = (c: ChildInfo) => [firstName(c.fullName), c.grade && formatClassName(c.grade, c.classNumber)].filter(Boolean).join(" · ");
  const kidsNames = children.map((c) => firstName(c.fullName));
  const subtitle = [
    longHebrewDate(),
    kidsNames.length ? `הורה של ${kidsNames.length > 1 ? `${kidsNames.slice(0, -1).join(", ")} ו${kidsNames[kidsNames.length - 1]}` : kidsNames[0]}` : null,
  ].filter(Boolean).join(" · ");

  if (!selectedChild) {
    return (
      <div className="flex flex-col gap-6">
        <HomeHeader title={`${greeting()}, ${firstName(profile.fullName)}`} subtitle={longHebrewDate()} />
        <HomeEmpty>עדיין לא קושרו ילדים לחשבון. אחרי שהמחנך/ת יאשר/תאשר את הקישור, הם יופיעו כאן</HomeEmpty>
      </div>
    );
  }

  const childName = firstName(selectedChild.fullName);
  const lessonMeta = (l: { teacher_name: string | null; room: string | null; lesson_number: number }) =>
    [`שיעור ${l.lesson_number}`, l.teacher_name, l.room && `חדר ${l.room}`].filter(Boolean).join(" · ");

  // What the child is doing right now.
  const hero = (() => {
    if (day.phase === "lesson" && day.current) {
      return { color: day.current.color || subjectColor(day.current.subject), subject: day.current.subject,
        tag: `${childName} עכשיו`, title: day.current.subject, meta: lessonMeta(day.current) };
    }
    if (day.phase === "break" && day.next) {
      return { color: "#C2552A", subject: "תזונה", tag: `${childName} עכשיו`, title: "בהפסקה",
        meta: `השיעור הבא: ${day.next.subject} ב-${day.next.bellStart}` };
    }
    if (day.phase === "before" && day.next) {
      return { color: day.next.color || subjectColor(day.next.subject), subject: day.next.subject,
        tag: `היום של ${childName} מתחיל ב-${day.next.bellStart}`, title: day.next.subject, meta: lessonMeta(day.next) };
    }
    const nextItem = state.weeklyRoadmap[0];
    if (nextItem) {
      return { color: "#2F64D0", icon: <IconTile icon={ROADMAP_ICON[nextItem.type].icon} color={ROADMAP_ICON[nextItem.type].color} size={92} />, tag: `הבא אצל ${childName}`, title: nextItem.title,
        meta: `${ROADMAP_TAG[nextItem.type].label} · ${weekday.format(new Date(nextItem.date))} ${shortDate.format(new Date(nextItem.date))}` };
    }
    return { color: "#2B3350", icon: <IconTile icon={Moon} color="#8E9BD6" size={92} />, tag: childLabel(selectedChild),
      title: day.phase === "after" ? "היום הסתיים" : "אין לימודים היום", meta: selectedChild.schoolName || undefined };
  })();

  const presenceTone: Tone = state.attendancePct >= 90 ? "success" : state.attendancePct >= 85 ? "warning" : "danger";
  const cmp = state.classComparison;
  const comparisonRows = cmp ? [
    { label: "נוכחות", child: Math.round((1 - cmp.childAbsenceRate) * 100), cls: Math.round((1 - cmp.classAbsenceRate) * 100),
      childText: `${Math.round((1 - cmp.childAbsenceRate) * 100)}%`, clsText: `${Math.round((1 - cmp.classAbsenceRate) * 100)}%` },
    { label: "ריכוז בשיעור", child: Math.round((cmp.childFocusAvg / 5) * 100), cls: Math.round((cmp.classFocusAvg / 5) * 100),
      childText: cmp.childFocusAvg > 0 ? `${cmp.childFocusAvg.toFixed(1)}/5` : "—", clsText: cmp.classFocusAvg > 0 ? `${cmp.classFocusAvg.toFixed(1)}/5` : "—" },
    { label: "הגשה בזמן", child: Math.round(cmp.childSubmissionRate * 100), cls: Math.round(cmp.classSubmissionRate * 100),
      childText: `${Math.round(cmp.childSubmissionRate * 100)}%`, clsText: `${Math.round(cmp.classSubmissionRate * 100)}%` },
  ] : [];

  const main = (
    <>
      <HeroCard {...hero} />

      <HomeSection title={`השבוע של ${childName}`}>
        {state.weeklyRoadmap.length === 0 ? (
          <HomeEmpty>אין מבחנים, הגשות או אירועים בימים הקרובים</HomeEmpty>
        ) : (
          state.weeklyRoadmap.map((i, idx) => (
            <HomeRow key={i.id} index={idx} icon={<IconTile icon={ROADMAP_ICON[i.type].icon} color={ROADMAP_ICON[i.type].color} />}
              title={i.title} meta={`${weekday.format(new Date(i.date))} ${shortDate.format(new Date(i.date))}`} tag={ROADMAP_TAG[i.type]} />
          ))
        )}
      </HomeSection>

      <HomeSection title="ערוצי קשר">
        <HomeRow person={state.educators.educatorName || "מחנך/ת"} index={0} title={state.educators.educatorName || "לא שובצ/ה מחנך/ת"} meta="מחנך/ת הכיתה"
          action={state.educators.teacherId ? { label: "לשיחה", onClick: () => goToChat(state.educators.teacherId) } : undefined} />
        <HomeRow person={state.educators.counselorName || "יועץ/ת"} index={1} title={state.educators.counselorName || "לא שובצ/ה יועץ/ת"} meta="יועץ/ת השכבה"
          action={state.educators.counselorId ? { label: "לשיחה", onClick: () => goToChat(state.educators.counselorId) } : undefined} />
        <HomeRow index={0} icon={<IconTile icon={MessageSquare} color="#1592B3" />}
          title={`קבוצת הורי ${selectedChild.grade ? formatClassName(selectedChild.grade, selectedChild.classNumber) : "הכיתה"}`} meta="שיחה עם הורי הכיתה"
          onClick={() => goToCommunity("parent_class")} />
        <HomeRow index={1} icon={<IconTile icon={MessageSquare} color="#4F70C9" />}
          title={`פורום הורי שכבת ${selectedChild.grade ? formatClassName(selectedChild.grade) : ""}`} meta="שיחה עם כל הורי השכבה"
          onClick={() => goToCommunity("parent_grade")} />
      </HomeSection>

      {(aiInsightLoading || aiInsight) && (
        <HomeSection title="תובנה על השבוע">
          <HomeRow
            icon={<IconTile icon={ShieldCheck} color="#9257EC" />}
            title={`מה כדאי לדעת על ${childName}`}
            meta={aiInsightLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : aiInsight}
          />
        </HomeSection>
      )}
    </>
  );

  const side = (
    <>
      <HomeSection title="תמונת מצב">
        <div onClick={goToAttendance} className="cursor-pointer">
          <StatTiles
            size="sm"
            items={[
              { value: `${state.attendancePct}%`, label: "נוכחות", tone: presenceTone },
              { value: state.overallAvg ?? "—", label: state.classAvg !== null ? `ממוצע (כיתה ${state.classAvg})` : "ממוצע", tone: "info" },
              { value: state.absentCount, label: "היעדרויות", tone: state.absentCount > 0 ? "neutral" : "success" },
            ]}
          />
        </div>
      </HomeSection>

      <HomeSection
        title="ציונים אחרונים"
        action={<button type="button" onClick={goToGrades} className="font-body text-[13px] font-extrabold text-link">דוחות וציונים ←</button>}
      >
        {state.recentGrades.length === 0 ? (
          <HomeEmpty>עדיין אין ציונים</HomeEmpty>
        ) : (
          state.recentGrades.map((g, i) => {
            const max = g.assignments?.max_grade || 100;
            return (
              <HomeRow key={g.id} index={i} subject={g.assignments?.subject || undefined} title={g.assignments?.title || "מטלה"}
                meta={[g.assignments?.subject, g.graded_at && shortDate.format(new Date(g.graded_at))].filter(Boolean).join(" · ")}
                tag={{ label: max === 100 ? String(g.grade) : `${g.grade}/${max}`, tone: (g.grade / max) * 100 >= 80 ? "success" : "warning" }}
                onClick={goToGrades} />
            );
          })
        )}
      </HomeSection>

      {comparisonRows.length > 0 && (
        <HomeSection title="לעומת הכיתה">
          <div className="flex flex-col gap-3.5 rounded-card bg-card p-[18px] shadow-card">
            {comparisonRows.map((r) => {
              const low = r.child < r.cls - 5;
              return (
                <div key={r.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between font-body text-[13px] font-extrabold">
                    <span className="text-foreground">{r.label}</span>
                    <span style={{ color: low ? "#A8320F" : "#11734A" }}>{r.childText} <span className="font-bold text-hint">· כיתה {r.clsText}</span></span>
                  </div>
                  <div className="relative h-3.5 overflow-hidden rounded-[7px] bg-[#F0EBE2] dark:bg-muted">
                    <div className="absolute inset-y-0 right-0 rounded-[7px]" style={{ width: `${Math.min(100, Math.max(0, r.child))}%`, background: low ? "#F0602F" : "#23B26D" }} />
                    <div className="absolute inset-y-0 w-[3px] rounded bg-foreground/60" style={{ right: `${Math.min(100, Math.max(0, r.cls))}%` }} title={`ממוצע הכיתה: ${r.clsText}`} />
                  </div>
                </div>
              );
            })}
            <p className="font-body text-xs font-semibold text-hint">הקו הכהה הוא ממוצע הכיתה</p>
          </div>
        </HomeSection>
      )}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <HomeHeader title={`${greeting()}, ${firstName(profile.fullName)}`} subtitle={subtitle}>
        {children.length > 1 && (
          <PillSwitch
            options={children.map((c) => ({ value: c.id, label: childLabel(c) }))}
            value={selectedChild.id}
            onChange={(id) => setSelectedChild(children.find((c) => c.id === id) || selectedChild)}
          />
        )}
      </HomeHeader>
      <HomeColumns main={main} side={side} />
    </motion.div>
  );
};

export default ParentDashboardPage;
