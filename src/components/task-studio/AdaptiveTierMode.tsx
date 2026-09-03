import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sprout, Zap, Rocket, Sparkles, Loader2, Send, Trash2, Users } from "lucide-react";
import StudioModeWrapper from "./StudioModeWrapper";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { tierForAverage, type Tier as TierKey } from "@/lib/adaptiveTier";

interface Props {
  profile: UserProfile;
  assignmentId: string | null;
  onBack: () => void;
}

interface TierQuestion {
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "fill_blank";
  options: string[];
  correct_answer: string;
  explanation: string;
}

const TIERS: { key: TierKey; label: string; icon: JSX.Element; color: string; hint: string }[] = [
  { key: "support", label: "מסלול מהיר להצלחה", icon: <Sprout className="h-4 w-4" />, color: "border-success/40 bg-success/5 text-success", hint: "ניסוח פשוט יותר ורמזים מובנים" },
  { key: "standard", label: "מסלול רגיל", icon: <Zap className="h-4 w-4" />, color: "border-primary/40 bg-primary/5 text-primary", hint: "רמת הקושי הרגילה של הכיתה" },
  { key: "challenge", label: "מסלול אתגר", icon: <Rocket className="h-4 w-4" />, color: "border-warning/40 bg-warning/5 text-warning", hint: "דורש הסקת מסקנות נוספת" },
];

const AdaptiveTierMode = ({ profile, assignmentId, onBack }: Props) => {
  const { toast } = useToast();
  const [assignmentInfo, setAssignmentInfo] = useState<{ subject: string; class_id: string; title: string } | null>(null);
  const [topic, setTopic] = useState("");
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [numPerTier, setNumPerTier] = useState("5");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [tiers, setTiers] = useState<Record<TierKey, TierQuestion[]> | null>(null);
  const [distribution, setDistribution] = useState<Record<TierKey, number> | null>(null);
  const [loadingDistribution, setLoadingDistribution] = useState(false);

  useEffect(() => {
    if (!assignmentId) { setAssignmentInfo(null); return; }
    supabase.from("assignments").select("subject, class_id, title").eq("id", assignmentId).single()
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "שגיאה בטעינת פרטי המשימה", description: error.message, variant: "destructive" });
          return;
        }
        setAssignmentInfo(data);
      });
  }, [assignmentId]);

  useEffect(() => {
    const loadDistribution = async () => {
      if (!assignmentInfo) { setDistribution(null); return; }
      setLoadingDistribution(true);
      try {
        const { data: roster, error: rosterError } = await supabase.from("profiles").select("id").eq("class_id", assignmentInfo.class_id);
        if (rosterError) throw rosterError;
        const studentIds = (roster || []).map((r) => r.id);
        if (studentIds.length === 0) { setDistribution({ support: 0, standard: 0, challenge: 0 }); return; }

        const { data: subs, error: subsError } = await supabase
          .from("submissions")
          .select("student_id, grade, assignments!inner(subject)")
          .eq("assignments.subject", assignmentInfo.subject)
          .in("student_id", studentIds)
          .not("grade", "is", null);
        if (subsError) throw subsError;

        const byStudent = new Map<string, number[]>();
        (subs || []).forEach((s: any) => {
          if (!byStudent.has(s.student_id)) byStudent.set(s.student_id, []);
          byStudent.get(s.student_id)!.push(s.grade);
        });

        const counts: Record<TierKey, number> = { support: 0, standard: 0, challenge: 0 };
        studentIds.forEach((id) => {
          const grades = byStudent.get(id);
          const avg = grades && grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
          counts[tierForAverage(avg)]++;
        });
        setDistribution(counts);
      } catch (err: any) {
        toast({ title: "שגיאה בחישוב התפלגות הרמות", description: err.message, variant: "destructive" });
      } finally {
        setLoadingDistribution(false);
      }
    };
    loadDistribution();
  }, [assignmentInfo]);

  const generateTiers = async () => {
    if (!assignmentInfo && !topic) { toast({ title: "בחר משימה או הזן נושא", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("task-studio-ai", {
        body: {
          action: "generate-tiered-questions",
          subject: assignmentInfo?.subject,
          topic,
          prompt: sourceMaterial || undefined,
          numQuestions: parseInt(numPerTier, 10) || 5,
        },
      });
      if (error) throw error;
      const result = data?.result;
      if (result?.support && result?.standard && result?.challenge) {
        setTiers(result);
        toast({ title: "שלוש הרמות נוצרו! בדוק/י ואשר/י לפני שיגור 🎯" });
      } else {
        toast({ title: "לא הצלחתי לבנות את הרמות, נסה/י שוב", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "שגיאה ביצירת הרמות", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (tier: TierKey, idx: number, patch: Partial<TierQuestion>) => {
    if (!tiers) return;
    const updated = [...tiers[tier]];
    updated[idx] = { ...updated[idx], ...patch };
    setTiers({ ...tiers, [tier]: updated });
  };

  const removeQuestion = (tier: TierKey, idx: number) => {
    if (!tiers) return;
    setTiers({ ...tiers, [tier]: tiers[tier].filter((_, i) => i !== idx) });
  };

  const publish = async () => {
    if (!assignmentId || !tiers) return;
    setPublishing(true);
    try {
      const rows: any[] = [];
      let order = 0;
      (["support", "standard", "challenge"] as TierKey[]).forEach((tier) => {
        tiers[tier].forEach((q) => {
          rows.push({
            assignment_id: assignmentId,
            question_type: q.question_type,
            question_text: q.question_text,
            options: q.options || [],
            correct_answer: q.correct_answer,
            explanation: q.explanation || "",
            points: 1,
            order_num: order++,
            tier,
          });
        });
      });
      const { error: insertError } = await supabase.from("task_questions").insert(rows);
      if (insertError) throw insertError;
      const { error: publishError } = await supabase.from("assignments").update({ published: true }).eq("id", assignmentId);
      if (publishError) throw publishError;
      toast({ title: "המסלול המותאם פורסם! כל תלמיד יקבל את הרמה שמתאימה לו 🎯" });
    } catch (err: any) {
      toast({ title: "שגיאה בשיגור", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <StudioModeWrapper
      title="מסלול מותאם אישית"
      description="שאלה אחת, שלוש רמות - כל תלמיד מקבל אוטומטית את הרמה שמתאימה לו"
      icon={<Sprout className="h-6 w-6 text-success" />}
      badge="AI"
      onBack={onBack}
    >
      {!tiers ? (
        <div className="space-y-4">
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
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="לדוגמה: משוואות ריבועיות" className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-heading">שאלות לכל רמה</Label>
                  <Input type="number" value={numPerTier} onChange={(e) => setNumPerTier(e.target.value)} className="h-9 text-xs" dir="ltr" min={1} max={15} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">חומר מקור (אופציונלי)</Label>
                <Textarea value={sourceMaterial} onChange={(e) => setSourceMaterial(e.target.value)} placeholder="הדבק כאן קטע מהחומר שנלמד, אם יש..." className="text-xs min-h-20 resize-none" />
              </div>
            </CardContent>
          </Card>

          {assignmentInfo && (
            <Card className="border-info/30 bg-info/5">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-info shrink-0" />
                {loadingDistribution ? (
                  <p className="text-xs text-muted-foreground">בודק/ת התפלגות כיתתית...</p>
                ) : distribution ? (
                  <p className="text-xs font-body">
                    לפי ממוצע קודם ב{assignmentInfo.subject}: <b className="text-success">{distribution.support}</b> יקבלו מסלול מהיר, <b className="text-primary">{distribution.standard}</b> מסלול רגיל, <b className="text-warning">{distribution.challenge}</b> מסלול אתגר.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}

          <Button className="w-full gap-2 font-heading" onClick={generateTiers} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "בונה שלוש רמות..." : "בנה שלוש רמות אוטומטית"}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {TIERS.map(({ key, label, icon, color, hint }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={`gap-1.5 border ${color}`} variant="outline">{icon}{label}</Badge>
                <span className="text-[11px] text-muted-foreground">{hint}</span>
              </div>
              <div className="space-y-2">
                {tiers[key].map((q, idx) => (
                  <Card key={idx} className="border-muted">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Textarea
                          value={q.question_text}
                          onChange={(e) => updateQuestion(key, idx, { question_text: e.target.value })}
                          className="text-xs min-h-14 resize-none flex-1"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeQuestion(key, idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground shrink-0">תשובה נכונה:</Label>
                        <Input value={q.correct_answer} onChange={(e) => updateQuestion(key, idx, { correct_answer: e.target.value })} className="h-7 text-xs" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {tiers[key].length === 0 && <p className="text-[11px] text-muted-foreground px-1">אין שאלות ברמה זו</p>}
              </div>
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="gap-2 font-heading text-xs" onClick={() => setTiers(null)}>
              חזור להגדרות
            </Button>
            <Button className="gap-2 font-heading text-xs flex-1" onClick={publish} disabled={publishing || !assignmentId}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {publishing ? "משגר..." : "שגר לכיתה - כל תלמיד יקבל את הרמה שלו"}
            </Button>
          </div>
        </div>
      )}
    </StudioModeWrapper>
  );
};

export default AdaptiveTierMode;
