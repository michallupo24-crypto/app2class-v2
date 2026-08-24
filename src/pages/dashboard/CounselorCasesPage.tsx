import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldCheck, Plus, Lock, Send, ClipboardList } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface StudentLite {
  id: string;
  full_name: string;
  class_id: string | null;
}

interface CaseRow {
  id: string;
  student_id: string;
  status: string;
  flagged_reason: string | null;
  created_at: string;
}

interface NoteRow {
  id: string;
  note_content: string;
  created_at: string;
}

interface RecommendationRow {
  id: string;
  recommendation_text: string;
  teacher_id: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "חדש", color: "bg-info/10 text-info border-info/30" },
  weekly_monitoring: { label: "מעקב שבועי", color: "bg-warning/10 text-warning border-warning/30" },
  active_care: { label: "בטיפול פעיל", color: "bg-destructive/10 text-destructive border-destructive/30" },
  remote_monitoring: { label: "מעקב מרחוק", color: "bg-accent/10 text-accent border-accent/30" },
  referred_external: { label: "הועבר לגורם חיצוני", color: "bg-secondary/10 text-secondary-foreground border-secondary/30" },
  closed: { label: "סגור", color: "bg-muted text-muted-foreground" },
};

const CounselorCasesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedNewStudent, setSelectedNewStudent] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");

  const [activeCase, setActiveCase] = useState<CaseRow | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRow[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newRecommendation, setNewRecommendation] = useState("");

  const studentById = (id: string) => students.find((s) => s.id === id);

  const loadCases = async () => {
    setLoading(true);
    const [casesRes, studentsRes] = await Promise.all([
      (supabase as any)
        .from("counselor_cases")
        .select("id, student_id, status, flagged_reason, created_at")
        .eq("counselor_id", profile.id)
        .order("created_at", { ascending: false }),
      profile.schoolId
        ? supabase.from("profiles").select("id, full_name, class_id").eq("school_id", profile.schoolId).not("class_id", "is", null)
        : Promise.resolve({ data: [] as StudentLite[] }),
    ]);
    setCases(casesRes.data || []);
    setStudents(studentsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadCases();
  }, [profile.id, profile.schoolId]);

  const openCaseDetail = async (c: CaseRow) => {
    setActiveCase(c);
    const [notesRes, recsRes] = await Promise.all([
      (supabase as any).from("counselor_notes").select("id, created_at").eq("case_id", c.id).order("created_at", { ascending: false }),
      (supabase as any).from("counselor_recommendations").select("id, recommendation_text, teacher_id, created_at").eq("case_id", c.id).order("created_at", { ascending: false }),
    ]);
    const noteStubs: { id: string; created_at: string }[] = notesRes.data || [];
    const decrypted = await Promise.all(
      noteStubs.map(async (n) => {
        const { data: content } = await (supabase as any).rpc("get_counselor_note", { p_note_id: n.id });
        return { id: n.id, created_at: n.created_at, note_content: content || "" };
      })
    );
    setNotes(decrypted);
    setRecommendations(recsRes.data || []);
  };

  const closeCaseDetail = () => {
    setActiveCase(null);
    setNotes([]);
    setRecommendations([]);
    setNewNote("");
    setNewRecommendation("");
  };

  const createCase = async () => {
    if (!selectedNewStudent || !profile.schoolId) {
      toast({ title: "שגיאה", description: "נא לבחור תלמיד/ה", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("counselor_cases").insert({
      school_id: profile.schoolId,
      student_id: selectedNewStudent,
      counselor_id: profile.id,
      status: "new",
      flagged_reason: flagReason || "self_referral",
    });
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "תיק מעקב נפתח" });
    setNewDialogOpen(false);
    setSelectedNewStudent(null);
    setFlagReason("");
    setStudentSearch("");
    loadCases();
  };

  const updateStatus = async (status: string) => {
    if (!activeCase) return;
    const { error } = await (supabase as any).from("counselor_cases").update({ status }).eq("id", activeCase.id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setActiveCase({ ...activeCase, status });
    setCases((prev) => prev.map((c) => (c.id === activeCase.id ? { ...c, status } : c)));
  };

  const addNote = async () => {
    if (!activeCase || !newNote.trim()) return;
    const { error } = await (supabase as any).from("counselor_notes").insert({
      case_id: activeCase.id,
      counselor_id: profile.id,
      note_content: newNote.trim(),
    });
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setNewNote("");
    openCaseDetail(activeCase);
  };

  const sendRecommendation = async () => {
    if (!activeCase || !newRecommendation.trim()) return;
    const student = studentById(activeCase.student_id);
    if (!student?.class_id) {
      toast({ title: "שגיאה", description: "לא נמצאה כיתה לתלמיד/ה", variant: "destructive" });
      return;
    }
    const { data: homeroomRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "educator")
      .eq("homeroom_class_id", student.class_id);

    if (!homeroomRoles || homeroomRoles.length === 0) {
      toast({ title: "שגיאה", description: "לא נמצא/ה מחנך/ת רשום/ה לכיתה זו", variant: "destructive" });
      return;
    }

    const { error } = await (supabase as any).from("counselor_recommendations").insert(
      homeroomRoles.map((r: any) => ({
        case_id: activeCase.id,
        counselor_id: profile.id,
        teacher_id: r.user_id,
        recommendation_text: newRecommendation.trim(),
      }))
    );
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "ההמלצה נשלחה למחנך/ת" });
    setNewRecommendation("");
    openCaseDetail(activeCase);
  };

  const filteredStudents = students.filter((s) => s.full_name.includes(studentSearch)).slice(0, 20);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> ניהול תיקי מעקב
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1 flex items-center gap-1">
            <Lock className="h-3 w-3" /> תוכן הרשומות גלוי רק לך — לא לצוות, לא להנהלה
          </p>
        </div>
        <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> תיק חדש
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">פתיחת תיק מעקב</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium">חיפוש תלמיד/ה</label>
                <Input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="הקלד/י שם..." />
                {studentSearch && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                    {filteredStudents.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedNewStudent(s.id);
                          setStudentSearch(s.full_name);
                        }}
                        className={`w-full text-right px-3 py-2 text-sm hover:bg-muted/50 ${selectedNewStudent === s.id ? "bg-primary/10" : ""}`}
                      >
                        {s.full_name}
                      </button>
                    ))}
                    {filteredStudents.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">לא נמצאו תוצאות</p>}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">סיבת הפנייה (אופציונלי)</label>
                <Textarea value={flagReason} onChange={(e) => setFlagReason(e.target.value)} rows={2} placeholder="פנייה עצמית / הפניית מחנך / הורה..." />
              </div>
              <Button onClick={createCase} className="w-full" disabled={!selectedNewStudent}>
                פתח תיק
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-heading font-medium">אין תיקי מעקב פתוחים</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => {
            const student = studentById(c.student_id);
            const statusConf = STATUS_LABELS[c.status] || STATUS_LABELS.new;
            return (
              <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openCaseDetail(c)}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-heading font-bold">{student?.full_name || "תלמיד/ה"}</p>
                    <p className="text-xs text-muted-foreground mt-1">נפתח ב-{format(new Date(c.created_at), "dd/MM/yyyy")}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${statusConf.color}`}>{statusConf.label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Case detail dialog */}
      <Dialog open={!!activeCase} onOpenChange={(open) => !open && closeCaseDetail()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {activeCase && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">{studentById(activeCase.student_id)?.full_name || "תיק מעקב"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">סטטוס טיפול</label>
                  <Select value={activeCase.status} onValueChange={updateStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, conf]) => (
                        <SelectItem key={value} value={value}>
                          {conf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-sm font-heading font-bold mb-2 flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" /> יומן שיחות (מוצפן, אישי בלבד)
                  </p>
                  <div className="flex gap-2 mb-3">
                    <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} placeholder="תיעוד שיחה, תצפית..." />
                    <Button onClick={addNote} disabled={!newNote.trim()}>
                      הוסף
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {notes.length === 0 && <p className="text-xs text-muted-foreground">אין רשומות עדיין</p>}
                    {notes.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-lg bg-muted/50 text-sm">
                        <p className="whitespace-pre-line">{n.note_content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-heading font-bold mb-2 flex items-center gap-1">
                    <Send className="h-3.5 w-3.5" /> המלצה למחנך/ת (ללא פרטים רפואיים)
                  </p>
                  <div className="flex gap-2 mb-3">
                    <Textarea
                      value={newRecommendation}
                      onChange={(e) => setNewRecommendation(e.target.value)}
                      rows={2}
                      placeholder='למשל: "אנא הראו התחשבות מיוחדת בלו"ז המבחנים החודש"'
                    />
                    <Button onClick={sendRecommendation} disabled={!newRecommendation.trim()}>
                      שלח
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {recommendations.map((r) => (
                      <div key={r.id} className="p-2.5 rounded-lg bg-info/5 border border-info/20 text-sm">
                        <p>{r.recommendation_text}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default CounselorCasesPage;
