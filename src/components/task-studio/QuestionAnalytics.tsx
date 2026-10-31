import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, ChevronDown, TrendingDown } from "lucide-react";
import type { QuestionStat } from "@/lib/questionAnalytics";

// Per-question breakdown of a quiz across the class: success rate, the wrong
// answers students gave and what the AI coach diagnosed. Hardest questions first.

interface Props {
  stats: QuestionStat[];
  /** Students whose answers went into the stats. */
  studentCount: number;
  /** AI-coach misconception labels per question id, with how many students hit each. */
  misconceptions: Map<string, { label: string; count: number }[]>;
}

const rateTone = (rate: number) =>
  rate < 50 ? { bar: "bg-destructive", text: "text-destructive" }
  : rate < 75 ? { bar: "bg-warning", text: "text-warning" }
  : { bar: "bg-success", text: "text-success" };

const QuestionAnalytics = ({ stats, studentCount, misconceptions }: Props) => {
  const [open, setOpen] = useState<string | null>(stats[0]?.successRate < 75 ? stats[0].questionId : null);

  if (stats.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground font-body">
        עוד אין תשובות מפורטות לניתוח. הן נאספות כשתלמידים פותרים את השאלות של המשימה באפליקציה.
      </CardContent></Card>
    );
  }

  const struggling = stats.filter((s) => s.successRate < 50);

  return (
    <div className="space-y-3">
      <Card className={struggling.length ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5"}>
        <CardContent className="py-3 px-4 flex items-start gap-2">
          <TrendingDown className={`h-4 w-4 mt-0.5 shrink-0 ${struggling.length ? "text-destructive" : "text-success"}`} />
          <p className="text-sm font-body">
            {struggling.length
              ? <>ב-<strong>{struggling.length}</strong> מתוך {stats.length} שאלות פחות ממחצית הכיתה ענו נכון. כדאי לחזור עליהן בשיעור.</>
              : <>אין שאלה שרוב הכיתה התקשתה בה. השאלות הקשות ביותר מופיעות ראשונות.</>}
            <span className="text-muted-foreground"> (מבוסס על {studentCount} תלמידים)</span>
          </p>
        </CardContent>
      </Card>

      {stats.map((s) => {
        const isOpen = open === s.questionId;
        const tone = rateTone(s.successRate);
        const coach = misconceptions.get(s.questionId) ?? [];
        const wrongCount = s.answered - s.correct;
        return (
          <Card key={s.questionId} className={isOpen ? "ring-1 ring-primary/30" : ""}>
            <button type="button" onClick={() => setOpen(isOpen ? null : s.questionId)} aria-expanded={isOpen}
              className="w-full text-right px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="font-heading font-semibold text-sm">{s.questionText}</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 max-w-xs rounded-full bg-muted overflow-hidden" role="presentation">
                    <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${s.successRate}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{s.correct}/{s.answered} ענו נכון</span>
                </div>
              </div>
              <span className={`font-heading font-black text-xl shrink-0 ${tone.text}`}>{s.successRate}%</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <CardContent className="pt-0 pb-4 space-y-3 border-t">
                <p className="text-xs pt-3">התשובה הנכונה: <strong>{s.correctAnswer || "—"}</strong></p>

                {wrongCount === 0 ? (
                  <p className="text-sm text-muted-foreground">כל מי שענה על השאלה ענה נכון.</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs font-heading font-bold">תשובות שגויות ({wrongCount})</p>
                    {s.wrongAnswers.map((w) => (
                      <div key={w.answer} className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="min-w-0 break-words">{w.answer}</strong>
                          <Badge variant="outline" className="text-[10px] shrink-0">{w.count === 1 ? "תלמיד/ה 1" : `${w.count} תלמידים`}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{w.students.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                )}

                {coach.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-heading font-bold flex items-center gap-1">
                      <Brain className="h-3.5 w-3.5 text-accent" /> מה זיהה מאמן ה-AI
                    </p>
                    {coach.map((m) => (
                      <div key={m.label} className="flex items-center justify-between gap-2 rounded-lg border border-accent/20 bg-accent/5 p-2.5 text-sm">
                        <span className="min-w-0">{m.label}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{m.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default QuestionAnalytics;
