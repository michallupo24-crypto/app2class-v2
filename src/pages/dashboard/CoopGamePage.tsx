import { useState, useEffect, useRef } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Flame, Loader2, ChevronLeft, PlayCircle, RotateCcw, CheckCircle2, XCircle, Users,
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

const CoopGamePage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assignment, setAssignment] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [fireName, setFireName] = useState("בן האש");
  const [waterName, setWaterName] = useState("בת המים");
  const [gameStarted, setGameStarted] = useState(false);

  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [fireScore, setFireScore] = useState(0);
  const [waterScore, setWaterScore] = useState(0);
  const [activePlayer, setActivePlayer] = useState<"fire" | "water">("fire");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
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

      let loadedQuestions = (qRes.data || []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }));
      // Fixed turn order alternating fire/water through the question list (not
      // a random per-turn pick like the Snakes & Ladders board), so shuffling
      // the question order is meaningful here too.
      if (assignmentRules.shuffleQuestions) loadedQuestions = shuffleArray(loadedQuestions);
      if (assignmentRules.shuffleOptions) loadedQuestions = loadedQuestions.map(q => ({ ...q, options: shuffleArray(q.options) }));
      setQuestions(loadedQuestions);
      setRules(assignmentRules);
      setAlreadyAttempted(attempted);
      setLoading(false);
    };
    load();
  }, [assignmentId, profile.id]);

  const currentQ = questions.length > 0 ? questions[currentQIdx] : null;

  const startGame = () => {
    setCurrentQIdx(0);
    setFireScore(0);
    setWaterScore(0);
    setActivePlayer("fire");
    setFeedback(null);
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
    if (correct) {
      if (activePlayer === "fire") setFireScore(s => s + 1);
      else setWaterScore(s => s + 1);
    }
    setTimeout(() => {
      setFeedback(null);
      setTextAnswer("");
      const nextIdx = currentQIdx + 1;
      if (nextIdx >= questions.length) {
        setGameOver(true);
        saveScore();
      } else {
        setCurrentQIdx(nextIdx);
        setActivePlayer(p => p === "fire" ? "water" : "fire");
      }
    }, 1500);
  };

  const saveScore = async () => {
    if (!assignmentId) return;
    const combined = fireScore + waterScore;
    const pct = questions.length > 0 ? Math.round((combined / questions.length) * 100) : 0;
    const violations = focusGuardRef.current?.getViolationCount() ?? focusViolations;
    stopFocusGuard();
    const timeSpentSeconds = gameStartedAt ? Math.round((Date.now() - gameStartedAt) / 1000) : null;
    const attemptNumber = await getNextAttemptNumber(assignmentId, profile.id);
    const grade = rules.dataHookAutoGrade ? pct : null;
    const gameResult = JSON.stringify({
      type: "coop-firewater",
      score: pct,
      fireScore, waterScore, combinedScore: combined,
      totalAnswers: questions.length,
      fireName, waterName,
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
      console.error("Failed to save coop fire/water score:", e);
      toast({ title: "שגיאה בשמירת הציון", description: "הציון לא נשמר, נסה/י לרענן ולשחק שוב", variant: "destructive" });
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
      <Flame className="h-16 w-16 text-muted-foreground/20" />
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
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Flame className="h-6 w-6 text-warning" />בן האש ובת המים</h1>
          <p className="text-sm text-muted-foreground">{assignment?.title}</p>
        </div>
      </div>
      <div className="text-center py-16 space-y-2">
        <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
        <p className="font-heading font-medium">כבר שיחקתם את המשימה הזו</p>
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
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Flame className="h-6 w-6 text-warning" />בן האש ובת המים</h1>
          <p className="text-sm text-muted-foreground">{assignment?.title} • {questions.length} שאלות</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-info/10 border border-info/20 text-xs text-info">
            <Users className="h-4 w-4 shrink-0" />
            <span>משחק זוגי מקומי — שני שחקנים על אותו מכשיר, מעבירים אותו ביניכם בכל תור.</span>
          </div>
          <div className="flex items-center justify-center gap-12 py-2">
            <div className="text-center"><span className="text-5xl">🔥</span></div>
            <div className="text-center"><span className="text-5xl">💧</span></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <Input value={fireName} onChange={e => setFireName(e.target.value)} placeholder="שם שחקן האש" className="font-heading text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">💧</span>
              <Input value={waterName} onChange={e => setWaterName(e.target.value)} placeholder="שם שחקן המים" className="font-heading text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full gap-3 font-heading" onClick={startGame}>
        <PlayCircle className="h-5 w-5" />התחילו לשחק
      </Button>
    </motion.div>
  );

  /* ════════════ GAME SCREEN ════════════ */
  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { if (confirm("לצאת מהמשחק?")) navigate("/dashboard/tasks"); }}>
          <ChevronLeft className="h-4 w-4 mr-1" />יציאה
        </Button>
        {!gameOver && (
          <Badge className={`${activePlayer === "fire" ? "bg-warning" : "bg-info"} text-white`}>
            {activePlayer === "fire" ? `🔥 תור ${fireName}` : `💧 תור ${waterName}`}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className={`p-3 text-center ${activePlayer === "fire" && !gameOver ? "ring-2 ring-warning" : ""}`}>
          <p className="text-2xl">🔥</p><p className="text-xs font-heading truncate">{fireName}</p><p className="font-bold">{fireScore}</p>
        </Card>
        <Card className={`p-3 text-center ${activePlayer === "water" && !gameOver ? "ring-2 ring-info" : ""}`}>
          <p className="text-2xl">💧</p><p className="text-xs font-heading truncate">{waterName}</p><p className="font-bold">{waterScore}</p>
        </Card>
      </div>

      {gameOver ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="text-center border-success/30 bg-success/5">
            <CardContent className="py-8 space-y-2">
              <div className="text-5xl mb-1">{fireScore >= waterScore ? "🔥" : "💧"}🏆</div>
              <h3 className="font-heading font-bold text-lg">המשחק הסתיים!</h3>
              <p className="text-sm text-muted-foreground">ניקוד משותף: {fireScore + waterScore} / {questions.length}</p>
              {focusViolations > 0 && (
                <p className="text-[11px] text-warning">שימו לב: נרשמו {focusViolations} יציאות מהמסך במהלך המשחק</p>
              )}
              <div className="flex gap-3 justify-center pt-2">
                {!rules.oneAttempt && (
                  <Button className="gap-2 font-heading" onClick={startGame}><RotateCcw className="h-4 w-4" />שחקו שוב</Button>
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
            <Badge variant="outline" className="text-xs">{currentQIdx + 1} / {questions.length}</Badge>
            <p className="font-heading font-bold leading-relaxed">{currentQ.question_text}</p>

            <AnimatePresence>
              {feedback && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
    </div>
  );
};

export default CoopGamePage;
