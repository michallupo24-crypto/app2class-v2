import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, History, Plus, Send, Trash2 } from "lucide-react";
import type { GradeLevel } from "@/lib/constants";
import type { UserProfile } from "@/hooks/useAuth";
import { displayName } from "@/lib/displayName";

// Continuity only applies to grades ז'-י"א: י"ב is a class's final year, so
// "keep the same teacher next year" is meaningless for it.
const CONTINUITY_GRADES: GradeLevel[] = ["ז", "ח", "ט", "י", "יא"];

interface ClassOption {
  id: string;
  grade: GradeLevel;
  class_number: number;
}

interface TeacherOption {
  id: string;
  full_name: string;
}

interface HistoryRow {
  id: string;
  class_id: string;
  subject: string;
  teacher_id: string;
  school_year_label: string;
}

interface ConstraintStatus {
  status: "pending" | "approved" | "rejected";
}

interface TeacherContinuityPanelProps {
  schoolId: string;
  profile: UserProfile;
}

const TeacherContinuityPanel = ({ schoolId, profile }: TeacherContinuityPanelProps) => {
  const { toast } = useToast();
  const canApprove = profile.roles.some(r => ["management", "system_admin"].includes(r));

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [requestStatus, setRequestStatus] = useState<Map<string, ConstraintStatus>>(new Map());
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formClass, setFormClass] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formTeacher, setFormTeacher] = useState("");
  const [formYear, setFormYear] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [classesRes, rolesRes, historyRes, settingsRes] = await Promise.all([
      supabase.from("classes").select("id, grade, class_number").eq("school_id", schoolId),
      supabase.from("user_roles").select("user_id").eq("role", "professional_teacher"),
      supabase.from("teacher_class_history").select("*").eq("school_id", schoolId),
      supabase.from("school_timetable_settings").select("continuity_setup_completed").eq("school_id", schoolId).maybeSingle(),
    ]);

    const classList = ((classesRes.data || []) as ClassOption[]).filter(c => CONTINUITY_GRADES.includes(c.grade));
    setClasses(classList);
    if (!formClass && classList[0]) setFormClass(classList[0].id);

    const teacherIds = Array.from(new Set((rolesRes.data || []).map((r: any) => r.user_id)));
    const { data: profilesData } = teacherIds.length
      ? await supabase.from("profiles").select("id, full_name, display_name").eq("school_id", schoolId).in("id", teacherIds)
      : { data: [] as any[] };
    const teacherOpts = (profilesData || []).map((p: any) => ({ id: p.id, full_name: displayName(p) })).sort((a, b) => displayName(a).localeCompare(displayName(b)));
    setTeachers(teacherOpts);
    if (!formTeacher && teacherOpts[0]) setFormTeacher(teacherOpts[0].id);

    const historyRows = (historyRes.data || []) as HistoryRow[];
    setHistory(historyRows);
    setSetupCompleted(!!settingsRes.data?.continuity_setup_completed);

    if (historyRows.length > 0) {
      const { data: constraintsData } = await supabase
        .from("teacher_constraints")
        .select("class_id, subject, teacher_id, status")
        .eq("school_id", schoolId)
        .eq("constraint_type", "continue_with_class");
      const statusMap = new Map<string, ConstraintStatus>();
      for (const c of (constraintsData || []) as any[]) {
        statusMap.set(`${c.class_id}::${c.subject}::${c.teacher_id}`, { status: c.status });
      }
      setRequestStatus(statusMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const classLabel = (id: string) => {
    const c = classes.find(cc => cc.id === id);
    return c ? `${c.grade}'${c.class_number}` : id;
  };
  const teacherLabel = (id: string) => teachers.find(t => t.id === id)?.full_name || id;

  const handleAddHistory = async () => {
    if (!formClass || !formSubject.trim() || !formTeacher || !formYear.trim()) {
      toast({ title: "יש למלא כיתה, מקצוע, מורה ושנת לימודים", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.from("teacher_class_history").insert({
      school_id: schoolId,
      class_id: formClass,
      subject: formSubject.trim(),
      teacher_id: formTeacher,
      school_year_label: formYear.trim(),
      entered_by: profile.id,
    }).select().single();
    if (error) {
      toast({ title: "שגיאה בהוספה", description: error.code === "23505" ? "רשומה כזו כבר קיימת" : error.message, variant: "destructive" });
      return;
    }
    setHistory(hs => [...hs, data as HistoryRow]);
    setFormSubject("");
    toast({ title: "נוסף בהצלחה ✅" });
  };

  const handleRemoveHistory = async (id: string) => {
    const { error } = await supabase.from("teacher_class_history").delete().eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setHistory(hs => hs.filter(h => h.id !== id));
  };

  const handleRequestContinuity = async (row: HistoryRow) => {
    const { error } = await supabase.from("teacher_constraints").insert({
      school_id: schoolId,
      teacher_id: row.teacher_id,
      constraint_type: "continue_with_class",
      class_id: row.class_id,
      subject: row.subject,
      is_hard: false,
      status: "pending",
      created_by: profile.id,
      note: `המשכיות משנת ${row.school_year_label}`,
    });
    if (error) {
      toast({ title: "שגיאה בשליחת הבקשה", description: error.message, variant: "destructive" });
      return;
    }
    setRequestStatus(m => new Map(m).set(`${row.class_id}::${row.subject}::${row.teacher_id}`, { status: "pending" }));
    toast({ title: "בקשת ההמשכיות נשלחה לאישור הנהלה ✅" });
  };

  const handleMarkCompleted = async () => {
    const { error } = await supabase.from("school_timetable_settings").upsert({
      school_id: schoolId,
      continuity_setup_completed: true,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setSetupCompleted(true);
    toast({ title: "הזנת נתוני ההמשכיות סומנה כהושלמה ✅" });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const statusBadge = (row: HistoryRow) => {
    const s = requestStatus.get(`${row.class_id}::${row.subject}::${row.teacher_id}`);
    if (!s) return null;
    if (s.status === "approved") return <Badge className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> אושרה</Badge>;
    if (s.status === "rejected") return <Badge variant="outline" className="text-[10px] text-destructive">נדחתה</Badge>;
    return <Badge variant="secondary" className="text-[10px]">ממתינה לאישור</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className={setupCompleted ? "border-emerald-500/40" : "border-amber-500/40"}>
        <CardContent className="py-4 text-sm space-y-2">
          <p>
            <History className="h-4 w-4 inline ml-1" />
            זו השנה הראשונה שבית הספר משתמש במערכת — אין בה נתונים היסטוריים על מי לימד את מי בשנה שעברה. הזינו כאן ידנית, לכל כיתה (ז'–י"א), איזה מורה לימד איזה מקצוע בשנה שעברה, ואז אפשר לבקש עבור כל שורה "המשכיות" — הבקשה תחכה לאישור הנהלה לפני שהמערכת תעדיף את אותו מורה לאותה כיתה השנה.
          </p>
          {!setupCompleted && canApprove && (
            <Button size="sm" variant="outline" onClick={handleMarkCompleted}>סמנו שהזנת הנתונים הושלמה</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">נתוני שנה קודמת</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">טרם הוזנו נתונים</p>
          ) : (
            history.map(row => (
              <div key={row.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 flex-wrap">
                <Badge variant="outline">{classLabel(row.class_id)}</Badge>
                <span className="text-xs">{row.subject} — {teacherLabel(row.teacher_id)} ({row.school_year_label})</span>
                {statusBadge(row)}
                <div className="mr-auto flex items-center gap-1">
                  {!requestStatus.has(`${row.class_id}::${row.subject}::${row.teacher_id}`) && (
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => handleRequestContinuity(row)}>
                      <Send className="h-3.5 w-3.5" /> בקש המשכיות
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveHistory(row.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="border border-dashed border-border rounded-lg p-3 flex flex-wrap gap-2 items-end">
            <Select value={formClass} onValueChange={setFormClass}>
              <SelectTrigger className="w-28 h-8"><SelectValue placeholder="כיתה" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.grade}'{c.class_number}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="מקצוע" className="w-32 h-8" value={formSubject} onChange={(e) => setFormSubject(e.target.value)} />
            <Select value={formTeacher} onValueChange={setFormTeacher}>
              <SelectTrigger className="w-40 h-8"><SelectValue placeholder="מורה" /></SelectTrigger>
              <SelectContent>
                {teachers.map(t => <SelectItem key={t.id} value={t.id}>{displayName(t)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder='שנה (למשל: תשפ"ה)' className="w-28 h-8" value={formYear} onChange={(e) => setFormYear(e.target.value)} />
            <Button size="sm" onClick={handleAddHistory} className="gap-1 h-8"><Plus className="h-3.5 w-3.5" /> הוסף</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherContinuityPanel;
