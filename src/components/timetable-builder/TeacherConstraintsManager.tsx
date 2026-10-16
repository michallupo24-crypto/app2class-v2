import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, XCircle, Trash2, Plus, ShieldAlert } from "lucide-react";
import { HEBREW_DAYS } from "@/lib/constants";
import { useSchoolDays } from "@/hooks/useSchoolDays";
import type { UserProfile } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type TeacherConstraintInsert = Database["public"]["Tables"]["teacher_constraints"]["Insert"];

export type ConstraintType =
  | "unavailable_slot"
  | "staff_meeting"
  | "date_range_unavailable"
  | "continue_with_class"
  | "no_edge_lesson"
  | "max_daily_hours"
  | "custom";

const TYPE_LABELS: Record<ConstraintType, string> = {
  unavailable_slot: "אי-זמינות קבועה (יום+שעה)",
  staff_meeting: "ישיבת צוות/מקצוע קבועה",
  date_range_unavailable: "היעדרות בטווח תאריכים",
  continue_with_class: "המשכיות מורה-כיתה",
  no_edge_lesson: "לא ללמד שיעור ראשון/אחרון",
  max_daily_hours: "מקסימום שעות ביום",
  custom: "אילוץ אחר",
};

interface ConstraintRow {
  id: string;
  teacher_id: string;
  constraint_type: ConstraintType;
  day_of_week: number | null;
  lesson_number: number | null;
  start_date: string | null;
  end_date: string | null;
  class_id: string | null;
  subject: string | null;
  max_value: number | null;
  is_hard: boolean;
  status: "approved" | "pending" | "rejected";
  note: string | null;
}

interface TeacherOption {
  id: string;
  full_name: string;
}

interface TeacherConstraintsManagerProps {
  schoolId: string;
  profile: UserProfile;
}

const TeacherConstraintsManager = ({ schoolId, profile }: TeacherConstraintsManagerProps) => {
  const { toast } = useToast();
  const days = useSchoolDays(schoolId);
  const canApprove = profile.roles.some(r => ["management", "system_admin"].includes(r));

  const [constraints, setConstraints] = useState<ConstraintRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teachersById, setTeachersById] = useState<Map<string, string>>(new Map());
  const [lessonNumbers, setLessonNumbers] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const [formTeacher, setFormTeacher] = useState("");
  const [formType, setFormType] = useState<ConstraintType>("unavailable_slot");
  const [formDay, setFormDay] = useState("0");
  const [formLesson, setFormLesson] = useState("1");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formMax, setFormMax] = useState("6");
  const [formHard, setFormHard] = useState(true);
  const [formNote, setFormNote] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [constraintsRes, rolesRes, bellRes] = await Promise.all([
      supabase.from("teacher_constraints").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "professional_teacher"),
      supabase.from("bell_schedule").select("lesson_number, is_break").eq("school_id", schoolId).order("lesson_number"),
    ]);
    if (constraintsRes.error) toast({ title: "שגיאה בטעינת אילוצים", description: constraintsRes.error.message, variant: "destructive" });
    if (rolesRes.error) toast({ title: "שגיאה בטעינת רשימת מורים", description: rolesRes.error.message, variant: "destructive" });

    const teacherIds = Array.from(new Set((rolesRes.data || []).map((r: any) => r.user_id)));
    const { data: profilesData, error: profilesError } = teacherIds.length
      ? await supabase.from("profiles").select("id, full_name").eq("school_id", schoolId).in("id", teacherIds)
      : { data: [] as any[], error: null };
    if (profilesError) toast({ title: "שגיאה בטעינת פרטי מורים", description: profilesError.message, variant: "destructive" });

    const opts: TeacherOption[] = (profilesData || []).map((p: any) => ({ id: p.id, full_name: p.full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name));
    setTeachers(opts);
    setTeachersById(new Map(opts.map(t => [t.id, t.full_name])));
    setConstraints((constraintsRes.data || []) as ConstraintRow[]);
    if (!formTeacher && opts[0]) setFormTeacher(opts[0].id);

    const nonBreakLessons = (bellRes.data || []).filter((b: any) => !b.is_break).map((b: any) => b.lesson_number);
    if (nonBreakLessons.length) {
      setLessonNumbers(nonBreakLessons);
      setFormLesson(prev => (nonBreakLessons.includes(parseInt(prev)) ? prev : String(nonBreakLessons[0])));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const handleAdd = async () => {
    if (!formTeacher) {
      toast({ title: "יש לבחור מורה", variant: "destructive" });
      return;
    }
    const payload: TeacherConstraintInsert = {
      school_id: schoolId,
      teacher_id: formTeacher,
      constraint_type: formType,
      is_hard: formHard,
      note: formNote.trim() || null,
      created_by: profile.id,
      status: "approved",
    };
    if (formType === "unavailable_slot" || formType === "staff_meeting") {
      payload.day_of_week = parseInt(formDay);
      payload.lesson_number = parseInt(formLesson);
    } else if (formType === "date_range_unavailable") {
      if (!formStart || !formEnd) {
        toast({ title: "יש להזין תאריך התחלה וסיום", variant: "destructive" });
        return;
      }
      payload.start_date = formStart;
      payload.end_date = formEnd;
    } else if (formType === "max_daily_hours") {
      payload.max_value = parseInt(formMax) || 6;
    }

    const { data, error } = await supabase.from("teacher_constraints").insert(payload).select().single();
    if (error) {
      toast({ title: "שגיאה בהוספת אילוץ", description: error.message, variant: "destructive" });
      return;
    }
    setConstraints(cs => [data as ConstraintRow, ...cs]);
    setAdding(false);
    setFormNote("");
    toast({ title: "האילוץ נוסף בהצלחה ✅" });
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("teacher_constraints").delete().eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setConstraints(cs => cs.filter(c => c.id !== id));
  };

  const handleDecide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("teacher_constraints").update({
      status,
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setConstraints(cs => cs.map(c => (c.id === id ? { ...c, status } : c)));
  };

  const describe = (c: ConstraintRow): string => {
    if (c.constraint_type === "unavailable_slot" || c.constraint_type === "staff_meeting") {
      return `יום ${HEBREW_DAYS[c.day_of_week ?? 0]}, שיעור ${c.lesson_number}`;
    }
    if (c.constraint_type === "date_range_unavailable") {
      return `${c.start_date} עד ${c.end_date}`;
    }
    if (c.constraint_type === "continue_with_class") {
      return c.subject ? `מקצוע: ${c.subject}` : "המשך הוראה בכיתה";
    }
    if (c.constraint_type === "max_daily_hours") {
      return `עד ${c.max_value} שעות ביום`;
    }
    return c.note || "-";
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const pending = constraints.filter(c => c.status === "pending");
  const active = constraints.filter(c => c.status !== "pending");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        <ShieldAlert className="h-3 w-3 inline ml-1" />
        אילוצים "קשיחים" (חובה) חוסמים את הבנייה האוטומטית משיבוץ המורה באותה שעה; אילוצים "רכים" הם העדפה בלבד שהמערכת מנסה לכבד.
      </p>

      {pending.length > 0 && canApprove && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">בקשות ממתינות לאישור</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.map(c => (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 flex-wrap">
                <Badge variant="outline">{teachersById.get(c.teacher_id) || "מורה"}</Badge>
                <span className="text-xs">{TYPE_LABELS[c.constraint_type]} — {describe(c)}</span>
                <div className="mr-auto flex gap-1">
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => handleDecide(c.id, "approved")}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> אשר
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs text-destructive" onClick={() => handleDecide(c.id, "rejected")}>
                    <XCircle className="h-3.5 w-3.5" /> דחה
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">אילוצי מורים</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין אילוצים מוגדרים</p>
          ) : (
            active.map(c => (
              <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 flex-wrap">
                <Badge variant="outline">{teachersById.get(c.teacher_id) || "מורה"}</Badge>
                <span className="text-xs">{TYPE_LABELS[c.constraint_type]} — {describe(c)}</span>
                <Badge variant={c.is_hard ? "destructive" : "secondary"} className="text-[10px]">{c.is_hard ? "קשיח" : "רך"}</Badge>
                {c.status === "rejected" && <Badge variant="outline" className="text-[10px] text-destructive">נדחה</Badge>}
                <Button variant="ghost" size="icon" className="mr-auto h-6 w-6 text-destructive" onClick={() => handleRemove(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}

          {teachers.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
              לא נמצא/ו מורה/ות בבית הספר עם תפקיד "מורה מקצועי/ת" — יש לשייך תפקיד זה למורים בעמוד ניהול הצוות לפני שאפשר להוסיף אילוצים.
            </p>
          )}

          {adding ? (
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">מורה</label>
                  <Select value={formTeacher} onValueChange={setFormTeacher}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="בחרו מורה" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">סוג אילוץ</label>
                  <Select value={formType} onValueChange={(v) => setFormType(v as ConstraintType)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as ConstraintType[]).filter(t => t !== "continue_with_class").map(t => (
                        <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">רמת חומרה</label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer h-8">
                    <Switch checked={formHard} onCheckedChange={setFormHard} />
                    {formHard ? "קשיח (חוסם)" : "רך (העדפה)"}
                  </label>
                </div>

                {(formType === "unavailable_slot" || formType === "staff_meeting") && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">יום</label>
                      <Select value={formDay} onValueChange={setFormDay}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {days.map(d => <SelectItem key={d} value={String(d)}>{HEBREW_DAYS[d]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">שיעור</label>
                      <Select value={formLesson} onValueChange={setFormLesson}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {lessonNumbers.map(l => <SelectItem key={l} value={String(l)}>שיעור {l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {formType === "date_range_unavailable" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">מתאריך</label>
                      <Input type="date" className="h-8" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">עד תאריך</label>
                      <Input type="date" className="h-8" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
                    </div>
                  </>
                )}

                {formType === "max_daily_hours" && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">מקסימום שעות ביום</label>
                    <Input type="number" className="h-8" value={formMax} onChange={(e) => setFormMax(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">הערה (רשות)</label>
                <Input className="h-8" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder='למשל: "ישיבת צוות מקצוע מתמטיקה"' />
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleAdd} className="gap-1 h-8" disabled={!formTeacher}>
                  <Plus className="h-3.5 w-3.5" /> הוסף אילוץ
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setAdding(false)}>ביטול</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)} disabled={teachers.length === 0}>
              <Plus className="h-3.5 w-3.5" /> הוסף אילוץ מורה
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherConstraintsManager;
