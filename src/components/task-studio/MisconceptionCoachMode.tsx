import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GraduationCap, Sparkles, Loader2, Send, Trash2, Lightbulb } from "lucide-react";
import StudioModeWrapper from "./StudioModeWrapper";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  profile: UserProfile;
  assignmentId: string | null;
  onBack: () => void;
}

interface CoachQuestion {
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  explanation: string;
}

const MisconceptionCoachMode = ({ profile, assignmentId, onBack }: Props) => {
  const { toast } = useToast();
  const [assignmentInfo, setAssignmentInfo] = useState<{ subject: string; title: string } | null>(null);
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState("6");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [questions, setQuestions] = useState<CoachQuestion[] | null>(null);

  useEffect(() => {
    if (!assignmentId) { setAssignmentInfo(null); return; }
    supabase.from("assignments").select("subject, title").eq("id", assignmentId).single()
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "שגיאה בטעינת פרטי המשימה", description: error.message, variant: "destructive" });
          return;
        }
        setAssignmentInfo(data);
      });
  }, [assignmentId]);

  const generateQuestions = async () => {
    if (!assignmentInfo && !topic) { toast({ title: "בחר משימה או הזן נושא", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("task-studio-ai", {
        body: { action: "generate-questions", subject: assignmentInfo?.subject, topic, numQuestions: parseInt(numQuestions, 10) || 6 },
      });
      if (error) throw error;
      const result = Array.isArray(data?.result) ? data.result : [];
      if (result.length > 0) {
        setQuestions(result.map((q: any) => ({
          question_text: q.question_text,
          question_type: q.question_type === "true_false" ? "true_false" : "multiple_choice",
          options: q.options || [],
          correct_answer: q.correct_answer || "",
          explanation: q.explanation || "",
        })));
      } else {
        toast({ title: "לא הצלחתי לבנות שאלות, נסה/י שוב", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "שגיאה ביצירת שאלות", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (idx: number, patch: Partial<CoachQuestion>) => {
    if (!questions) return;
    const updated = [...questions];
    updated[idx] = { ...updated[idx], ...patch };
    setQuestions(updated);
  };

  const removeQuestion = (idx: number) => {
    if (!questions) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const publish = async () => {
    if (!assignmentId || !questions) return;
    setPublishing(true);
    try {
      const rows = questions.map((q, idx) => ({
        assignment_id: assignmentId,
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options || [],
        correct_answer: q.correct_answer,
        explanation: q.explanation || "",
        points: 1,
        order_num: idx,
        coaching_enabled: true,
      }));
      const { error: insertError } = await supabase.from("task_questions").insert(rows);
      if (insertError) throw insertError;
      const { error: publishError } = await supabase.from("assignments").update({ published: true }).eq("id", assignmentId);
      if (publishError) throw publishError;
      toast({ title: "הבוחן המאומן פורסם! כל טעות תקבל הסבר אישי ותיקון מיידי" });
    } catch (err: any) {
      toast({ title: "שגיאה בשיגור", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <StudioModeWrapper
      title="בוחן עם מאמן AI"
      description="כשתלמיד טועה, ה-AI מסביר בדיוק את התפיסה השגויה שלו ומוודא שהוא הבין - לא רק מציג את התשובה הנכונה"
      icon={<GraduationCap className="h-6 w-6 text-accent" />}
      badge="AI"
      onBack={onBack}
    >
      {!questions ? (
        <div className="space-y-4">
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <p className="text-xs font-body text-muted-foreground">
                בבוחן רגיל, טעות מקבלת "לא נכון, התשובה הנכונה היא...". כאן, ה-AI מזהה <b>למה</b> התלמיד טעה, מסביר את זה נקודתית, ונותן שאלת-מיקרו לוודא שהוא באמת הבין - לפני שממשיכים. בסוף, תקבל/י דוח של התפיסות השגויות הנפוצות בכיתה.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-4">
              {assignmentInfo && (
                <p className="text-xs text-muted-foreground">
                  משימה: <span className="font-heading font-bold text-foreground">{assignmentInfo.title}</span> ({assignmentInfo.subject})
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-heading">נושא</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="לדוגמה: שברים" className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-heading">מספר שאלות</Label>
                  <Input type="number" value={numQuestions} onChange={(e) => setNumQuestions(e.target.value)} className="h-9 text-xs" dir="ltr" min={1} max={20} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Button className="w-full gap-2 font-heading" onClick={generateQuestions} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "בונה שאלות..." : "בנה שאלות אוטומטית"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <Card key={idx} className="border-muted">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Textarea value={q.question_text} onChange={(e) => updateQuestion(idx, { question_text: e.target.value })} className="text-xs min-h-14 resize-none flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeQuestion(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground shrink-0">תשובה נכונה:</Label>
                  <Input value={q.correct_answer} onChange={(e) => updateQuestion(idx, { correct_answer: e.target.value })} className="h-7 text-xs" />
                </div>
              </CardContent>
            </Card>
          ))}
          {questions.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">אין שאלות - חזור/י ובנה מחדש</p>}

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="gap-2 font-heading text-xs" onClick={() => setQuestions(null)}>
              חזור להגדרות
            </Button>
            <Button className="gap-2 font-heading text-xs flex-1" onClick={publish} disabled={publishing || !assignmentId || questions.length === 0}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {publishing ? "משגר..." : "שגר עם מאמן AI פעיל"}
            </Button>
          </div>
        </div>
      )}
    </StudioModeWrapper>
  );
};

export default MisconceptionCoachMode;
