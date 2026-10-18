import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* Grades and behavior records imported from before the school joined
   (student_history_records), by grade level ז..יב. Renders nothing when the
   student has no imported history. */

const ORDER = ["ז", "ח", "ט", "י", "יא", "יב"];

interface Rec {
  record_type: "grade" | "behavior";
  grade_level: string | null;
  school_year: string | null;
  subject: string | null;
  score: number | null;
  note: string | null;
  occurred_on: string | null;
}

export default function StudentHistoryPanel({ studentId }: { studentId: string }) {
  const [recs, setRecs] = useState<Rec[]>([]);

  useEffect(() => {
    if (!studentId) return;
    (supabase as any)
      .from("student_history_records")
      .select("record_type, grade_level, school_year, subject, score, note, occurred_on")
      .eq("student_id", studentId)
      .then(({ data }: { data: Rec[] | null }) => setRecs(data || []));
  }, [studentId]);

  const byGrade = useMemo(() => {
    const m = new Map<string, Map<string, number[]>>();
    for (const r of recs) {
      if (r.record_type !== "grade" || r.score == null) continue;
      const g = r.grade_level || "?";
      if (!m.has(g)) m.set(g, new Map());
      const subj = r.subject || "כללי";
      m.get(g)!.set(subj, [...(m.get(g)!.get(subj) || []), Number(r.score)]);
    }
    return [...m.entries()].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  }, [recs]);
  const behavior = recs.filter((r) => r.record_type === "behavior");

  if (!recs.length) return null;
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

  return (
    <section className="mt-10 space-y-4">
      <h3 className="font-heading text-lg font-black">היסטוריה לימודית (מיובאת)</h3>
      {byGrade.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {byGrade.map(([grade, subjects]) => {
            const all = [...subjects.values()].flat();
            return (
              <div key={grade} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-heading font-black">כיתה {grade}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-heading text-sm font-black">ממוצע {avg(all)}</span>
                </div>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  {[...subjects.entries()].map(([s, xs]) => (
                    <li key={s} className="flex justify-between gap-2">
                      <span className="truncate text-muted-foreground">{s}</span>
                      <span className="font-bold">{avg(xs)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {behavior.length > 0 && (
        <div className="rounded-xl border border-border p-3">
          <p className="mb-2 font-heading font-black">רקורד התנהגות</p>
          <ul className="space-y-1 text-sm">
            {behavior
              .sort((a, b) => (b.occurred_on || "").localeCompare(a.occurred_on || ""))
              .map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-24 shrink-0 text-muted-foreground">
                    {b.occurred_on ? new Date(b.occurred_on).toLocaleDateString("he-IL") : [b.grade_level, b.school_year].filter(Boolean).join(" · ")}
                  </span>
                  <span>{b.note}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
