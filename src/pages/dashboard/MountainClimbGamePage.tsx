import { useState, useEffect, useRef } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Mountain, Loader2, ChevronLeft, PlayCircle, RotateCcw, CheckCircle2, XCircle,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAssignmentRules, shuffleArray, hasExistingAttempt, getNextAttemptNumber,
  startFocusGuard, type AssignmentRules, type FocusGuardHandle,
} from "@/lib/assignmentRules";

const DEFAULT_GAME_RULES: AssignmentRules = {
  lockDevice: false, lockDurationMinutes: null, shuffleQuestions: false,
  shuffleOptions: false, oneAttempt: false, dataHookAutoGrade: true,
};

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

const isMatch = (a: string, b: string) => a.trim().toLowerCase() === (b || "").trim().toLowerCase();

const MountainClimbGamePage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Config from the teacher's Mountain Climb settings (assignments.description)
  const [stages, setStages] = useState(5);
  const [questionsPerStage, setQuestionsPerStage] = useState(3);
  const [timePerQuestion, setTimePerQuestion] = useState(30);

  const [gameStarted, setGameStarted] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [timer, setTimer] = useState(30);
  const [gameOver, setGameOver] = useState(false);
  const [textAnswer, setTextAnswer] = useState("");

  const [rules, setRules] = useState<AssignmentRules>(DEFAULT_GAME_RULES);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [focusViolations, setFocusViolations] = useState(0);
  const focusGuardRef = useRef<FocusGuardHandle | null>(null);

  const stopFocusGuard = () => {
    focusGuardRef.current?.stop();
    focusGuardRef.current = null;
  };
  useEffect(() => () => stopFocusGuard(), []);

  useEffect(() => {
    const load = async () => {
      if (!assignmentId) return;
      setLoading(true);
      const [aRes, qRes, assignmentRules, attempted] = await Promise.all([
        supabase.from("assignments").select("id,title,subject,description").eq("id", assignmentId).single(),
        supabase.from("task_questions").select("*").eq("assignment_id", assignmentId).order("order_num"),
        fetchAssignmentRules(assignmentId),
        hasExistingAttempt(assignmentId, profile.id),
      ]);
      setAssignment(aRes.data);

      let config = { stages: 5, questionsPerStage: 3, timePerQuestion: 30 };
      try {
        const parsed = JSON.parse(aRes.data?.description || "");
        if (parsed?.game === "mountain-climb") {
          config = {
            stages: parsed.stages || 5,
            questionsPerStage: parsed.questionsPerStage || 3,
            timePerQuestion: parsed.timePerQuestion || 30,
          };
        }
      } catch { /* not a mountain-climb payload, use defaults */ }
      setStages(config.stages);
      setQuestionsPerStage(config.questionsPerStage);
      setTimePerQuestion(config.timePerQuestion);
      setTimer(config.timePerQuestion);

      let loadedQuestions = (qRes.data || []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }));
      // Unlike the Snakes & Ladders board (which picks a random question per
      // turn), this game cycles through the question list in a fixed order,
      // so "shuffle questions" is meaningful here, not just "shuffle options".
      if (assignmentRules.shuffleQuestions) loadedQuestions = shuffleArray(loadedQuestions);
      if (assignmentRules.shuffleOptions) loadedQuestions = loadedQuestions.map(q => ({ ...q, options: shuffleArray(q.options) }));
      setQuestions(loadedQuestions);
      setRules(assignmentRules);
      setAlreadyAttempted(attempted);
      setLoading(false);
    };
    load();
  }, [assignmentId, profile.id]);

  // Per-question countdown - running out of time counts as a wrong answer
  useEffect(() => {
    if (!gameStarted || feedback || gameOver) return;
    if (timer <= 0) { handleAnswer(""); return; }
    const t = setTimeout(() => setTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, gameStarted, feedback, gameOver]);

  const currentQ = questions.length > 0 ? questions[currentQIdx % questions.length] : null;
  const stageProgress = stages > 0 ? currentStage / stages : 0;
  const totalQuestionsInClimb = stages * questionsPerStage;

  const startClimb = () => {
    setCurrentStage(0);
    setCurrentQIdx(0);
    setScore(0);
    setFeedback(null);
    setTimer(timePerQuestion);
    setGameOver(false);
    setTextAnswer("");
    setGameStarted(true);
    setGameStartedAt(Date.now());
    setFocusViolations(0);
    if (rules.lockDevice) focusGuardRef.current = startFocusGuard(setFocusViolations);
  };

  const handleAnswer = (answer: string) => {
    if (feedback || !currentQ) return;
    const correct = isMatch(answer, currentQ.correct_answer);
    setFeedback(correct ? "correct" : "wrong");
    if (correct) setScore(s => s + 1);

    setTimeout(() => {
      setFeedback(null);
      setTimer(timePerQuestion);
      setTextAnswer("");
      const nextQIdx = currentQIdx + 1;
      const qInStage = nextQIdx % questionsPerStage;
      setCurrentQIdx(nextQIdx);
      if (qInStage === 0) {
        const nextStage = currentStage + 1;
        if (nextStage >= stages) {
          setGameOver(true);
          saveScore();
        } else {
          setCurrentStage(nextStage);
        }
      }
    }, 1500);
  };

  const saveScore = async () => {
    if (!assignmentId) return;
    const pct = totalQuestionsInClimb > 0 ? Math.round((score / totalQuestionsInClimb) * 100) : 0;
    const violations = focusGuardRef.current?.getViolationCount() ?? focusViolations;
    stopFocusGuard();
    const timeSpentSeconds = gameStartedAt ? Math.round((Date.now() - gameStartedAt) / 1000) : null;
    const attemptNumber = await getNextAttemptNumber(assignmentId, profile.id);
    const grade = rules.dataHookAutoGrade ? pct : null;
    const gameResult = JSON.stringify({
      type: "mountain-climb",
      score: pct,
      correctAnswers: score,
      totalAnswers: totalQuestionsInClimb,
      stagesCompleted: stages,
      completedAt: new Date().toISOString(),
    });
    try {
      const { data: ex } = await supabase.from("submissions").select("id")
        .eq("assignment_id", assignmentId).eq("student_id", profile.id).maybeSingle();
      if (ex) {
        const { error } = await supabase.from("submissions").update({
          grade, status: "submitted" as any, submitted_at: new Date().toISOString(),
          content: gameResult, attempt_number: attemptNumber,
          time_spent_seconds: timeSpentSeconds, focus_violations: violations,
        }).eq("id", ex.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("submissions").insert({
          assignment_id: assignmentId, student_id: profile.id,
          grade, status: "submitted" as any, submitted_at: new Date().toISOString(),
          content: gameResult, attempt_number: attemptNumber,
          time_spent_seconds: timeSpentSeconds, focus_violations: violations,
        });
        if (error) throw error;
      }
      setAlreadyAttempted(true);
    } catch (e: any) {
      console.error("Failed to save mountain climb score:", e);
      toast({ title: "שגיאה בשמירת הציון", description: "הציון לא נשמר, נסה/י לרענן ולטפס שוב", variant: "destructive" });
    }
  };

  /* ════════════ LOADING / NO QUESTIONS ════════════ */
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (questions.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Mountain className="h-16 w-16 text-muted-foreground/20" />
      <p className="text-muted-foreground">אין שאלות במשימה זו</p>
      <Button variant="outline" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4 mr-1" />חזור
      </Button>
    </div>
  );

  /* ════════════ ALREADY ATTEMPTED ════════════ */
  if (!gameStarted && rules.oneAttempt && alreadyAttempted) return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Mountain className="h-6 w-6 text-success" />טיפוס על הר</h1>
          <p className="text-sm text-muted-foreground">{assignment?.title}</p>
        </div>
      </div>
      <div className="text-center py-16 space-y-2">
        <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <p className="font-heading font-medium">כבר טיפסת במשימה הזו</p>
        <p className="text-sm text-muted-foreground">המשימה מוגדרת לניסיון אחד בלבד — אי אפשר לנסות שוב.</p>
      </div>
    </motion.div>
  );

  /* ════════════ SETUP SCREEN ════════════ */
  if (!gameStarted) return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Mountain className="h-6 w-6 text-success" />טיפוס על הר</h1>
          <p className="text-sm text-muted-foreground">{assignment?.title} • {questions.length} שאלות</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative h-48 bg-muted flex items-end justify-center">
            <div className="absolute top-4 right-4 text-4xl">☀️</div>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-4xl">🏰</div>
            {Array.from({ length: stages }).map((_, i) => {
              const bottom = (i / stages) * 70 + 10;
              const left = 50 - i * 8;
              const width = 100 - i * 15;
              return (
                <div key={i} className="absolute" style={{ bottom: `${bottom}%`, left: `${left}%`, width: `${width}%`, height: "12px", backgroundColor: i % 2 === 0 ? "#4ade80" : "#86efac", borderRadius: "4px" }}>
                  <span className="absolute -top-5 right-2 text-[10px] font-bold text-muted-foreground">שלב {i + 1}</span>
                </div>
              );
            })}
            <div className="relative bottom-2 text-3xl z-10">🧗</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Card className="p-3"><p className="text-2xl font-bold text-primary">{stages}</p><p className="text-[10px] text-muted-foreground">שלבים</p></Card>
        <Card className="p-3"><p className="text-2xl font-bold text-warning">{timePerQuestion}s</p><p className="text-[10px] text-muted-foreground">לשאלה</p></Card>
        <Card className="p-3"><p className="text-2xl font-bold text-success">{totalQuestionsInClimb}</p><p className="text-[10px] text-muted-foreground">שאלות בטיפוס</p></Card>
      </div>

      <Button size="lg" className="w-full gap-3 font-heading" onClick={startClimb}>
        <PlayCircle className="h-5 w-5" />התחל טיפוס
      </Button>
    </motion.div>
  );

  /* ════════════ GAME SCREEN ════════════ */
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { if (confirm("לצאת מהטיפוס?")) navigate("/dashboard/tasks"); }}>
          <ChevronLeft className="h-4 w-4 mr-1" />יציאה
        </Button>
        {!gameOver && <Badge variant="outline">שלב {currentStage + 1}/{stages}</Badge>}
      </div>

      <div className="relative h-4 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 right-0 bg-success rounded-full"
          animate={{ width: `${Math.min(100, stageProgress * 100)}%` }}
          transition={{ type: "spring" }}
        />
        <span className="absolute right-2 top-0 bottom-0 flex items-center text-[10px] font-bold">{Math.round(stageProgress * 100)}%</span>
      </div>

      {gameOver ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-success/30 bg-success/5 text-center">
            <CardContent className="py-8 space-y-2">
              <div className="text-6xl mb-1">🏔️</div>
              <h3 className="font-heading font-bold text-xl">הגעת לפסגה!</h3>
              <p className="text-sm text-muted-foreground">ניקוד: {score} / {totalQuestionsInClimb}</p>
              {focusViolations > 0 && (
                <p className="text-[11px] text-warning">שימו לב: נרשמו {focusViolations} יציאות מהמסך במהלך הטיפוס</p>
              )}
              <div className="flex gap-3 justify-center pt-2">
                {!rules.oneAttempt && (
                  <Button className="gap-2 font-heading" onClick={startClimb}><RotateCcw className="h-4 w-4" />טפס שוב</Button>
                )}
                <Button variant="outline" className="gap-2 font-heading" onClick={() => navigate("/dashboard/tasks")}>
                  <ChevronLeft className="h-4 w-4" />חזור למשימות
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-1">הציון נשמר אוטומטית</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : currentQ && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">שאלה {(currentQIdx % questionsPerStage) + 1}/{questionsPerStage} בשלב</Badge>
              <Badge variant={timer < 10 ? "destructive" : "secondary"} className="text-sm font-bold">⏱ {timer}s</Badge>
            </div>
            <p className="font-heading font-bold leading-relaxed">{currentQ.question_text}</p>

            <AnimatePresence>
              {feedback && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className={`flex items-center gap-2 p-3 rounded-lg ${feedback === "correct" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {feedback === "correct" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  <span className="font-heading font-bold">{feedback === "correct" ? "נכון!" : `שגוי — ${currentQ.correct_answer}`}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {!feedback && (
              currentQ.question_type === "open" || currentQ.question_type === "fill_blank" ? (
                <div className="flex gap-2">
                  <Input placeholder="כתוב תשובה..." value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && textAnswer) handleAnswer(textAnswer); }}
                    className="font-heading" autoFocus />
                  <Button onClick={() => textAnswer && handleAnswer(textAnswer)} disabled={!textAnswer}>בדוק</Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(currentQ.question_type === "true_false" ? ["נכון", "לא נכון"] : currentQ.options).map((opt: string, i: number) => (
                    <Button key={i} variant="outline" className="text-xs h-auto py-2 text-right" onClick={() => handleAnswer(opt)}>
                      {String.fromCharCode(1488 + i)}. {opt}
                    </Button>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {!gameOver && <div className="text-center text-xs text-muted-foreground">ניקוד: {score}</div>}
    </div>
  );
};

export default MountainClimbGamePage;
