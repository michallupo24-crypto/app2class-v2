import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users } from "lucide-react";

interface TeacherCountsBySubjectProps {
  schoolId: string;
  subjects: string[];
  highlightMissing?: boolean;
  onStatusChange?: (allFilled: boolean) => void;
}

const TeacherCountsBySubject = ({ schoolId, subjects, highlightMissing, onStatusChange }: TeacherCountsBySubjectProps) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from("subject_teacher_counts").select("subject, teacher_count").eq("school_id", schoolId)
      .then(({ data }) => {
        setCounts(Object.fromEntries((data || []).map((r: any) => [r.subject, r.teacher_count])));
        setLoaded(true);
      });
  }, [schoolId]);

  useEffect(() => {
    if (!loaded) return;
    onStatusChange?.(subjects.every(s => (counts[s] ?? 0) > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, counts, subjects.join(",")]);

  const save = async (subject: string, count: number) => {
    setCounts(c => ({ ...c, [subject]: count }));
    if (!count || count <= 0) return;
    await supabase.from("subject_teacher_counts").upsert({
      school_id: schoolId,
      subject,
      teacher_count: count,
      updated_at: new Date().toISOString(),
    }, { onConflict: "school_id,subject" });
  };

  if (!loaded || subjects.length === 0) return null;

  return (
    <Card className={highlightMissing && !subjects.every(s => (counts[s] ?? 0) > 0) ? "border-amber-500/50" : undefined}>
      <CardHeader>
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          כמה מורים יש לך בכל מקצוע?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          נדרש כדי שהמערכת האוטומטית לא תשבץ יותר שיעורים מקבילים באותו מקצוע ובאותה שעה ממספר המורים בפועל — גם אם עדיין לא ידוע איזה מורה ילמד איזו כיתה.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map(subject => {
          const missing = !(counts[subject] > 0);
          return (
            <div
              key={subject}
              className={`flex items-center gap-2 p-2 rounded-lg ${highlightMissing && missing ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "bg-muted/30"}`}
            >
              <span className="text-sm flex-1 truncate">{subject}</span>
              <Input
                type="number"
                className="w-16"
                value={counts[subject] ?? ""}
                placeholder="—"
                onChange={(e) => setCounts(c => ({ ...c, [subject]: parseInt(e.target.value) || 0 }))}
                onBlur={(e) => save(subject, parseInt(e.target.value) || 0)}
              />
              <span className="text-xs text-muted-foreground">מורים</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default TeacherCountsBySubject;
