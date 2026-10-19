import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Plus, Save, Trash2 } from "lucide-react";
import { HEBREW_DAYS } from "@/lib/constants";
import { useSchoolDays } from "@/hooks/useSchoolDays";
import type { SchoolTimetableRules } from "@/lib/timetableRules";
import { cn } from "@/lib/utils";

/* School-wide rules the generator must keep (next to the per-teacher
   constraints): short days, which lessons a subject may use, and subjects
   that belong in the morning. Saved in school_timetable_settings.rules. */

const ANY = "__any";

export default function SchoolTimetableRulesEditor({ schoolId, canEdit }: { schoolId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const days = useSchoolDays(schoolId);
  // lesson_number values (breaks also take one), with their display labels.
  const [lessons, setLessons] = useState<number[]>([]);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  const [rules, setRules] = useState<SchoolTimetableRules>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newSubject, setNewSubject] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bellRes, reqRes, setRes] = await Promise.all([
        supabase.from("bell_schedule").select("lesson_number, label, is_break").eq("school_id", schoolId).order("lesson_number"),
        supabase.from("subject_requirements").select("subject").eq("school_id", schoolId),
        (supabase as any).from("school_timetable_settings").select("rules").eq("school_id", schoolId).maybeSingle(),
      ]);
      const bells = ((bellRes.data || []) as any[]).filter(b => !b.is_break);
      setLessons(bells.map(b => b.lesson_number));
      setLabels(Object.fromEntries(bells.map(b => [b.lesson_number, b.label || `שיעור ${b.lesson_number}`])));
      setSubjects(Array.from(new Set(((reqRes.data || []) as any[]).map(r => r.subject as string))).sort((a, b) => a.localeCompare(b, "he")));
      setRules((setRes.data?.rules as SchoolTimetableRules) || {});
      setLoading(false);
    })();
  }, [schoolId]);

  const change = (next: SchoolTimetableRules) => { setRules(next); setDirty(true); };
  const lastLesson = lessons[lessons.length - 1];
  const labelOf = (n: number) => labels[n] || `שיעור ${n}`;

  // Subjects with any per-subject rule, plus one being added.
  const ruleSubjects = useMemo(() => Array.from(new Set([
    ...Object.keys(rules.subjectEarliest || {}),
    ...Object.keys(rules.subjectLatest || {}),
  ])).sort((a, b) => a.localeCompare(b, "he")), [rules]);

  const setShortDay = (day: number, value: string) => {
    const shortDays = { ...(rules.shortDays || {}) };
    if (value === ANY) delete shortDays[String(day)];
    else shortDays[String(day)] = Number(value);
    change({ ...rules, shortDays });
  };

  const setSubjectBound = (subject: string, which: "subjectEarliest" | "subjectLatest", value: string) => {
    const map = { ...(rules[which] || {}) };
    if (value === ANY) delete map[subject];
    else map[subject] = Number(value);
    change({ ...rules, [which]: map });
  };

  const removeSubjectRule = (subject: string) => {
    const e = { ...(rules.subjectEarliest || {}) };
    const l = { ...(rules.subjectLatest || {}) };
    delete e[subject];
    delete l[subject];
    change({ ...rules, subjectEarliest: e, subjectLatest: l });
  };

  const addSubjectRule = () => {
    if (!newSubject || !lessons.length) return;
    // Start from "from the 2nd lesson" - the most common rule (PE, labs).
    change({ ...rules, subjectEarliest: { ...(rules.subjectEarliest || {}), [newSubject]: lessons[1] ?? lessons[0] } });
    setNewSubject("");
  };

  const toggleMorning = (subject: string) => {
    const set = new Set(rules.morningSubjects || []);
    if (set.has(subject)) set.delete(subject); else set.add(subject);
    change({ ...rules, morningSubjects: Array.from(set) });
  };

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from("school_timetable_settings")
      .upsert({ school_id: schoolId, rules, updated_at: new Date().toISOString() }, { onConflict: "school_id" });
    setSaving(false);
    if (error) { toast({ title: "השמירה נכשלה", description: error.message, variant: "destructive" }); return; }
    setDirty(false);
    toast({ title: "כללי בית הספר נשמרו", description: "הם ייכנסו לתוקף בבנייה הבאה של המערכת" });
  };

  if (loading) return <p className="py-6 text-center text-sm text-muted-foreground">טוען כללים…</p>;

  const LessonSelect = ({ value, onChange, placeholder }: { value: number | undefined; onChange: (v: string) => void; placeholder: string }) => (
    <Select value={value === undefined ? ANY : String(value)} onValueChange={onChange} disabled={!canEdit}>
      <SelectTrigger className="h-9 w-[132px] text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{placeholder}</SelectItem>
        {lessons.map(l => <SelectItem key={l} value={String(l)}>{labelOf(l)}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <CalendarClock className="h-5 w-5" /> כללי בית הספר
        </CardTitle>
        {canEdit && (
          <Button size="sm" onClick={save} disabled={!dirty || saving} className="gap-1.5">
            <Save className="h-4 w-4" />{saving ? "שומר…" : dirty ? "שמירה" : "נשמר"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {!lessons.length && (
          <p className="text-sm text-muted-foreground">יש להגדיר קודם את יום הלימודים (צלצולים) בטאב "יום הלימודים".</p>
        )}

        {/* Short days */}
        <section className="space-y-2">
          <h3 className="font-heading font-bold">ימים קצרים</h3>
          <p className="text-xs text-muted-foreground">באילו ימים הלימודים מסתיימים מוקדם יותר. המחולל לא ישבץ שיעורים אחרי השיעור האחרון.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {days.map(d => (
              <div key={d} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-sm font-semibold">יום {HEBREW_DAYS[d]}</span>
                <LessonSelect
                  value={rules.shortDays?.[String(d)]}
                  onChange={v => setShortDay(d, v)}
                  placeholder={lastLesson ? `יום מלא (עד ${labelOf(lastLesson)})` : "יום מלא"}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Per-subject lesson windows */}
        <section className="space-y-2">
          <h3 className="font-heading font-bold">שעות מותרות למקצוע</h3>
          <p className="text-xs text-muted-foreground">למשל: חינוך גופני לא בשיעור הראשון, מעבדה רק עד שיעור 6.</p>
          {ruleSubjects.length > 0 && (
            <ul className="space-y-2">
              {ruleSubjects.map(s => (
                <li key={s} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="min-w-[110px] flex-1 text-sm font-semibold">{s}</span>
                  <span className="text-xs text-muted-foreground">החל מ־</span>
                  <LessonSelect value={rules.subjectEarliest?.[s]} onChange={v => setSubjectBound(s, "subjectEarliest", v)} placeholder="מההתחלה" />
                  <span className="text-xs text-muted-foreground">עד</span>
                  <LessonSelect value={rules.subjectLatest?.[s]} onChange={v => setSubjectBound(s, "subjectLatest", v)} placeholder="עד הסוף" />
                  {canEdit && (
                    <button type="button" onClick={() => removeSubjectRule(s)} aria-label={`הסרת הכלל של ${s}`} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="flex gap-2">
              <Select value={newSubject} onValueChange={setNewSubject}>
                <SelectTrigger className="h-9 w-[200px] text-sm"><SelectValue placeholder="בחירת מקצוע" /></SelectTrigger>
                <SelectContent>
                  {subjects.filter(s => !ruleSubjects.includes(s)).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-9 gap-1" onClick={addSubjectRule} disabled={!newSubject}>
                <Plus className="h-4 w-4" />הוספת כלל
              </Button>
            </div>
          )}
        </section>

        {/* Morning subjects (soft) */}
        <section className="space-y-2">
          <h3 className="font-heading font-bold">מקצועות לבוקר</h3>
          <p className="text-xs text-muted-foreground">העדפה (לא חובה): המחולל ינסה לשבץ אותם בשיעורים הראשונים של היום.</p>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map(s => {
              const on = (rules.morningSubjects || []).includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={on}
                  onClick={() => toggleMorning(s)}
                  className={cn("rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-text-secondary hover:border-primary/50")}
                >
                  {s}
                </button>
              );
            })}
            {!subjects.length && <span className="text-xs text-muted-foreground">אין עדיין תכנית שעות.</span>}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
