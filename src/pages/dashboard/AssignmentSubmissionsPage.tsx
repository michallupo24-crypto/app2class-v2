import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight, CheckCircle2, ChevronDown, Clock, FileText, Loader2, Save, ShieldAlert, Sparkles, Wand2, XCircle,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { openStoredFile } from "@/lib/privateFiles";
import { parseQuizAnswers, type QuizAnswer } from "@/lib/quizAnswers";
import { displayName } from "@/lib/displayName";

// Per-assignment submissions view: who submitted, auto score, time on task and
// what they answered, with a manual grade override. Replaces sending the
// teacher straight into manual grade entry, which hid all of that for
// auto-graded quizzes and interactive tasks.

const TYPE_LABELS: Record<string, string> = {
  homework: "שיעורי בית", exam: "מבחן", quiz: "בוחן", project: "פרויקט", exercise: "תרגיל",
};

type RowStatus = "graded" | "submitted" | "revision" | "in_progress" | "missing";

const STATUS_META: Record<RowStatus, { label: string; className: string }> = {
  graded: { label: "נבדק", className: "bg-success/15 text-success border-success/30" },
  submitted: { label: "הוגש", className: "bg-primary/10 text-primary border-primary/30" },
  revision: { label: "לתיקון", className: "bg-warning/15 text-warning border-warning/30" },
  in_progress: { label: "בתהליך", className: "bg-muted text-muted-foreground" },
  missing: { label: "לא הוגש", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface Assignment {
  id: string; title: string; type: string; subject: string; maxGrade: number;
  dueDate: string | null; classId: string; classLabel: string;
}

interface Row {
  studentId: string;
  name: string;
  status: RowStatus;
  submissionId: string | null;
  grade: number | null;
  autoGraded: boolean;
  feedback: string | null;
  submittedAt: string | null;
  late: boolean;
  timeSpentSeconds: number | null;
  attemptNumber: number | null;
  focusViolations: number;
  fileUrl: string | null;
  quizAnswers: QuizAnswer[] | null;
  /** Free-text content: a written answer or a student's code (solve mode). */
  textContent: string | null;
  /** Saved state from an interactive task (App2Class.saveState). */
  taskState: unknown;
  taskScore: { score: number; total: number } | null;
}

const formatDuration = (s: number | null) => {
  if (s == null) return "—";
  if (s < 60) return `${s} שנ׳`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} דק׳` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} שע׳`;
};

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const AssignmentSubmissionsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [hasInteractiveTask, setHasInteractiveTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "missing">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!assignmentId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data: a, error: aErr } = await supabase.from("assignments")
        .select("id, title, type, subject, max_grade, due_date, class_id, classes(grade, class_number)")
        .eq("id", assignmentId).maybeSingle();
      if (aErr) throw aErr;
      if (!a) { setError("המשימה לא נמצאה או שאין לך הרשאה לצפות בה"); return; }
      const cls = (a as any).classes;
      const asg: Assignment = {
        id: a.id, title: a.title, type: a.type, subject: a.subject, maxGrade: a.max_grade || 100,
        dueDate: a.due_date, classId: a.class_id, classLabel: cls ? `${cls.grade}'${cls.class_number}` : "",
      };
      setAssignment(asg);

      const [{ data: students, error: sErr }, { data: subs, error: subErr }, { count: qCount }, { data: task }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, display_name").eq("class_id", asg.classId).order("full_name"),
        supabase.from("submissions")
          .select("id, student_id, grade, status, feedback, content, file_url, attempt_number, time_spent_seconds, focus_violations, submitted_at, graded_by")
          .eq("assignment_id", asg.id),
        supabase.from("task_questions").select("id", { count: "exact", head: true }).eq("assignment_id", asg.id),
        supabase.from("interactive_tasks").select("id").eq("assignment_id", asg.id).maybeSingle(),
      ]);
      if (sErr) throw sErr;
      if (subErr) throw subErr;
      setQuestionCount(qCount ?? 0);
      setHasInteractiveTask(!!task);

      const { data: progress } = task
        ? await supabase.from("interactive_task_progress")
            .select("student_id, score, total, state, status, time_spent_seconds, submitted_at").eq("task_id", task.id)
        : { data: [] as any[] };

      const subBy = new Map((subs || []).map((s: any) => [s.student_id, s]));
      const progBy = new Map((progress || []).map((p: any) => [p.student_id, p]));
      // due_date is saved from a date-only picker as midnight at the start of that
      // day, but "הגשה עד 14.10" means by the end of the 14th.
      const due = asg.dueDate ? new Date(asg.dueDate).getTime() + 24 * 60 * 60 * 1000 : null;

      setRows((students || []).map((st: any): Row => {
        const sub: any = subBy.get(st.id);
        const prog: any = progBy.get(st.id);
        const submittedAt = sub?.submitted_at ?? prog?.submitted_at ?? null;
        const isSubmitted = sub?.status === "submitted" || sub?.status === "revised";
        const status: RowStatus =
          sub?.status === "graded" ? "graded"
          : isSubmitted ? "submitted"
          : sub?.status === "revision_needed" ? "revision"
          : sub || prog ? "in_progress"
          : "missing";
        const quizAnswers = parseQuizAnswers(sub?.content);
        let textContent: string | null = null;
        if (sub?.content && !quizAnswers) {
          try { JSON.parse(sub.content); } catch { textContent = sub.content; }
        }
        return {
          studentId: st.id, name: displayName(st), status,
          submissionId: sub?.id ?? null,
          grade: sub?.grade ?? null,
          autoGraded: sub?.grade != null && !sub?.graded_by,
          feedback: sub?.feedback ?? null,
          submittedAt,
          late: !!(due && submittedAt && new Date(submittedAt).getTime() > due),
          timeSpentSeconds: sub?.time_spent_seconds ?? prog?.time_spent_seconds ?? null,
          attemptNumber: sub?.attempt_number ?? null,
          focusViolations: sub?.focus_violations ?? 0,
          fileUrl: sub?.file_url ?? null,
          quizAnswers,
          textContent,
          taskState: prog?.state ?? null,
          taskScore: prog?.score != null ? { score: prog.score, total: prog.total || 100 } : null,
        };
      }));
      setEdits({});
    } catch (e: any) {
      setError(e.message || "שגיאה בטעינת ההגשות");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [assignmentId]);

  const stats = useMemo(() => {
    const done = rows.filter((r) => r.status === "submitted" || r.status === "graded");
    const graded = rows.filter((r) => r.grade != null);
    const times = rows.map((r) => r.timeSpentSeconds).filter((t): t is number => t != null && t > 0);
    const max = assignment?.maxGrade || 100;
    return {
      submitted: done.length,
      total: rows.length,
      avg: graded.length ? Math.round(graded.reduce((s, r) => s + (r.grade! / max) * 100, 0) / graded.length) : null,
      avgTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
      toCheck: rows.filter((r) => r.status === "submitted" && r.grade == null).length,
    };
  }, [rows, assignment]);

  const visible = rows.filter((r) =>
    filter === "all" ? true
    : filter === "submitted" ? r.status === "submitted" || r.status === "graded"
    : r.status === "missing" || r.status === "in_progress" || r.status === "revision");

  const editFor = (r: Row) => edits[r.studentId] ?? { grade: r.grade?.toString() ?? "", feedback: r.feedback?.startsWith("[ערעור") ? "" : (r.feedback ?? "") };

  const saveOverride = async (r: Row) => {
    if (!assignment) return;
    const edit = editFor(r);
    const gradeNum = parseInt(edit.grade);
    if (isNaN(gradeNum)) { toast({ title: "יש להזין ציון מספרי", variant: "destructive" }); return; }
    // Bonuses can legitimately exceed the max; only a likely typo asks first.
    if ((gradeNum < 0 || gradeNum > assignment.maxGrade * 1.5)
      && !window.confirm(`הציון ${gradeNum} חריג (מקסימום ${assignment.maxGrade}). לשמור בכל זאת?`)) return;
    setSavingId(r.studentId);
    const now = new Date().toISOString();
    const { error: saveErr } = r.submissionId
      ? await supabase.from("submissions").update({
          grade: gradeNum, feedback: edit.feedback || null, status: "graded" as any, graded_by: profile.id, graded_at: now,
        }).eq("id", r.submissionId)
      : await supabase.from("submissions").insert({
          assignment_id: assignment.id, student_id: r.studentId, grade: gradeNum, feedback: edit.feedback || null,
          status: "graded" as any, graded_by: profile.id, graded_at: now, submitted_at: now,
        });
    setSavingId(null);
    if (saveErr) { toast({ title: "הציון לא נשמר", description: saveErr.message, variant: "destructive" }); return; }
    toast({ title: `הציון של ${r.name} נשמר` });
    load(true);
  };

  // Rows arrive after the header data, so wait for both rather than flashing "no students".
  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (error || !assignment) {
    return (
      <Card><CardContent className="py-12 text-center space-y-3">
        <p className="text-muted-foreground font-body">{error || "המשימה לא נמצאה"}</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/teacher-assignments")}>חזרה למשימות</Button>
      </CardContent></Card>
    );
  }

  const isQuestionType = ["quiz", "exam", "exercise"].includes(assignment.type);
  const noContent = isQuestionType && questionCount === 0 && !hasInteractiveTask;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/teacher-assignments")} aria-label="חזרה למשימות">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[assignment.type] ?? assignment.type}</Badge>
              <h1 className="text-2xl font-heading font-bold">{assignment.title}</h1>
            </div>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {assignment.subject} · {assignment.classLabel}
              {assignment.dueDate && <> · הגשה עד {new Date(assignment.dueDate).toLocaleDateString("he-IL")}</>}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"
          onClick={() => navigate("/dashboard/teacher-grades", { state: { classId: assignment.classId, assignmentId: assignment.id } })}>
          <FileText className="h-4 w-4" /> יומן ציונים
        </Button>
      </div>

      {noContent && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-body">ל{TYPE_LABELS[assignment.type]} הזה אין עדיין שאלות, אז לתלמידים אין מה לפתור.</p>
            <Button size="sm" className="gap-1.5" onClick={() => navigate("/dashboard/task-studio", { state: { assignmentId: assignment.id } })}>
              <Wand2 className="h-4 w-4" /> הוסף שאלות בסטודיו
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="הגישו" value={`${stats.submitted}/${stats.total}`} />
        <StatCard label="ממוצע" value={stats.avg != null ? String(stats.avg) : "—"} />
        <StatCard label="זמן ממוצע" value={formatDuration(stats.avgTime)} />
        <StatCard label="ממתינים לבדיקה" value={String(stats.toCheck)} />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="grid grid-cols-3 w-full max-w-sm">
          <TabsTrigger value="all" className="font-heading">הכל ({rows.length})</TabsTrigger>
          <TabsTrigger value="submitted" className="font-heading">הוגשו ({stats.submitted})</TabsTrigger>
          <TabsTrigger value="missing" className="font-heading">חסרים ({rows.length - stats.submitted})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {visible.map((r) => {
          const open = expanded === r.studentId;
          const meta = STATUS_META[r.status];
          const edit = editFor(r);
          const pct = r.grade != null ? Math.round((r.grade / assignment.maxGrade) * 100) : null;
          return (
            <Card key={r.studentId} className={open ? "ring-1 ring-primary/30" : ""}>
              <button type="button" onClick={() => setExpanded(open ? null : r.studentId)} aria-expanded={open}
                className="w-full text-right px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-bold text-sm">{r.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                    {r.late && <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30">באיחור</Badge>}
                    {r.focusViolations > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-destructive/10 text-destructive border-destructive/30">
                        <ShieldAlert className="h-3 w-3" /> {r.focusViolations} יציאות מהמסך
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(r.timeSpentSeconds)}</span>
                    {r.submittedAt && <span>הוגש {formatDateTime(r.submittedAt)}</span>}
                    {r.attemptNumber != null && r.attemptNumber > 1 && <span>ניסיון {r.attemptNumber}</span>}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  {r.grade != null ? (
                    <div className="flex items-center gap-1.5">
                      {r.autoGraded && <Sparkles className="h-3.5 w-3.5 text-primary" aria-label="ציון אוטומטי" />}
                      <span className={`font-heading font-black text-xl ${pct! >= 85 ? "text-success" : pct! >= 55 ? "text-foreground" : "text-destructive"}`}>{r.grade}</span>
                      <span className="text-xs text-muted-foreground">/{assignment.maxGrade}</span>
                    </div>
                  ) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <CardContent className="pt-0 pb-4 space-y-4 border-t">
                  <AnswersSection row={r} />

                  <div className="rounded-lg bg-muted/40 p-3 space-y-2">
                    <p className="text-xs font-heading font-bold">
                      {r.autoGraded ? "עקיפת הציון האוטומטי" : r.grade != null ? "עדכון ציון" : "הזנת ציון"}
                    </p>
                    <div className="flex gap-2 items-start flex-wrap">
                      <Input type="number" dir="ltr" className="w-24" aria-label={`ציון עבור ${r.name}`}
                        value={edit.grade} placeholder={`0-${assignment.maxGrade}`}
                        onChange={(e) => setEdits((p) => ({ ...p, [r.studentId]: { ...edit, grade: e.target.value } }))} />
                      <Textarea rows={1} className="flex-1 min-w-[180px] min-h-10 resize-y text-sm" placeholder="משוב לתלמיד/ה (אופציונלי)"
                        value={edit.feedback}
                        onChange={(e) => setEdits((p) => ({ ...p, [r.studentId]: { ...edit, feedback: e.target.value } }))} />
                      <Button size="sm" className="gap-1.5 h-10" disabled={savingId === r.studentId} onClick={() => saveOverride(r)}>
                        {savingId === r.studentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} שמור
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
        {visible.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground font-body">
            {rows.length === 0 ? "אין תלמידים משויכים לכיתה הזו" : "אין תלמידים בסינון הזה"}
          </CardContent></Card>
        )}
      </div>
    </motion.div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <Card><CardContent className="py-3 px-4">
    <p className="text-xs text-muted-foreground font-body">{label}</p>
    <p className="text-xl font-heading font-black mt-0.5">{value}</p>
  </CardContent></Card>
);

const AnswersSection = ({ row: r }: { row: Row }) => {
  if (r.quizAnswers?.length) {
    const right = r.quizAnswers.filter((a) => a.correct).length;
    return (
      <div className="space-y-2 pt-3">
        <p className="text-xs font-heading font-bold">תשובות ({right}/{r.quizAnswers.length} נכונות)</p>
        <ol className="space-y-1.5">
          {r.quizAnswers.map((a, i) => (
            <li key={`${a.questionId}-${i}`} className={`rounded-lg border p-2.5 text-sm ${a.correct ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex items-start gap-2">
                {a.correct ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="font-heading font-semibold">{i + 1}. {a.questionText}</p>
                  <p className="text-xs mt-0.5">תשובת התלמיד/ה: <strong>{a.answer || "—"}</strong></p>
                  {!a.correct && <p className="text-xs text-muted-foreground">התשובה הנכונה: {a.correctAnswer}</p>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const blocks: JSX.Element[] = [];
  if (r.taskScore) {
    blocks.push(<p key="score" className="text-sm">ציון מהמשימה האינטראקטיבית: <strong>{r.taskScore.score}/{r.taskScore.total}</strong></p>);
  }
  if (r.taskState != null) {
    blocks.push(
      <details key="state" className="text-xs">
        <summary className="cursor-pointer font-heading font-bold">מצב שנשמר מהמשימה</summary>
        <pre dir="ltr" className="mt-1 max-h-60 overflow-auto rounded bg-muted p-2 text-left whitespace-pre-wrap">{JSON.stringify(r.taskState, null, 2)}</pre>
      </details>,
    );
  }
  if (r.textContent) {
    blocks.push(
      <div key="text">
        <p className="text-xs font-heading font-bold mb-1">התוכן שהוגש</p>
        <pre dir="auto" className="max-h-72 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{r.textContent}</pre>
      </div>,
    );
  }
  if (r.fileUrl) {
    blocks.push(
      <Button key="file" variant="outline" size="sm" className="gap-1.5" onClick={() => openStoredFile(r.fileUrl!)}>
        <FileText className="h-4 w-4" /> פתח קובץ מצורף
      </Button>,
    );
  }
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground pt-3">
        {r.status === "missing" ? "התלמיד/ה עוד לא התחיל/ה את המשימה." : "לא נשמרו תשובות מפורטות להגשה הזו (נשמר רק הציון)."}
      </p>
    );
  }
  return <div className="space-y-3 pt-3">{blocks}</div>;
};

export default AssignmentSubmissionsPage;
