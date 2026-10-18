import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, CalendarDays, CheckCircle2, Circle, ClipboardList, Clock, FileEdit, FileText,
  GraduationCap, LayoutGrid, ListChecks, MessageCircle, Plus, Presentation, Radio, Settings, Trash2, BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubjectSticker, subjectColor } from "@/components/SubjectSticker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getSchoolGuidelines } from "@/hooks/useSchoolGuidelines";
import type { UserProfile } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/* The teacher's subjects as folders: one per class x subject, opening onto
   dates, syllabus, grades, next lesson, homework, a checklist and links to
   the workspaces (live lesson, roll call, task studio...). */

interface Folder {
  key: string;
  classId: string;
  subject: string;
  grade: string;
  classLabel: string;
  slots: { day: number; lesson: number; room: string | null }[];
}

interface Bell { lesson_number: number; start_time: string; end_time: string; }

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const TABS = [
  { id: "overview", label: "סקירה" },
  { id: "syllabus", label: "סילבוס" },
  { id: "grades", label: "ציונים" },
  { id: "homework", label: "שיעורי בית" },
  { id: "spaces", label: "סביבות עבודה" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const folderKey = (classId: string, subject: string) => `${classId}|${subject}`;
const ymd = (d: Date) => d.toLocaleDateString("en-CA");
const fmtDate = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" });

/** Next occurrence of any of the folder's weekly slots, from now. */
function nextLesson(folder: Folder, bells: Bell[]) {
  const now = new Date();
  let best: { at: Date; slot: Folder["slots"][number]; bell?: Bell } | null = null;
  for (const slot of folder.slots) {
    const bell = bells.find((b) => b.lesson_number === slot.lesson);
    const [h, m] = (bell?.start_time || `${7 + slot.lesson}:00`).split(":").map(Number);
    for (let add = 0; add <= 7; add++) {
      const d = new Date(now);
      d.setDate(now.getDate() + add);
      if (d.getDay() !== slot.day) continue;
      d.setHours(h, m, 0, 0);
      if (d <= now) continue;
      if (!best || d < best.at) best = { at: d, slot, bell };
      break;
    }
  }
  return best;
}

const TeacherSubjectsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [bells, setBells] = useState<Bell[]>([]);
  const [loading, setLoading] = useState(true);

  const openKey = params.get("f");
  const tab = (params.get("tab") as Tab) || "overview";
  const open = folders.find((f) => f.key === openKey) || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [slotsRes, tcRes, rolesRes, asgRes, bellsRes] = await Promise.all([
        supabase.from("timetable_slots").select("class_id, subject, day_of_week, lesson_number, room").eq("teacher_id", profile.id),
        supabase.from("teacher_classes").select("class_id, is_homeroom").eq("user_id", profile.id),
        supabase.from("user_roles").select("role, subject").eq("user_id", profile.id),
        supabase.from("assignments").select("class_id, subject").eq("teacher_id", profile.id),
        profile.schoolId
          ? supabase.from("bell_schedule").select("lesson_number, start_time, end_time").eq("school_id", profile.schoolId).eq("is_break", false)
          : Promise.resolve({ data: [] as Bell[] }),
      ]);

      const map = new Map<string, { classId: string; subject: string; slots: Folder["slots"] }>();
      const add = (classId: string | null, subject: string | null) => {
        const s = subject?.trim();
        if (!classId || !s || s === "חינוך" || s === "שעת חינוך") return null;
        const k = folderKey(classId, s);
        if (!map.has(k)) map.set(k, { classId, subject: s, slots: [] });
        return map.get(k)!;
      };
      for (const r of slotsRes.data || []) {
        add(r.class_id, r.subject)?.slots.push({ day: r.day_of_week, lesson: r.lesson_number, room: r.room });
      }
      for (const r of asgRes.data || []) add(r.class_id, r.subject);
      // Classes assigned without a timetable yet: pair them with the teacher's subject(s).
      const mySubjects = (rolesRes.data || [])
        .filter((r: any) => ["professional_teacher", "subject_coordinator"].includes(r.role) && r.subject)
        .map((r: any) => r.subject as string);
      for (const r of tcRes.data || []) {
        if (r.is_homeroom) continue;
        const hasAny = [...map.values()].some((f) => f.classId === r.class_id);
        if (!hasAny) mySubjects.forEach((s) => add(r.class_id, s));
      }

      const classIds = [...new Set([...map.values()].map((f) => f.classId))];
      const { data: classes } = classIds.length
        ? await supabase.from("classes").select("id, grade, class_number").in("id", classIds)
        : { data: [] as any[] };
      const classById = new Map((classes || []).map((c: any) => [c.id, c]));

      const list: Folder[] = [...map.entries()]
        .filter(([, f]) => classById.has(f.classId))
        .map(([key, f]) => {
          const c = classById.get(f.classId);
          return { key, ...f, grade: c.grade, classLabel: `${c.grade}-${c.class_number}` };
        })
        .sort((a, b) => a.subject.localeCompare(b.subject, "he") || a.classLabel.localeCompare(b.classLabel, "he"));

      if (cancelled) return;
      setFolders(list);
      setBells((bellsRes.data as Bell[]) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile.id, profile.schoolId]);

  const setOpen = (key: string | null, nextTab: Tab = "overview") => {
    const p = new URLSearchParams(params);
    if (key) { p.set("f", key); p.set("tab", nextTab); } else { p.delete("f"); p.delete("tab"); }
    setParams(p);
  };

  if (loading) {
    return <div className="py-20 text-center font-body text-muted-foreground">טוען את המקצועות…</div>;
  }

  if (!open) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-[18px]">
        <div className="px-1">
          <h1 className="font-heading text-[27px] font-black leading-[1.05]">המקצועות שלי</h1>
          <p className="mt-[5px] font-body text-[13px] font-semibold text-muted-foreground">
            תיקייה לכל כיתה ומקצוע · {folders.length} תיקיות
          </p>
        </div>
        {folders.length === 0 ? (
          <div className="rounded-card bg-card p-10 text-center font-body text-muted-foreground shadow-card">
            עדיין לא שובצת למקצוע בכיתה. אחרי שיבוץ במערכת השעות או ע״י רכז/ת המקצוע, התיקיות יופיעו כאן.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {folders.map((f, i) => (
              <FolderCard key={f.key} folder={f} bells={bells} index={i} onOpen={() => setOpen(f.key)} />
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <FolderView
      folder={open}
      bells={bells}
      tab={tab}
      profile={profile}
      onTab={(t) => setOpen(open.key, t)}
      onBack={() => setOpen(null)}
      navigate={navigate}
      toast={toast}
    />
  );
};

/* ── Folder card ─────────────────────────────────────── */
function FolderCard({ folder, bells, index, onOpen }: { folder: Folder; bells: Bell[]; index: number; onOpen: () => void }) {
  const color = subjectColor(folder.subject);
  const next = nextLesson(folder, bells);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ y: -3 }}
      className="group relative pt-[14px] text-right"
      aria-label={`${folder.subject} ${folder.classLabel}`}
    >
      {/* folder tab */}
      <span
        className="absolute right-3 top-0 h-[22px] w-[46%] rounded-t-[12px]"
        style={{ background: color, opacity: 0.85 }}
      />
      <div
        className="relative flex h-full flex-col gap-2 rounded-[18px] rounded-tr-[6px] border-[2.5px] border-white p-3 shadow-[0_8px_18px_-10px_rgba(27,35,51,0.45)] dark:border-card"
        style={{ background: `linear-gradient(160deg, ${color}26, ${color}0d), hsl(var(--card))` }}
      >
        <div className="flex items-start justify-between gap-2">
          <SubjectSticker subject={folder.subject} size={42} tilt />
          <span className="rounded-full bg-card px-2 py-[3px] font-heading text-[12px] font-black text-foreground shadow-sm">
            {folder.classLabel}
          </span>
        </div>
        <p className="font-heading text-[15px] font-extrabold leading-tight text-foreground">{folder.subject}</p>
        <p className="flex items-center gap-1 font-body text-[11.5px] font-semibold text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          {next ? `${DAY_NAMES[next.at.getDay()]} · שיעור ${next.slot.lesson}` : "אין שיעור במערכת"}
        </p>
      </div>
    </motion.button>
  );
}

/* ── Folder view ─────────────────────────────────────── */
interface FolderViewProps {
  folder: Folder;
  bells: Bell[];
  tab: Tab;
  profile: UserProfile;
  onTab: (t: Tab) => void;
  onBack: () => void;
  navigate: ReturnType<typeof useNavigate>;
  toast: ReturnType<typeof useToast>["toast"];
}

function FolderView({ folder, bells, tab, profile, onTab, onBack, navigate, toast }: FolderViewProps) {
  const color = subjectColor(folder.subject);
  const next = nextLesson(folder, bells);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [events, setEvents] = useState<{ date: string; title: string; kind: string }[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [progress, setProgress] = useState<Map<string, string>>(new Map());
  const [checklist, setChecklist] = useState<any[]>([]);
  const [newItem, setNewItem] = useState("");
  const [hw, setHw] = useState({ title: "", due: "", description: "" });
  const [savingHw, setSavingHw] = useState(false);

  const load = useCallback(async () => {
    const today = ymd(new Date());
    const [asgRes, studentsRes, examsRes, schoolEvRes, sylRes, progRes, checkRes] = await Promise.all([
      supabase.from("assignments").select("id, title, type, due_date, max_grade, published, created_at, description")
        .eq("teacher_id", profile.id).eq("class_id", folder.classId).eq("subject", folder.subject)
        .order("due_date", { ascending: false, nullsFirst: false }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("class_id", folder.classId).eq("is_approved", true),
      profile.schoolId
        ? supabase.from("grade_events").select("title, event_date, event_type, status")
            .eq("school_id", profile.schoolId).eq("grade", folder.grade as any).eq("subject", folder.subject)
            .gte("event_date", today).not("status", "in", "(rejected,cancelled)").order("event_date")
        : Promise.resolve({ data: [] as any[] }),
      profile.schoolId
        ? supabase.from("school_events").select("title, start_date, event_type")
            .or(`school_id.eq.${profile.schoolId},school_id.is.null`).gte("start_date", today).order("start_date").limit(5)
        : Promise.resolve({ data: [] as any[] }),
      profile.schoolId
        ? supabase.from("syllabi").select("id, topic, description, estimated_hours, order_index")
            .eq("school_id", profile.schoolId).eq("subject", folder.subject).eq("grade", folder.grade as any).order("order_index")
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("class_syllabus_progress").select("syllabus_id, status").eq("class_id", folder.classId),
      supabase.from("teacher_subject_checklist" as any).select("*")
        .eq("teacher_id", profile.id).eq("class_id", folder.classId).eq("subject", folder.subject).order("created_at"),
    ]);

    const asg = asgRes.data || [];
    setAssignments(asg);
    setStudentCount(studentsRes.count || 0);
    setTopics(sylRes.data || []);
    setProgress(new Map((progRes.data || []).map((p: any) => [p.syllabus_id, p.status])));
    setChecklist((checkRes.data as any[]) || []);

    const evs = [
      ...(examsRes.data || []).map((e: any) => ({ date: e.event_date, title: e.title, kind: e.event_type === "exam" ? "מבחן" : "אירוע" })),
      ...asg.filter((a: any) => a.due_date && a.due_date.slice(0, 10) >= today)
        .map((a: any) => ({ date: a.due_date.slice(0, 10), title: a.title, kind: a.type === "homework" ? "הגשה" : "משימה" })),
      ...(schoolEvRes.data || []).map((e: any) => ({ date: e.start_date, title: e.title, kind: "בית ספר" })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    setEvents(evs);

    if (asg.length) {
      const { data } = await supabase.from("submissions").select("assignment_id, grade, status").in("assignment_id", asg.map((a: any) => a.id));
      setSubs(data || []);
    } else setSubs([]);
  }, [folder.classId, folder.subject, folder.grade, profile.id, profile.schoolId]);

  useEffect(() => { load(); }, [load]);

  /* syllabus */
  const toggleTopic = async (id: string) => {
    const cur = progress.get(id) || "not_started";
    const nextStatus = cur === "completed" ? "not_started" : cur === "in_progress" ? "completed" : "in_progress";
    setProgress((m) => new Map(m).set(id, nextStatus));
    const { error } = await supabase.from("class_syllabus_progress").upsert(
      { class_id: folder.classId, syllabus_id: id, status: nextStatus, completed_at: nextStatus === "completed" ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
      { onConflict: "class_id,syllabus_id" },
    );
    if (error) toast({ title: "לא נשמר", description: error.message, variant: "destructive" });
  };
  const doneTopics = topics.filter((t) => progress.get(t.id) === "completed").length;

  /* checklist */
  const addItem = async () => {
    const text = newItem.trim();
    if (!text) return;
    setNewItem("");
    const { data, error } = await supabase.from("teacher_subject_checklist" as any)
      .insert({ teacher_id: profile.id, class_id: folder.classId, subject: folder.subject, text }).select("*").single();
    if (error) { toast({ title: "לא נשמר", description: error.message, variant: "destructive" }); return; }
    setChecklist((l) => [...l, data]);
  };
  const toggleItem = async (item: any) => {
    const done = !item.done;
    setChecklist((l) => l.map((x) => (x.id === item.id ? { ...x, done } : x)));
    await supabase.from("teacher_subject_checklist" as any).update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", item.id);
  };
  const removeItem = async (id: string) => {
    setChecklist((l) => l.filter((x) => x.id !== id));
    await supabase.from("teacher_subject_checklist" as any).delete().eq("id", id);
  };

  /* homework */
  const addHomework = async () => {
    if (!hw.title.trim() || !profile.schoolId) return;
    // School guideline: how many submissions a class may have due on one day.
    if (hw.due) {
      const limit = (await getSchoolGuidelines(profile.schoolId))?.assignments.maxHomeworkPerDay;
      if (limit) {
        const { count } = await supabase.from("assignments").select("id", { count: "exact", head: true })
          .eq("class_id", folder.classId).gte("due_date", `${hw.due}T00:00:00`).lte("due_date", `${hw.due}T23:59:59`);
        if ((count || 0) >= limit && !window.confirm(`לכיתה כבר יש ${count} הגשות באותו יום (לפי הנחיות בית הספר עד ${limit}). לשלוח בכל זאת?`)) return;
      }
    }
    setSavingHw(true);
    const { error } = await supabase.from("assignments").insert({
      teacher_id: profile.id, class_id: folder.classId, subject: folder.subject, school_id: profile.schoolId,
      title: hw.title.trim(), description: hw.description.trim() || null, type: "homework",
      due_date: hw.due ? new Date(hw.due + "T23:59:00").toISOString() : null, published: true,
    });
    setSavingHw(false);
    if (error) { toast({ title: "שגיאה בשמירת שיעורי הבית", description: error.message, variant: "destructive" }); return; }
    setHw({ title: "", due: "", description: "" });
    toast({ title: "שיעורי הבית נשלחו לכיתה" });
    load();
  };

  /* grades */
  const gradeRows = useMemo(() => assignments.filter((a) => a.type !== "homework" || subs.some((s) => s.assignment_id === a.id && s.grade != null)).map((a) => {
    const mine = subs.filter((s) => s.assignment_id === a.id);
    const graded = mine.filter((s) => s.grade != null);
    const avg = graded.length ? graded.reduce((n, s) => n + Number(s.grade), 0) / graded.length : null;
    return { ...a, submitted: mine.filter((s) => s.status !== "draft").length, graded: graded.length, avg };
  }), [assignments, subs]);
  const overallAvg = (() => {
    const g = subs.filter((s) => s.grade != null);
    return g.length ? Math.round(g.reduce((n, s) => n + Number(s.grade), 0) / g.length) : null;
  })();
  const homework = assignments.filter((a) => a.type === "homework");

  const openSubjectChat = async () => {
    // auto_key is newer than the generated types.
    const { data } = await (supabase as any).from("conversations").select("id")
      .eq("auto_key", `subj:${folder.classId}:${folder.subject}`).maybeSingle();
    navigate("/dashboard/chat", data?.id ? { state: { targetConversationId: data.id } } : undefined);
  };

  const spaces = [
    { label: "שיעור חי", icon: Radio, to: "/dashboard/live-lesson" },
    { label: "הקראת שמות", icon: ClipboardList, to: "/dashboard/roll-call" },
    { label: "סטודיו משימות", icon: Settings, to: "/dashboard/task-studio" },
    { label: "משימות והגשות", icon: FileText, to: "/dashboard/teacher-assignments" },
    { label: "ציונים ודוחות", icon: GraduationCap, to: "/dashboard/teacher-grades" },
    { label: "מסמכים", icon: FileEdit, to: "/dashboard/documents" },
    { label: "מצגות", icon: Presentation, to: "/dashboard/presentations" },
    { label: "מפת הושבה", icon: LayoutGrid, to: "/dashboard/seating" },
    { label: "תכנון סילבוס", icon: BookOpen, to: "/dashboard/syllabus-planner" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
      {/* header */}
      <div
        className="relative overflow-hidden rounded-[24px] border-[3px] border-white p-4 text-white shadow-[0_12px_24px_-14px_rgba(27,35,51,0.6)] dark:border-card"
        style={{ background: color }}
      >
        <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 font-body text-[12.5px] font-bold text-white/90 hover:text-white">
          <ArrowRight className="h-4 w-4" />כל התיקיות
        </button>
        <div className="flex items-center gap-3">
          <SubjectSticker subject={folder.subject} size={58} tilt />
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[24px] font-black leading-tight">{folder.subject}</h1>
            <p className="font-body text-[13px] font-semibold text-white/90">כיתה {folder.classLabel} · {studentCount} תלמידים</p>
          </div>
          <Button size="sm" variant="secondary" className="shrink-0 gap-1.5 rounded-full" onClick={openSubjectChat}>
            <MessageCircle className="h-4 w-4" />קבוצת הכיתה
          </Button>
        </div>
      </div>

      {/* tabs, like folder dividers */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={cn(
              "shrink-0 rounded-full border-[2.5px] border-white px-[14px] py-[8px] font-body text-[13px] font-extrabold leading-none dark:border-card",
              tab === t.id ? "bg-primary text-primary-foreground shadow-[0_5px_10px_-5px_rgba(27,35,51,0.5)]" : "bg-card text-text-secondary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="השיעור הבא" icon={<Clock className="h-4 w-4" />}>
            {next ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-heading text-[20px] font-black">{DAY_NAMES[next.at.getDay()]} · שיעור {next.slot.lesson}</p>
                  <p className="font-body text-[13px] font-semibold text-muted-foreground">
                    {fmtDate(next.at.toISOString())}
                    {next.bell ? ` · ${next.bell.start_time.slice(0, 5)}–${next.bell.end_time.slice(0, 5)}` : ""}
                    {next.slot.room ? ` · חדר ${next.slot.room}` : ""}
                  </p>
                </div>
                <Button size="sm" className="rounded-full" onClick={() => navigate("/dashboard/live-lesson")}>להתחלת שיעור</Button>
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground">המקצוע עדיין לא מופיע במערכת השעות.</p>
            )}
            {folder.slots.length > 0 && (
              <p className="mt-3 font-body text-[12px] font-semibold text-muted-foreground">
                בשבוע: {folder.slots.map((s) => `${DAY_NAMES[s.day]} ${s.lesson}`).join(" · ")}
              </p>
            )}
          </Panel>

          <Panel title="תאריכים קרובים" icon={<CalendarDays className="h-4 w-4" />}>
            {events.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">אין תאריכים קרובים.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {events.slice(0, 6).map((e, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="shrink-0 whitespace-nowrap font-heading text-[12.5px] font-black">{fmtDate(e.date)}</span>
                    <span className="flex-1 truncate font-body text-[13px] font-semibold">{e.title}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-body text-[10.5px] font-bold text-muted-foreground">{e.kind}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="צ׳קליסט" icon={<ListChecks className="h-4 w-4" />}>
            <ul className="flex flex-col gap-1.5">
              {checklist.map((item) => (
                <li key={item.id} className="group flex items-center gap-2">
                  <button type="button" onClick={() => toggleItem(item)} aria-label={item.done ? "סמן/י כלא בוצע" : "סמן/י כבוצע"}>
                    {item.done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <span className={cn("flex-1 font-body text-[13.5px] font-semibold", item.done && "text-muted-foreground line-through")}>{item.text}</span>
                  <button type="button" onClick={() => removeItem(item.id)} aria-label="מחיקה" className="text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); addItem(); }}>
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="למשל: להדפיס דף עבודה" className="h-9 text-sm" maxLength={300} />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!newItem.trim()} aria-label="הוספה"><Plus className="h-4 w-4" /></Button>
            </form>
          </Panel>

          <Panel title="תמונת מצב" icon={<GraduationCap className="h-4 w-4" />}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="ממוצע" value={overallAvg != null ? String(overallAvg) : "—"} />
              <Stat label="סילבוס" value={topics.length ? `${Math.round((doneTopics / topics.length) * 100)}%` : "—"} />
              <Stat label="שיעורי בית" value={String(homework.length)} />
            </div>
          </Panel>
        </div>
      )}

      {tab === "syllabus" && (
        <Panel title={`סילבוס שכבה ${folder.grade}`} icon={<BookOpen className="h-4 w-4" />}>
          {topics.length === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="font-body text-sm text-muted-foreground">עדיין לא הוגדר סילבוס למקצוע בשכבה.</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/syllabus-planner")}>לתכנון הסילבוס</Button>
            </div>
          ) : (
            <>
              <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all" style={{ width: `${(doneTopics / topics.length) * 100}%`, background: color }} />
              </div>
              <ol className="flex flex-col gap-1.5">
                {topics.map((t, i) => {
                  const st = progress.get(t.id) || "not_started";
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => toggleTopic(t.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right hover:bg-muted/60">
                        {st === "completed" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                          : st === "in_progress" ? <Circle className="h-5 w-5 shrink-0" style={{ color, fill: color + "40" }} />
                          : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                        <span className="flex-1">
                          <span className="font-heading text-[14px] font-bold">{i + 1}. {t.topic}</span>
                          {t.description && <span className="block font-body text-[12px] text-muted-foreground">{t.description}</span>}
                        </span>
                        <span className="shrink-0 font-body text-[11px] font-semibold text-muted-foreground">
                          {st === "completed" ? "הושלם" : st === "in_progress" ? "בתהליך" : `${t.estimated_hours} ש׳`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 font-body text-[11px] text-muted-foreground">לחיצה על נושא: לא התחיל ← בתהליך ← הושלם</p>
            </>
          )}
        </Panel>
      )}

      {tab === "grades" && (
        <Panel title="ציונים" icon={<GraduationCap className="h-4 w-4" />}>
          {gradeRows.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">אין עדיין משימות או מבחנים עם ציונים.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {gradeRows.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-[14px] font-bold">{a.title}</p>
                    <p className="font-body text-[11.5px] font-semibold text-muted-foreground">
                      {a.due_date ? fmtDate(a.due_date) + " · " : ""}הוגשו {a.submitted}/{studentCount} · נבדקו {a.graded}
                    </p>
                  </div>
                  <span className="w-12 shrink-0 text-center font-heading text-[18px] font-black">{a.avg != null ? Math.round(a.avg) : "—"}</span>
                </li>
              ))}
            </ul>
          )}
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/dashboard/teacher-grades")}>להזנת ציונים</Button>
        </Panel>
      )}

      {tab === "homework" && (
        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <Panel title="שיעורי בית חדשים" icon={<Plus className="h-4 w-4" />}>
            <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); addHomework(); }}>
              <Input value={hw.title} onChange={(e) => setHw({ ...hw, title: e.target.value })} placeholder="מה להכין? למשל: עמ׳ 42 תרגילים 1–6" className="text-sm" />
              <Textarea value={hw.description} onChange={(e) => setHw({ ...hw, description: e.target.value })} placeholder="פירוט (לא חובה)" className="min-h-[70px] text-sm" />
              <label className="flex items-center gap-2 font-body text-[12.5px] font-semibold text-muted-foreground">
                להגשה עד
                <Input type="date" value={hw.due} min={ymd(new Date())} onChange={(e) => setHw({ ...hw, due: e.target.value })} className="h-9 w-auto text-sm" />
              </label>
              <Button type="submit" disabled={!hw.title.trim() || savingHw}>{savingHw ? "שומר…" : "שליחה לכיתה"}</Button>
            </form>
          </Panel>
          <Panel title="שיעורי בית שהוזנו" icon={<FileText className="h-4 w-4" />}>
            {homework.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground">לא הוזנו שיעורי בית.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {homework.map((a) => {
                  const n = subs.filter((s) => s.assignment_id === a.id && s.status !== "draft").length;
                  const late = a.due_date && new Date(a.due_date) < new Date();
                  return (
                    <li key={a.id} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="flex-1 truncate font-heading text-[14px] font-bold">{a.title}</p>
                        {a.due_date && (
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-body text-[10.5px] font-bold", late ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                            {fmtDate(a.due_date)}
                          </span>
                        )}
                      </div>
                      {a.description && <p className="line-clamp-2 font-body text-[12px] text-muted-foreground">{a.description}</p>}
                      <p className="font-body text-[11px] font-semibold text-muted-foreground">הוגשו {n}/{studentCount}{a.published ? "" : " · טיוטה"}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === "spaces" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {spaces.map((s, i) => (
            <button
              key={s.to}
              type="button"
              onClick={() => navigate(s.to)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-[18px] border-[2.5px] border-white bg-card p-4 text-right shadow-[0_8px_18px_-12px_rgba(27,35,51,0.5)] transition-transform hover:-translate-y-0.5 dark:border-card",
                i % 3 === 1 ? "rotate-[0.6deg]" : i % 3 === 2 ? "-rotate-[0.6deg]" : "",
              )}
            >
              <span className="grid h-10 w-10 place-items-center rounded-[13px] text-white" style={{ background: color }}>
                <s.icon className="h-5 w-5" />
              </span>
              <span className="font-heading text-[14px] font-extrabold">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-heading text-[15px] font-black text-foreground">
        <span className="text-muted-foreground">{icon}</span>{title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-3">
      <p className="font-heading text-[22px] font-black leading-none">{value}</p>
      <p className="mt-1 font-body text-[11px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

export default TeacherSubjectsPage;
