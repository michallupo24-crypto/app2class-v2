import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatClassName } from "@/hooks/useStudentDay";
import type { UserProfile } from "@/hooks/useAuth";
import { DISPLAY_NAME_MAX, normalizeDisplayName, validateDisplayName } from "@/lib/displayName";
import { cn } from "@/lib/utils";

/* Set or clear the display name (שם תצוגה) shown instead of a person's legal
   name. Management sees the whole school; a grade coordinator sees the
   students of their grade. set_display_name() enforces the same scope. */

type Person = { id: string; fullName: string; displayName: string | null; classLabel: string | null; grade: string | null };

const MAX_ROWS = 60;

export default function DisplayNamesManager({ profile }: { profile: UserProfile }) {
  const { toast } = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyWithName, setOnlyWithName] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const schoolWide = profile.roles.some((r) => r === "management" || r === "system_admin" || r === "super_admin");

  useEffect(() => {
    if (!profile.schoolId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [classesRes, coordRes] = await Promise.all([
        supabase.from("classes").select("id, grade, class_number").eq("school_id", profile.schoolId!),
        schoolWide
          ? Promise.resolve({ data: [] as { grade: string | null }[] })
          : supabase.from("user_roles").select("grade").eq("user_id", profile.id).eq("role", "grade_coordinator"),
      ]);
      const classes = classesRes.data || [];
      const myGrades = new Set((coordRes.data || []).map((r) => r.grade).filter(Boolean) as string[]);
      const scopedClassIds = classes.filter((c) => myGrades.has(c.grade)).map((c) => c.id);

      let q = supabase.from("profiles").select("id, full_name, display_name, class_id")
        .eq("school_id", profile.schoolId!).eq("is_approved", true).neq("id", profile.id);
      if (!schoolWide) q = q.in("class_id", scopedClassIds.length ? scopedClassIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data } = await q;
      if (cancelled) return;

      const classById = new Map(classes.map((c) => [c.id, c]));
      setPeople((data || []).map((p) => {
        const c = p.class_id ? classById.get(p.class_id) : undefined;
        return {
          id: p.id, fullName: p.full_name, displayName: p.display_name,
          classLabel: c ? formatClassName(c.grade, c.class_number) : null, grade: c?.grade ?? null,
        };
      }).sort((a, b) => a.fullName.localeCompare(b.fullName, "he")));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile.id, profile.schoolId, schoolWide]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((p) =>
      (!onlyWithName || p.displayName) &&
      (!q || p.fullName.toLowerCase().includes(q) || (p.displayName || "").toLowerCase().includes(q) || (p.classLabel || "").includes(q)));
  }, [people, query, onlyWithName]);

  const draftError = editing ? validateDisplayName(draft) : null;

  const save = async (person: Person, value: string | null) => {
    setSaving(true);
    const { data, error } = await supabase.rpc("set_display_name", { p_user_id: person.id, p_display_name: value });
    setSaving(false);
    if (error) {
      toast({ title: "לא ניתן לשמור את שם התצוגה", description: error.message, variant: "destructive" });
      return;
    }
    setPeople((prev) => prev.map((p) => (p.id === person.id ? { ...p, displayName: data ?? null } : p)));
    setEditing(null);
    toast({ title: data ? `שם התצוגה של ${person.fullName} עודכן ל"${data}"` : `שם התצוגה של ${person.fullName} הוסר` });
  };

  const startEdit = (p: Person) => { setEditing(p.id); setDraft(p.displayName || ""); };

  if (!profile.schoolId) return <p className="font-body text-sm text-muted-foreground">החשבון לא משויך לבית ספר.</p>;

  return (
    <div className="space-y-3" dir="rtl">
      <div>
        <h3 className="font-heading text-[16px] font-black">שמות תצוגה</h3>
        <p className="font-body text-[13px] text-muted-foreground">
          שם שיוצג בכל המערכת — בהקראת שמות, ברשימות כיתה, בצ׳אט, בציונים ובמפת ההושבה — במקום השם הרשמי.
          למשל שם המשפחה של ההורה שהתלמיד/ה בקשר איתו, או כינוי במקום שם פרטי לא שגרתי.
          השם הרשמי נשמר ומוצג לצוות במעבר עכבר. {schoolWide ? "" : "מוצגים תלמידי השכבה שלך."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם או כיתה" className="pr-9" />
        </div>
        <Button type="button" variant={onlyWithName ? "default" : "outline"} size="sm" className="rounded-full"
          onClick={() => setOnlyWithName((v) => !v)}>
          רק עם שם תצוגה ({people.filter((p) => p.displayName).length})
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 font-body text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> טוען…</div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center font-body text-sm text-muted-foreground">לא נמצאו אנשים</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {filtered.slice(0, MAX_ROWS).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <div className="min-w-[140px] flex-1">
                <p className="font-body text-sm font-bold">{p.displayName || p.fullName}</p>
                <p className="font-body text-xs text-muted-foreground">
                  {p.displayName ? <>שם רשמי: {p.fullName}</> : "ללא שם תצוגה"}
                  {p.classLabel && <> · {p.classLabel}</>}
                </p>
              </div>
              {editing === p.id ? (
                <form className="flex w-full flex-wrap items-start gap-2 sm:w-auto"
                  onSubmit={(e) => { e.preventDefault(); if (!draftError) save(p, normalizeDisplayName(draft) || null); }}>
                  <div>
                    <Input autoFocus value={draft} maxLength={DISPLAY_NAME_MAX + 5} onChange={(e) => setDraft(e.target.value)}
                      placeholder="שם תצוגה" aria-label={`שם תצוגה ל${p.fullName}`} aria-invalid={!!draftError}
                      className={cn("h-9 w-[200px]", draftError && "border-destructive")} />
                    {draftError && <p className="mt-1 font-body text-xs text-destructive">{draftError}</p>}
                  </div>
                  <Button type="submit" size="sm" disabled={saving || !!draftError} className="h-9 gap-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} שמירה
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setEditing(null)} aria-label="ביטול">
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1 rounded-full" onClick={() => startEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" /> {p.displayName ? "עריכה" : "הגדרת שם תצוגה"}
                  </Button>
                  {p.displayName && (
                    <Button type="button" size="sm" variant="ghost" className="h-8 rounded-full text-muted-foreground"
                      disabled={saving} onClick={() => save(p, null)}>
                      הסרה
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {filtered.length > MAX_ROWS && (
        <p className="font-body text-xs text-muted-foreground">מוצגים {MAX_ROWS} מתוך {filtered.length} — אפשר לצמצם בחיפוש.</p>
      )}
    </div>
  );
}
