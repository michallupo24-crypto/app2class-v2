import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  assignmentId: string;
}

interface Row {
  misconception_label: string;
  resolved: boolean;
  question_id: string;
  task_questions: { question_text: string } | null;
}

const MisconceptionInsights = ({ assignmentId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase
      .from("question_misconceptions")
      .select("misconception_label, resolved, question_id, task_questions(question_text)")
      .eq("assignment_id", assignmentId)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setRows((data || []) as any);
        setLoading(false);
      });
  }, [assignmentId]);

  if (loading) {
    return (
      <Card><CardContent className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
    );
  }

  if (error) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-destructive">שגיאה בטעינת נתוני מאמן ה-AI: {error}</CardContent></Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center">
        <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">
          עדיין אין נתוני מאמן AI למשימה זו. זה מופיע רק במשימות שנוצרו דרך "בוחן עם מאמן AI" בסטודיו משימות.
        </p>
      </CardContent></Card>
    );
  }

  const grouped = new Map<string, { count: number; resolved: number; example: string }>();
  rows.forEach((r) => {
    const key = r.misconception_label;
    const g = grouped.get(key) || { count: 0, resolved: 0, example: r.task_questions?.question_text || "" };
    g.count++;
    if (r.resolved) g.resolved++;
    grouped.set(key, g);
  });
  const sorted = Array.from(grouped.entries()).sort((a, b) => b[1].count - a[1].count);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent" />תפיסות שגויות נפוצות בכיתה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground font-body mb-2">
          מבוסס על {rows.length} טעויות שאובחנו בזמן אמת - שווה להקדיש כמה דקות הוראה חוזרת לנושאים המובילים.
        </p>
        {sorted.map(([label, g]) => (
          <div key={label} className="flex items-center justify-between p-3 rounded-lg border bg-accent/5 border-accent/20">
            <div className="min-w-0">
              <p className="text-sm font-heading font-bold truncate">{label}</p>
              <p className="text-[11px] text-muted-foreground truncate">{g.example}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[10px]">{g.count} תלמידים</Badge>
              <Badge className="text-[10px] bg-accent/20 text-accent border-0">{g.resolved}/{g.count} תוקנו</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default MisconceptionInsights;
