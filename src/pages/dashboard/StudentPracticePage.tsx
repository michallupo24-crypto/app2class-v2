import { useState, useEffect, useRef } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight, ArrowLeft, CheckCircle2, XCircle, Layers, PlayCircle,
  BookOpen, Loader2, RotateCcw, Trophy, Brain, ChevronLeft, Gamepad2,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildSandboxHtml } from "@/components/task-studio/ide/sandboxBuilder";
import { StudentSolveEditor } from "@/components/task-studio/ide/StudentSolveEditor";
import type { TaskLanguage } from "@/components/task-studio/ide/types";
import { tierForAverage } from "@/lib/adaptiveTier";
import {
  fetchAssignmentRules, shuffleArray, hasExistingAttempt, getNextAttemptNumber,
  startFocusGuard, type AssignmentRules, type FocusGuardHandle,
} from "@/lib/assignmentRules";

const DEFAULT_PRACTICE_RULES: AssignmentRules = {
  lockDevice: false, lockDurationMinutes: null, shuffleQuestions: false,
  shuffleOptions: false, oneAttempt: false, dataHookAutoGrade: true,
};

interface Question {
  id: string;
  question_type: "multiple_choice" | "true_false" | "open" | "fill_blank" | "matching";
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  points: number;
  order_num: number;
  tier: "support" | "standard" | "challenge" | null;
  coaching_enabled: boolean;
}

interface MicroQuestion {
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
}

interface Assignment {
  id: string;
  title: string;
  subject: string;
  type: string;
  description: string | null;
}

type PracticeMode = "quiz" | "flashcards" | "open";

const StudentPracticePage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PracticeMode>("quiz");
  const [started, setStarted] = useState(false);

  // Quiz state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Flashcard state
  const [flipped, setFlipped] = useState(false);
  const [fcIdx, setFcIdx] = useState(0);

  // Open answer state
  const [openAnswer, setOpenAnswer] = useState("");
  const [openFeedback, setOpenFeedback] = useState<string | null>(null);
  const [checkingOpen, setCheckingOpen] = useState(false);

  // Shuffle questions on start
  const [shuffled, setShuffled] = useState<Question[]>([]);

  // AI misconception coach: shown inline after a wrong answer on a
  // coaching_enabled question, before the student can move on.
  const [coach, setCoach] = useState<{ misconception: string; explanation: string; microQuestion: MicroQuestion } | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachAnswered, setCoachAnswered] = useState<string | null>(null);
  const [coachRowId, setCoachRowId] = useState<string | null>(null);

  // Interactive-task mini-app state (teacher-built page from Task Studio, via interactive_tasks
  // or the legacy JSON-in-description "blank-html" format)
  const [htmlCode, setHtmlCode] = useState<string | null>(null);
  const [htmlResult, setHtmlResult] = useState<{ score: number; total: number } | null>(null);
  const [interactiveTaskId, setInteractiveTaskId] = useState<string | null>(null);

  // Solve-mode: student writes real code as their answer (CS assignments)
  const [solveTask, setSolveTask] = useState<{ starterCode: string; savedCode: string | null; instructions: string; submitted: boolean } | null>(null);
  const [solveSaving, setSolveSaving] = useState(false);

  const [rules, setRules] = useState<AssignmentRules>(DEFAULT_PRACTICE_RULES);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const [practiceStartedAt, setPracticeStartedAt] = useState<number | null>(null);
  const [focusViolations, setFocusViolations] = useState(0);
  const focusGuardRef = useRef<FocusGuardHandle | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!assignmentId) return;
      setLoading(true);
      const [assignRes, questRes] = await Promise.all([
        supabase.from("assignments").select("id, title, subject, type, description").eq("id", assignmentId).single(),
        supabase.from("task_questions").select("*").eq("assignment_id", assignmentId).order("order_num"),
      ]);
      setAssignment(assignRes.data);
      let loadedQuestions: Question[] = (questRes.data || []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }));

      // Adaptive tiers: route this student to only their tier + any untiered
      // questions, based on their own past average in this subject.
      const hasTiers = loadedQuestions.some((q) => q.tier != null);
      if (hasTiers && assignRes.data?.subject) {
        const { data: pastGrades } = await supabase
          .from("submissions")
          .select("grade, assignments!inner(subject)")
          .eq("student_id", profile.id)
          .eq("assignments.subject", assignRes.data.subject)
          .not("grade", "is", null);
        const grades = (pastGrades || []).map((s: any) => s.grade);
        const avg = grades.length > 0 ? grades.reduce((a: number, b: number) => a + b, 0) / grades.length : null;
        const myTier = tierForAverage(avg);
        loadedQuestions = loadedQuestions.filter((q) => q.tier == null || q.tier === myTier);
      }
      setQuestions(loadedQuestions);

      const [assignmentRules, attempted] = await Promise.all([
        fetchAssignmentRules(assignmentId),
        hasExistingAttempt(assignmentId, profile.id),
      ]);
      setRules(assignmentRules);
      setAlreadyAttempted(attempted);

      // 1. Real interactive_tasks row (Task IDE builder)
      const { data: task } = await supabase
        .from("interactive_tasks")
        .select("*")
        .eq("assignment_id", assignmentId)
        .maybeSingle();

      if (task) {
        const { data: progress } = await supabase
          .from("interactive_task_progress")
          .select("*")
          .eq("task_id", task.id)
          .eq("student_id", profile.id)
          .maybeSingle();

        setInteractiveTaskId(task.id);

        if (task.mode === "solve") {
          const savedCode = (progress?.state as any)?.code;
          setSolveTask({
            starterCode: task.python_code || "",
            savedCode: typeof savedCode === "string" ? savedCode : null,
            instructions: task.description || "",
            submitted: progress?.status === "submitted",
          });
        } else {
          if (progress?.status === "submitted" && progress.score != null && progress.total != null) {
            setHtmlResult({ score: progress.score, total: progress.total });
          }
          setHtmlCode(buildSandboxHtml({
            language: task.language as TaskLanguage,
            htmlCode: task.html_code,
            cssCode: task.css_code,
            jsCode: task.js_code,
            pythonCode: task.python_code,
            libraries: task.libraries || [],
            initialState: (progress?.state as Record<string, any>) || undefined,
          }));
        }
      } else {
        // 2. Legacy JSON-in-description "blank-html" format
        try {
          const parsed = JSON.parse(assignRes.data?.description || "");
          if (parsed?.type === "blank-html" && typeof parsed.code === "string") {
            setHtmlCode(parsed.code);
          }
        } catch { /* description isn't a blank-html payload, ignore */ }
      }

      setLoading(false);
    };
    load();
  }, [assignmentId, profile.id]);

  // Listen for the postMessage contract the sandboxed task page speaks:
  // score / state-save / time-tick (see src/components/task-studio/ide/sandboxBuilder.ts)
  useEffect(() => {
    if (!htmlCode) return;
    let accumulatedSeconds = 0;

    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "score" && typeof data.score === "number") {
        const total = typeof data.total === "number" && data.total > 0 ? data.total : 100;
        setHtmlResult({ score: data.score, total });
        const pct = Math.round((data.score / total) * 100);

        try {
          const { data: existing } = await supabase.from("submissions")
            .select("id").eq("assignment_id", assignmentId).eq("student_id", profile.id).maybeSingle();
          if (existing) {
            const { error } = await supabase.from("submissions").update({ grade: pct, status: "submitted" as any, submitted_at: new Date().toISOString() }).eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("submissions").insert({
              assignment_id: assignmentId, student_id: profile.id,
              grade: pct, status: "submitted" as any, submitted_at: new Date().toISOString(),
            });
            if (error) throw error;
          }
          if (interactiveTaskId) {
            const { error } = await supabase.from("interactive_task_progress").upsert({
              task_id: interactiveTaskId, student_id: profile.id,
              score: data.score, total, status: "submitted",
              submitted_at: new Date().toISOString(), last_active_at: new Date().toISOString(),
            }, { onConflict: "task_id,student_id" });
            if (error) throw error;
          }
          toast({ title: "הציון נשמר!", description: `${data.score}/${total}` });
        } catch {
          toast({ variant: "destructive", title: "שגיאה בשמירת הציון", description: "הציון לא נשמר. בדוק/י את החיבור ונסה/י שוב." });
        }
        return;
      }

      if (data.type === "state-save" && interactiveTaskId) {
        try {
          await supabase.from("interactive_task_progress").upsert({
            task_id: interactiveTaskId, student_id: profile.id,
            state: data.state, last_active_at: new Date().toISOString(),
          }, { onConflict: "task_id,student_id" });
        } catch { /* best effort */ }
        return;
      }

      if (data.type === "time-tick" && interactiveTaskId && typeof data.seconds === "number") {
        accumulatedSeconds = data.seconds;
        try {
          await supabase.from("interactive_task_progress").upsert({
            task_id: interactiveTaskId, student_id: profile.id,
            time_spent_seconds: accumulatedSeconds, last_active_at: new Date().toISOString(),
          }, { onConflict: "task_id,student_id" });
        } catch { /* best effort */ }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [htmlCode, assignmentId, profile.id, interactiveTaskId, toast]);

  const handleSolveSaveDraft = async (code: string) => {
    if (!interactiveTaskId) return;
    try {
      await supabase.from("interactive_task_progress").upsert({
        task_id: interactiveTaskId, student_id: profile.id,
        state: { code }, last_active_at: new Date().toISOString(),
      }, { onConflict: "task_id,student_id" });
    } catch { /* best effort */ }
  };

  const handleSolveSubmit = async (code: string) => {
    if (!interactiveTaskId || !assignmentId) return;
    setSolveSaving(true);
    try {
      const { error: progressError } = await supabase.from("interactive_task_progress").upsert({
        task_id: interactiveTaskId, student_id: profile.id,
        state: { code }, status: "submitted",
        submitted_at: new Date().toISOString(), last_active_at: new Date().toISOString(),
      }, { onConflict: "task_id,student_id" });
      if (progressError) throw progressError;

      const { data: existing } = await supabase.from("submissions")
        .select("id").eq("assignment_id", assignmentId).eq("student_id", profile.id).maybeSingle();
      if (existing) {
        const { error: updateError } = await supabase.from("submissions").update({ status: "submitted" as any, submitted_at: new Date().toISOString(), content: code }).eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("submissions").insert({ assignment_id: assignmentId, student_id: profile.id, status: "submitted" as any, submitted_at: new Date().toISOString(), content: code });
        if (insertError) throw insertError;
      }

      setSolveTask((prev) => (prev ? { ...prev, submitted: true, savedCode: code } : prev));
      toast({ title: "הפתרון הוגש בהצלחה!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "שגיאה בהגשה", description: e.message });
    } finally {
      setSolveSaving(false);
    }
  };

  const handleSolveAutoScore = async (autoScore: number, autoTotal: number) => {
    if (!interactiveTaskId || !assignmentId) return;
    const pct = Math.round((autoScore / autoTotal) * 100);
    try {
      // Best-effort - the Task Studio analytics dashboard reads this separately,
      // so a failure here shouldn't block the gradebook write below.
      await supabase.from("interactive_task_progress").upsert({
        task_id: interactiveTaskId, student_id: profile.id,
        score: autoScore, total: autoTotal, last_active_at: new Date().toISOString(),
      }, { onConflict: "task_id,student_id" });

      // Same target the "consume" mode score handler writes to (see the
      // postMessage listener above) - without this, a student's auto-graded
      // code submission never reaches the teacher's actual gradebook, only
      // the separate Task Studio analytics dashboard. Unlike consume mode
      // (where the score message IS the completion signal), solve mode has
      // its own explicit submit step (handleSolveSubmit) - so only the grade
      // value is pre-filled here; status/submitted_at stay untouched (default
      // 'draft' on insert) until the student actually clicks "הגש".
      // This write is NOT best-effort: a silent failure here would show the
      // student a false "grade reported" toast while the teacher's gradebook
      // never receives it, so any error must surface instead of being swallowed.
      const { data: existing } = await supabase.from("submissions")
        .select("id").eq("assignment_id", assignmentId).eq("student_id", profile.id).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("submissions").update({ grade: pct }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("submissions").insert({ assignment_id: assignmentId, student_id: profile.id, grade: pct });
        if (error) throw error;
      }

      toast({ title: "הקוד שלך דיווח ציון", description: `${autoScore}/${autoTotal}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "שגיאה בשמירת הציון", description: e.message || "נסה/י שוב, או פנה/י למורה אם זה חוזר על עצמו." });
    }
  };

  const startPractice = () => {
    let q = rules.shuffleQuestions ? shuffleArray(questions) : [...questions];
    if (rules.shuffleOptions) q = q.map((question) => ({ ...question, options: shuffleArray(question.options) }));
    setShuffled(q);
    setCurrentIdx(0);
    setScore(0);
    setFinished(false);
    setSelected(null);
    setAnswered(false);
    setWrongIds([]);
    setFlipped(false);
    setFcIdx(0);
    setOpenAnswer("");
    setOpenFeedback(null);
    setSaveStatus("idle");
    setCoach(null);
    setCoachAnswered(null);
    setCoachRowId(null);
    setStarted(true);
    setPracticeStartedAt(Date.now());
    setFocusViolations(0);
    if (rules.lockDevice) focusGuardRef.current = startFocusGuard(setFocusViolations);
  };

  const stopPracticeFocusGuard = () => {
    focusGuardRef.current?.stop();
    focusGuardRef.current = null;
  };

  useEffect(() => () => stopPracticeFocusGuard(), []);

  const currentQ = shuffled[currentIdx];
  const progress = shuffled.length > 0 ? ((currentIdx) / shuffled.length) * 100 : 0;

  const handleAnswer = async (ans: string) => {
    if (answered) return;
    setSelected(ans);
    setAnswered(true);
    const isCorrect = ans.trim().toLowerCase() === (currentQ?.correct_answer || "").trim().toLowerCase();
    setCorrect(isCorrect);
    if (isCorrect) setScore(s => s + 1);
    else {
      setWrongIds(prev => [...prev, currentQ.id]);
      if (currentQ.coaching_enabled) await diagnoseMisconception(ans);
    }
  };

  const diagnoseMisconception = async (studentAnswer: string) => {
    setCoachLoading(true);
    setCoachAnswered(null);
    try {
      const { data } = await supabase.functions.invoke("task-studio-ai", {
        body: {
          action: "diagnose-misconception",
          subject: assignment?.subject,
          questionText: currentQ.question_text,
          questionType: currentQ.question_type,
          options: currentQ.options,
          correctAnswer: currentQ.correct_answer,
          studentAnswer,
        },
      });
      const result = data?.result;
      if (result?.misconception && result?.microQuestion) {
        setCoach(result);
        const { data: row } = await supabase.from("question_misconceptions").insert({
          question_id: currentQ.id,
          assignment_id: assignmentId,
          student_id: profile.id,
          student_answer: studentAnswer,
          misconception_label: result.misconception,
        }).select("id").single();
        setCoachRowId(row?.id || null);
      }
    } catch {
      // best effort - student still sees the normal "wrong answer" feedback below
    } finally {
      setCoachLoading(false);
    }
  };

  const handleCoachAnswer = async (ans: string) => {
    if (coachAnswered || !coach) return;
    setCoachAnswered(ans);
    const isCorrect = ans.trim().toLowerCase() === coach.microQuestion.correct_answer.trim().toLowerCase();
    if (isCorrect && coachRowId) {
      await supabase.from("question_misconceptions").update({ resolved: true }).eq("id", coachRowId);
    }
  };

  const nextQ = () => {
    setCoach(null);
    setCoachAnswered(null);
    setCoachRowId(null);
    if (currentIdx >= shuffled.length - 1) {
      setFinished(true);
      saveScore();
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
      setCorrect(false);
    }
  };

  const saveScore = async () => {
    if (!assignmentId) return;
    setSaveStatus("saving");
    const pct = Math.round((score / shuffled.length) * 100);
    const violations = focusGuardRef.current?.getViolationCount() ?? focusViolations;
    stopPracticeFocusGuard();
    const timeSpentSeconds = practiceStartedAt ? Math.round((Date.now() - practiceStartedAt) / 1000) : null;
    const attemptNumber = await getNextAttemptNumber(assignmentId, profile.id);
    const grade = rules.dataHookAutoGrade ? pct : null;
    try {
      const { data: existing } = await supabase.from("submissions")
        .select("id").eq("assignment_id", assignmentId).eq("student_id", profile.id).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("submissions").update({
          grade, status: "submitted" as any, submitted_at: new Date().toISOString(),
          attempt_number: attemptNumber, time_spent_seconds: timeSpentSeconds, focus_violations: violations,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("submissions").insert({
          assignment_id: assignmentId, student_id: profile.id,
          grade, status: "submitted" as any, submitted_at: new Date().toISOString(),
          attempt_number: attemptNumber, time_spent_seconds: timeSpentSeconds, focus_violations: violations,
        });
        if (error) throw error;
      }
      setSaveStatus("saved");
      setAlreadyAttempted(true);
    } catch {
      setSaveStatus("error");
      toast({ variant: "destructive", title: "שגיאה בשמירת הציון", description: "הציון לא נשמר. בדוק/י את החיבור ונסה/י שוב." });
    }
  };

  const checkOpenAnswer = async () => {
    if (!openAnswer.trim() || !currentQ) return;
    setCheckingOpen(true);
    try {
      const { data } = await supabase.functions.invoke("ai-tutor", {
        body: {
          message: `בדוק את התשובה הבאה לשאלה:\nשאלה: ${currentQ.question_text}\nתשובה נכונה: ${currentQ.correct_answer}\nתשובת התלמיד: ${openAnswer}\n\nתן פידבק קצר (2-3 משפטים) בעברית — האם צדק? מה חסר? מה טוב?`,
          context: "open_answer_check",
        },
      });
      setOpenFeedback(data?.message || "לא ניתן לבדוק כרגע");
    } catch {
      setOpenFeedback("לא ניתן לבדוק כרגע, נסה שוב");
    } finally {
      setCheckingOpen(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  // ── SOLVE MODE: student writes real code as their answer ───
  if (solveTask) {
    return (
      <div className="space-y-3 h-[calc(100vh-140px)] flex flex-col">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/tasks")}>
            <ChevronLeft className="h-4 w-4 mr-1" />יציאה
          </Button>
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-heading font-bold">{assignment?.title}</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <StudentSolveEditor
            starterCode={solveTask.starterCode}
            initialCode={solveTask.savedCode}
            instructions={solveTask.instructions}
            submitted={solveTask.submitted}
            saving={solveSaving}
            onRun={() => {}}
            onSaveDraft={handleSolveSaveDraft}
            onSubmit={handleSolveSubmit}
            onAutoScore={handleSolveAutoScore}
          />
        </div>
      </div>
    );
  }

  // ── BLANK-HTML MINI-APP (teacher-built via Task Studio) ───
  if (htmlCode) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/tasks")}>
            <ChevronLeft className="h-4 w-4 mr-1" />יציאה
          </Button>
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-heading font-bold">{assignment?.title}</span>
          </div>
        </div>

        {htmlResult && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-success/40 bg-success/5">
              <CardContent className="py-3 flex items-center justify-between">
                <p className="text-sm font-heading font-bold text-success">ציון נשמר: {htmlResult.score}/{htmlResult.total}</p>
                <Button size="sm" variant="outline" onClick={() => { setHtmlResult(null); const c = htmlCode; setHtmlCode(null); setTimeout(() => setHtmlCode(c), 0); }}>
                  <RotateCcw className="h-3.5 w-3.5 ml-1" /> נסה שוב
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Card className="overflow-hidden">
          <iframe
            key={htmlCode.length}
            srcDoc={htmlCode}
            className="w-full border-0"
            style={{ height: "70vh" }}
            // allow-scripts ONLY - never add allow-same-origin: this iframe renders
            // teacher/AI-authored HTML via srcDoc, which inherits the parent app's
            // real origin under allow-same-origin and could read the student's
            // Supabase auth token straight out of localStorage. Scoring already
            // travels via postMessage (handled above), which works cross-origin.
            sandbox="allow-scripts"
            title={assignment?.title || "משימה אינטראקטיבית"}
          />
        </Card>
      </div>
    );
  }

  if (!assignment || questions.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <BookOpen className="h-16 w-16 text-muted-foreground/20" />
      <p className="text-muted-foreground font-body">אין שאלות זמינות למשימה זו</p>
      <Button variant="outline" onClick={() => navigate("/dashboard/tasks")}>
        <ChevronLeft className="h-4 w-4 mr-1" />חזור למשימות
      </Button>
    </div>
  );

  // Finished screen
  if (finished && mode === "quiz") {
    const pct = Math.round((score / shuffled.length) * 100);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
        <div className="text-center space-y-4 py-8">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}>
            {pct >= 80
              ? <Trophy className="h-20 w-20 mx-auto text-warning" />
              : pct >= 60
              ? <CheckCircle2 className="h-20 w-20 mx-auto text-primary" />
              : <Brain className="h-20 w-20 mx-auto text-muted-foreground" />
            }
          </motion.div>
          <div>
            <p className="text-4xl font-heading font-bold text-primary">{pct}%</p>
            <p className="text-muted-foreground font-body mt-1">{score} מתוך {shuffled.length} נכונות</p>
          </div>
          <p className="text-lg font-heading">
            {pct >= 90 ? "מצוין! שלטת בחומר!" : pct >= 75 ? "עבודה טובה!" : pct >= 60 ? "לא רע, אפשר לשפר" : "כדאי לחזור על החומר"}
          </p>
          {pct < 100 && saveStatus === "saving" && (
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />שומר את הציון...
            </p>
          )}
          {pct < 100 && saveStatus === "saved" && (
            <p className="text-sm text-muted-foreground">הציון נשמר אוטומטית</p>
          )}
          {pct < 100 && saveStatus === "error" && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-destructive font-medium">הציון לא נשמר עקב שגיאה</p>
              <Button size="sm" variant="outline" className="gap-2" onClick={saveScore}>
                <RotateCcw className="h-3.5 w-3.5" />נסה לשמור שוב
              </Button>
            </div>
          )}
        </div>
        {focusViolations > 0 && (
          <p className="text-center text-[11px] text-warning">שימו לב: נרשמו {focusViolations} יציאות מהמסך בזמן התרגול</p>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          {!rules.oneAttempt && (
            <Button className="gap-2 font-heading" onClick={startPractice}>
              <RotateCcw className="h-4 w-4" />תרגל שוב
            </Button>
          )}
          {!rules.oneAttempt && wrongIds.length > 0 && (
            <Button variant="outline" className="gap-2 font-heading" onClick={() => {
              const wrong = questions.filter(q => wrongIds.includes(q.id));
              setShuffled(wrong);
              setCurrentIdx(0);
              setScore(0);
              setFinished(false);
              setSelected(null);
              setAnswered(false);
              setWrongIds([]);
            }}>
              <Brain className="h-4 w-4" />תרגל רק שגיאות ({wrongIds.length})
            </Button>
          )}
          {rules.oneAttempt && (
            <p className="text-xs text-muted-foreground">המשימה מוגדרת לניסיון אחד בלבד — אי אפשר לתרגל שוב.</p>
          )}
          <Button variant="ghost" className="gap-2 font-heading" onClick={() => navigate("/dashboard/tasks")}>
            <ChevronLeft className="h-4 w-4" />חזור
          </Button>
        </div>
      </motion.div>
    );
  }

  // Mode selector (before start)
  if (!started) {
    if (rules.oneAttempt && alreadyAttempted) {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/tasks")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-heading font-bold">{assignment.title}</h1>
              <p className="text-sm text-muted-foreground">{assignment.subject}</p>
            </div>
          </div>
          <div className="text-center py-16 space-y-2">
            <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="font-heading font-medium">כבר הגשת את המשימה הזו</p>
            <p className="text-sm text-muted-foreground">המשימה מוגדרת לניסיון אחד בלבד — אי אפשר לנסות שוב.</p>
          </div>
        </motion.div>
      );
    }
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/tasks")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-heading font-bold">{assignment.title}</h1>
            <p className="text-sm text-muted-foreground">{assignment.subject} • {questions.length} שאלות</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              id: "quiz" as PracticeMode,
              title: "מצב בוחן",
              desc: "שאלות אחת אחת עם ניקוד, פידבק מיידי וציון בסוף",
              icon: <PlayCircle className="h-8 w-8" />,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              id: "flashcards" as PracticeMode,
              title: "כרטיסיות שינון",
              desc: "העבר בין שאלות ותשובות, הפוך כרטיסייה להצגת תשובה",
              icon: <Layers className="h-8 w-8" />,
              color: "text-success",
              bg: "bg-success/10",
            },
            {
              id: "open" as PracticeMode,
              title: "תשובה חופשית + AI",
              desc: "כתוב תשובה בשפה חופשית, ה-AI יבדוק ויחזיר פידבק",
              icon: <Brain className="h-8 w-8" />,
              color: "text-accent",
              bg: "bg-accent/10",
            },
          ].map((m) => (
            <Card key={m.id}
              className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/40 ${mode === m.id ? "border-primary ring-1 ring-primary/30" : ""}`}
              onClick={() => setMode(m.id)}>
              <CardContent className="p-5 text-center space-y-3">
                <div className={`w-16 h-16 rounded-lg ${m.bg} flex items-center justify-center mx-auto ${m.color}`}>
                  {m.icon}
                </div>
                <div>
                  <p className="font-heading font-bold">{m.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-body">{m.desc}</p>
                </div>
                {mode === m.id && (
                  <Badge className="text-[10px]">נבחר ✓</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button size="lg" className="gap-3 font-heading px-8" onClick={startPractice}>
            <PlayCircle className="h-5 w-5" />
            התחל {mode === "quiz" ? "בוחן" : mode === "flashcards" ? "כרטיסיות" : "תרגול"} ({questions.length} שאלות)
          </Button>
        </div>
      </motion.div>
    );
  }

  // ── QUIZ MODE ──────────────────────────────────────────────
  if (mode === "quiz" && currentQ) {
    const isMultipleChoice = currentQ.question_type === "multiple_choice";
    const isTrueFalse = currentQ.question_type === "true_false";
    const options = isTrueFalse ? ["נכון", "לא נכון"] : (currentQ.options || []);

    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStarted(false)}>
            <ChevronLeft className="h-4 w-4 mr-1" />יציאה
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-body">{currentIdx + 1}/{shuffled.length}</span>
            <Badge variant="outline" className="gap-1 text-xs">
              <Trophy className="h-3 w-3" />{score} נקודות
            </Badge>
          </div>
        </div>

        <Progress value={progress} className="h-2" />

        <AnimatePresence mode="wait">
          <motion.div key={currentIdx} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
            <Card>
              <CardContent className="py-6">
                <p className="font-heading font-bold text-lg leading-relaxed">{currentQ.question_text}</p>
                {currentQ.points > 1 && (
                  <p className="text-xs text-muted-foreground mt-2">{currentQ.points} נקודות</p>
                )}
              </CardContent>
            </Card>

            {/* Options */}
            <div className="space-y-2">
              {(isMultipleChoice || isTrueFalse) && options.map((opt, i) => {
                const isSelected = selected === opt;
                const isCorrectOpt = opt.trim().toLowerCase() === (currentQ.correct_answer || "").trim().toLowerCase();
                let cls = "border-border hover:border-primary/50";
                if (answered) {
                  if (isCorrectOpt) cls = "border-success bg-success/10";
                  else if (isSelected) cls = "border-destructive bg-destructive/10";
                  else cls = "border-border opacity-50";
                } else if (isSelected) cls = "border-primary bg-primary/5";

                return (
                  <button key={i} className={`w-full text-right p-3 rounded-lg border transition-all ${cls} ${!answered ? "cursor-pointer" : "cursor-default"}`}
                    onClick={() => handleAnswer(opt)} disabled={answered}>
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-sm">{opt}</span>
                      {answered && isCorrectOpt && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                      {answered && isSelected && !isCorrectOpt && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                    </div>
                  </button>
                );
              })}

              {currentQ.question_type === "fill_blank" && (
                <div className="space-y-2">
                  <input type="text" placeholder="השלם את המשפט..." value={selected || ""}
                    onChange={e => setSelected(e.target.value)} disabled={answered}
                    className="w-full border rounded-lg p-3 font-heading text-sm bg-background"
                    onKeyDown={e => { if (e.key === "Enter" && !answered && selected) handleAnswer(selected); }} />
                  {!answered && (
                    <Button className="w-full font-heading" onClick={() => selected && handleAnswer(selected)} disabled={!selected}>
                      בדוק
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Feedback */}
            {answered && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <Card className={correct ? "border-success/50 bg-success/10" : "border-destructive/50 bg-destructive/10"}>
                  <CardContent className="py-3 space-y-1">
                    <p className={`font-heading font-bold text-sm ${correct ? "text-success" : "text-destructive"}`}>
                      {correct ? "נכון!" : `לא נכון — התשובה הנכונה: ${currentQ.correct_answer}`}
                    </p>
                    {currentQ.explanation && (
                      <p className="text-xs text-muted-foreground font-body">{currentQ.explanation}</p>
                    )}
                  </CardContent>
                </Card>

                {!correct && currentQ.coaching_enabled && coachLoading && (
                  <Card className="border-accent/30 bg-accent/10">
                    <CardContent className="py-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      <p className="text-xs font-body text-muted-foreground">מאמן ה-AI בודק מה בדיוק בלבל אותך...</p>
                    </CardContent>
                  </Card>
                )}

                {!correct && coach && (
                  <Card className="border-accent/40 bg-accent/10">
                    <CardContent className="py-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-accent shrink-0" />
                        <Badge variant="secondary" className="text-[10px] bg-accent/20 text-accent border-0">{coach.misconception}</Badge>
                      </div>
                      <p className="text-xs font-body leading-relaxed">{coach.explanation}</p>

                      <div className="pt-1 border-t border-accent/20 space-y-2">
                        <p className="text-xs font-heading font-bold">רגע לפני שממשיכים - נסה/י שוב:</p>
                        <p className="text-sm font-heading">{coach.microQuestion.question_text}</p>
                        <div className="flex flex-wrap gap-2">
                          {(coach.microQuestion.question_type === "true_false" ? ["נכון", "לא נכון"] : coach.microQuestion.options).map((opt, i) => {
                            const isSel = coachAnswered === opt;
                            const isRight = opt.trim().toLowerCase() === coach.microQuestion.correct_answer.trim().toLowerCase();
                            let cls = "border-border";
                            if (coachAnswered) cls = isRight ? "border-success bg-success/10" : isSel ? "border-destructive bg-destructive/10" : "border-border opacity-50";
                            return (
                              <button key={i} disabled={!!coachAnswered} onClick={() => handleCoachAnswer(opt)}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-heading ${cls} ${!coachAnswered ? "hover:border-accent cursor-pointer" : "cursor-default"}`}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {coachAnswered && (
                          <p className="text-xs font-body text-muted-foreground">
                            {coachAnswered.trim().toLowerCase() === coach.microQuestion.correct_answer.trim().toLowerCase() ? "בדיוק! עכשיו זה ברור." : `לא בדיוק - התשובה: ${coach.microQuestion.correct_answer}. בוא/י נמשיך.`}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!(!correct && currentQ.coaching_enabled && coachLoading) && (
                  <Button className="w-full font-heading" onClick={nextQ}>
                    {currentIdx >= shuffled.length - 1 ? "סיים וצפה בציון" : "שאלה הבאה"} <ArrowLeft className="h-4 w-4 mr-2" />
                  </Button>
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── FLASHCARDS MODE ───────────────────────────────────────
  if (mode === "flashcards") {
    const card = shuffled[fcIdx];
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStarted(false)}>
            <ChevronLeft className="h-4 w-4 mr-1" />יציאה
          </Button>
          <Badge variant="outline">{fcIdx + 1} / {shuffled.length}</Badge>
        </div>
        <Progress value={((fcIdx) / shuffled.length) * 100} className="h-2" />

        <AnimatePresence mode="wait">
          <motion.div key={fcIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="cursor-pointer" onClick={() => setFlipped(f => !f)} style={{ perspective: "1000px" }}>
              <motion.div
                className="relative w-full rounded-lg"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5 }}
                style={{ transformStyle: "preserve-3d", minHeight: "220px" }}
              >
                {/* Front */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 rounded-lg bg-primary/10 border-2 border-primary/20"
                  style={{ backfaceVisibility: "hidden" }}>
                  <p className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wide">שאלה</p>
                  <p className="text-lg font-heading font-bold text-center leading-relaxed">{card?.question_text}</p>
                  <p className="text-xs text-muted-foreground mt-4">לחץ להפוך ולראות תשובה</p>
                </div>
                {/* Back */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 rounded-lg bg-success/10 border-2 border-success/20"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <p className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wide">תשובה</p>
                  <p className="text-lg font-heading font-bold text-center leading-relaxed">{card?.correct_answer}</p>
                  {card?.explanation && (
                    <p className="text-xs text-muted-foreground mt-3 text-center">{card.explanation}</p>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between items-center pt-2">
          <Button variant="outline" onClick={() => { setFcIdx(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={fcIdx === 0}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex gap-2">
            {!flipped
              ? <Button variant="outline" className="font-heading" onClick={() => setFlipped(true)}>הצג תשובה</Button>
              : fcIdx < shuffled.length - 1
              ? <Button className="font-heading" onClick={() => { setFcIdx(i => i + 1); setFlipped(false); }}>הבא <ArrowLeft className="h-4 w-4 mr-1" /></Button>
              : <Button className="font-heading" onClick={() => setStarted(false)}>סיום</Button>
            }
          </div>
          <Button variant="outline" onClick={() => { setFcIdx(i => Math.min(shuffled.length - 1, i + 1)); setFlipped(false); }} disabled={fcIdx === shuffled.length - 1}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── OPEN ANSWER MODE ──────────────────────────────────────
  if (mode === "open" && currentQ) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStarted(false)}>
            <ChevronLeft className="h-4 w-4 mr-1" />יציאה
          </Button>
          <Badge variant="outline">{currentIdx + 1} / {shuffled.length}</Badge>
        </div>
        <Progress value={((currentIdx) / shuffled.length) * 100} className="h-2" />

        <AnimatePresence mode="wait">
          <motion.div key={currentIdx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card>
              <CardContent className="py-6">
                <p className="font-heading font-bold text-lg leading-relaxed">{currentQ.question_text}</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Textarea
                placeholder="כתב את תשובתך כאן..."
                value={openAnswer}
                onChange={e => { setOpenAnswer(e.target.value); setOpenFeedback(null); }}
                className="font-body text-sm min-h-28 resize-none"
                disabled={checkingOpen}
              />
              <div className="flex gap-2">
                <Button className="flex-1 gap-2 font-heading" onClick={checkOpenAnswer}
                  disabled={!openAnswer.trim() || checkingOpen}>
                  {checkingOpen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  {checkingOpen ? "ה-AI בודק..." : "בדוק עם AI"}
                </Button>
                <Button variant="outline" className="font-heading" onClick={() => {
                  setOpenAnswer(""); setOpenFeedback(null);
                  if (currentIdx < shuffled.length - 1) { setCurrentIdx(i => i + 1); }
                  else setStarted(false);
                }}>
                  {currentIdx < shuffled.length - 1 ? "דלג" : "סיים"}
                </Button>
              </div>
            </div>

            {openFeedback && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-accent/40 bg-accent/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-heading flex items-center gap-2 text-accent">
                      <Brain className="h-4 w-4" />פידבק AI
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm font-body text-muted-foreground leading-relaxed">{openFeedback}</p>
                    {currentQ.correct_answer && (
                      <div className="mt-3 p-2 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground font-heading">תשובה מקורית:</p>
                        <p className="text-sm font-body mt-1">{currentQ.correct_answer}</p>
                      </div>
                    )}
                    <Button className="w-full mt-3 font-heading" onClick={() => {
                      setOpenAnswer(""); setOpenFeedback(null);
                      if (currentIdx < shuffled.length - 1) setCurrentIdx(i => i + 1);
                      else setStarted(false);
                    }}>
                      {currentIdx < shuffled.length - 1 ? "שאלה הבאה" : "סיים"}
                      <ArrowLeft className="h-4 w-4 mr-1" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return null;
};

export default StudentPracticePage;
