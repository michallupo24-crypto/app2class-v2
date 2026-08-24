import { useState, useEffect, useCallback, useMemo } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUp, Calendar, AlertTriangle, CheckCircle2, Star, Clock, Heart, Minus, ShieldCheck, Paperclip, Send, Trophy, Hand, HeartHandshake, Smartphone, XCircle, FileText } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const JUSTIFICATION_REASONS: { value: string; label: string }[] = [
  { value: "illness", label: "מחלה" },
  { value: "medical_appointment", label: "תור רפואי" },
  { value: "family_event", label: "אירוע משפחתי" },
  { value: "religious_observance", label: "חג / מועד דתי" },
  { value: "transportation", label: "בעיית הסעה" },
  { value: "other", label: "אחר" },
];

/* ─── Types ───────────────────────────────────────────── */
interface AttendanceRecord {
  id: string;
  date: string;
  lesson_number: string;
  subject: string;
  status: "absent" | "late" | "present" | "excused";
  justificationStatus: "pending" | "approved" | "rejected" | null;
}

interface LessonNote {
  id: string;
  date: string;
  category: string;
  subject: string;
  comment?: string;
}

export default function StudentAttendancePage() {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { studentId: paramId } = useParams();
  const studentId = paramId || profile.id;
  const isParentView = !!paramId && paramId !== profile.id;

  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [notes, setNotes] = useState<LessonNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const [excuseText, setExcuseText] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submittingExcuse, setSubmittingExcuse] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [totalLessons, setTotalLessons] = useState<number | null>(null);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

  /* ── Data Logic ───────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    
    const { data: p } = await supabase.from("profiles").select("full_name, class_id").eq("id", studentId).single();
    if (isParentView && p) setStudentName(p.full_name);

    // Real denominator for the attendance rate: how many lessons this
    // student's class actually had, not a made-up formula.
    if (p?.class_id) {
      const { count } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("class_id", p.class_id);
      setTotalLessons(count ?? 0);
    } else {
      setTotalLessons(0);
    }

    // 1. Fetch attendance
    const { data: attData } = await supabase
      .from("attendance")
      .select(`
        id,
        status,
        lessons (lesson_date, lesson_number, subject)
      `)
      .eq("student_id", studentId)
      .in("status", ["absent", "late", "excused"]);

    const attendanceIds = (attData || []).map((row: any) => row.id);
    const justificationByAttendance: Record<string, string> = {};
    if (attendanceIds.length > 0) {
      const { data: justData } = await (supabase as any)
        .from("absence_justifications")
        .select("attendance_id, status")
        .in("attendance_id", attendanceIds)
        .order("created_at", { ascending: false });
      (justData || []).forEach((j: any) => {
        if (!justificationByAttendance[j.attendance_id]) justificationByAttendance[j.attendance_id] = j.status;
      });
    }

    const recordsList: AttendanceRecord[] = (attData || []).map((row: any) => ({
      id: row.id,
      status: row.status,
      date: row.lessons?.lesson_date,
      lesson_number: row.lessons?.lesson_number?.toString() || "1",
      subject: row.lessons?.subject || "כללי",
      justificationStatus: (justificationByAttendance[row.id] as any) || null,
    }));
    setRecords(recordsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    // 2. Fetch lesson notes (Positive & Disciplinary)
    const { data: notesData } = await supabase
      .from("lesson_notes")
      .select(`
        id,
        category,
        note,
        lessons (lesson_date, subject)
      `)
      .eq("student_id", studentId);

    const notesList: LessonNote[] = (notesData || []).map((row: any) => ({
      id: row.id,
      category: row.category,
      comment: row.note,
      date: row.lessons?.lesson_date,
      subject: row.lessons?.subject || "כללי",
    }));
    setNotes(notesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    setLoading(false);
  }, [studentId, isParentView]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Calculations ─────────────────────────────────────── */
  const stats = useMemo(() => {
    const unexcused = records.filter(r => r.status === "absent" && r.justificationStatus !== "approved").length;
    const lates = records.filter(r => r.status === "late").length;
    // Real rate: unexcused absences out of the class's actual lesson count
    // (previously a fake "100 - unexcused*2" formula unrelated to real data).
    const absencePct = totalLessons ? Math.min(100, Math.round((unexcused / totalLessons) * 100)) : 0;
    const presencePct = totalLessons ? Math.max(0, 100 - absencePct) : 100;
    // Spec: Ministry of Education red-line at 15% unexcused absence
    const nearRedLine = totalLessons !== null && totalLessons > 0 && absencePct >= 15;
    return {
      presencePct, absencePct, unexcused, lates, nearRedLine,
      highlights: notes.filter(n => ["excellence", "positive_participation", "helped_peer"].includes(n.category)).length,
    };
  }, [records, notes, totalLessons]);

  const handleExcuseSubmit = async () => {
    if (!selectedRecordId || !excuseReason) return;
    setSubmittingExcuse(true);
    try {
      let attachmentUrl: string | null = null;
      if (attachmentFile) {
        const ext = attachmentFile.name.split(".").pop();
        const path = `absence-justifications/${profile.id}/${Date.now()}.${ext}`;
        // uploader-scoped folder (parent or student), not the justification's student_id
        const { error: uploadErr } = await supabase.storage.from("lesson-files").upload(path, attachmentFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        attachmentUrl = supabase.storage.from("lesson-files").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await (supabase as any).from("absence_justifications").insert({
        attendance_id: selectedRecordId,
        student_id: studentId,
        reason: excuseReason,
        details: excuseText.trim() || null,
        attachment_url: attachmentUrl,
      });
      if (error) throw error;

      toast({ title: "בקשת הצדקה נשלחה", description: "הבקשה ממתינה לאישור המחנך/ת." });
      loadData();
    } catch (e: any) {
      toast({ title: "שגיאה בשליחת ההצדקה", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingExcuse(false);
      setSelectedRecordId(null);
      setExcuseReason("");
      setExcuseText("");
      setAttachmentFile(null);
    }
  };

  const getIconForCategory = (cat: string) => {
    switch (cat) {
      case "excellence": return Trophy;
      case "positive_participation": return Hand;
      case "helped_peer": return HeartHandshake;
      case "disruption": return AlertTriangle;
      case "phone": return Smartphone;
      case "no_homework": return XCircle;
      default: return FileText;
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl mx-auto px-4 py-10 space-y-12 pb-32">
      
      {/* 1. HEADER & IDENTITY */}
      <motion.div variants={item} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
           <h1 className="text-3xl font-heading font-black tracking-tighter flex items-center gap-3">
              <Clock className="h-8 w-8 text-primary" /> יומן נוכחות ואירועים
           </h1>
           <p className="text-sm text-muted-foreground font-bold">
              {isParentView ? `מעקב נוכחות עבור: ${studentName}` : "היסטוריית חיסורים, איחורים וציונים לשבח"}
           </p>
        </div>
        <div className="flex items-center gap-3">
           <Badge className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">מתעדכן בזמן אמת</Badge>
        </div>
      </motion.div>

      {/* 2. ATTENDANCE PULSE CARD */}
      <motion.div variants={item}>
         <Card className={`border-none text-primary-foreground rounded-lg p-10 overflow-hidden relative ${stats.nearRedLine ? "bg-destructive" : "bg-primary"}`}>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
               <div className="space-y-4 text-center md:text-right">
                  <p className="text-[10px] uppercase font-black tracking-widest text-primary-foreground/70">מדד נוכחות והתמדה</p>
                  <h2 className="text-6xl font-heading font-black">{stats.presencePct}%</h2>
                  <div className="flex items-center gap-2 font-bold text-xs text-primary-foreground/80">
                     {stats.nearRedLine ? (
                        <><AlertTriangle className="h-4 w-4" /> {stats.absencePct}% היעדרות — מתקרב לקו האדום (15%)</>
                     ) : (
                        <><ShieldCheck className="h-4 w-4" /> רמת התמדה יציבה</>
                     )}
                  </div>
               </div>
               <div className="flex-1 w-full max-w-md space-y-6">
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-primary-foreground/70">
                     <span>Presence Health</span>
                     <span>Excellent</span>
                  </div>
                  <Progress value={stats.presencePct} className="h-4 bg-primary-foreground/10" />
                  <div className="grid grid-cols-3 gap-4">
                     <div className="text-center"><p className="text-xl font-black">{stats.unexcused}</p><p className="text-[9px] uppercase font-black text-primary-foreground/70">חיסורים</p></div>
                     <div className="text-center"><p className="text-xl font-black">{stats.lates}</p><p className="text-[9px] uppercase font-black text-primary-foreground/70">איחורים</p></div>
                     <div className="text-center"><p className="text-xl font-black">{stats.highlights}</p><p className="text-[9px] uppercase font-black text-primary-foreground/70">ציונים לשבח</p></div>
                  </div>
               </div>
            </div>
         </Card>
      </motion.div>

      {/* 3. TWO-COLUMN SPLIT: Absences vs Commendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         
         {/* Absences Section */}
         <motion.div variants={item} className="space-y-6">
            <div className="flex items-center justify-between px-4">
               <h3 className="text-xl font-heading font-black flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" /> חיסורים ואיחורים
               </h3>
               <Badge variant="outline" className="rounded-full text-destructive border-destructive/30 px-3">{records.length}</Badge>
            </div>

            {records.length === 0 ? (
               <Card className="border-dashed border-2 border-border bg-transparent rounded-lg p-10 text-center space-y-3 opacity-50">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-success" />
                  <p className="text-sm font-bold font-heading">אין אירועי משמעת או חיסורים להצגה</p>
               </Card>
            ) : (
               <div className="space-y-4">
                  {records.map(r => (
                    <Card key={r.id} className="bg-card rounded-lg p-6 shadow-sm hover:shadow-md transition-all overflow-hidden">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-5">
                             <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${r.status === "absent" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                                {r.status === "absent" ? <Minus className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                             </div>
                             <div>
                                <p className="text-sm font-black">{r.subject}</p>
                                <p className="text-[10px] text-muted-foreground font-bold">שיעור {r.lesson_number} • {new Date(r.date).toLocaleDateString("he-IL")}</p>
                             </div>
                          </div>
                          {r.status === "excused" ? (
                             <Badge className="bg-success/10 text-success border-transparent rounded-lg text-[9px] font-black uppercase">מוצדק</Badge>
                          ) : r.justificationStatus === "pending" ? (
                             <Badge className="bg-warning/10 text-warning border-transparent rounded-lg text-[9px] font-black uppercase">ממתין לאישור מחנך</Badge>
                          ) : r.justificationStatus === "rejected" ? (
                             <Badge variant="outline" className="rounded-lg text-[9px] font-black uppercase text-destructive border-destructive/30">הצדקה נדחתה</Badge>
                          ) : (
                             <Button size="sm" variant="outline" className="rounded-lg border-border hover:bg-muted text-[10px] font-black uppercase h-9 px-4" onClick={() => setSelectedRecordId(r.id)}>הגש הצדקה</Button>
                          )}
                       </div>
                    </Card>
                  ))}
               </div>
            )}
         </motion.div>

         {/* Commendations Section */}
         <motion.div variants={item} className="space-y-6">
            <div className="flex items-center justify-between px-4">
               <h3 className="text-xl font-heading font-black flex items-center gap-3">
                  <Star className="h-5 w-5 text-warning" /> קיר הצטיינות וציונים לשבח
               </h3>
               <Badge className="bg-warning/10 text-warning rounded-full px-3">{notes.length}</Badge>
            </div>

            {notes.length === 0 ? (
               <Card className="border-dashed border-2 border-border bg-transparent rounded-lg p-10 text-center space-y-3 opacity-50">
                  <Heart className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm font-bold font-heading">עדיין לא נרשמו הערות מיוחדות</p>
               </Card>
            ) : (
               <div className="space-y-4">
                  {notes.map(n => {
                    const NoteIcon = getIconForCategory(n.category);
                    return (
                    <Card key={n.id} className="bg-warning/5 rounded-lg p-6 border border-warning/20 shadow-sm hover:shadow-md transition-all">
                       <div className="flex items-start gap-5">
                          <div className="bg-card w-14 h-14 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                             <NoteIcon className="h-6 w-6 text-warning" />
                          </div>
                          <div className="flex-1 space-y-2">
                             <div className="flex justify-between items-start">
                                <p className="text-sm font-black">{n.subject}</p>
                                <p className="text-[10px] text-warning font-bold">{new Date(n.date).toLocaleDateString("he-IL")}</p>
                             </div>
                             {n.comment && <p className="text-[11px] text-muted-foreground italic leading-relaxed">" {n.comment} "</p>}
                          </div>
                       </div>
                    </Card>
                    );
                  })}
               </div>
            )}
         </motion.div>
      </div>

      {/* EXCUSE MODAL */}
      <Dialog open={!!selectedRecordId} onOpenChange={o => { if (!o) { setSelectedRecordId(null); setExcuseReason(""); setExcuseText(""); setAttachmentFile(null); } }}>
         <DialogContent className="rounded-lg p-10 max-w-md text-right" dir="rtl">
            <DialogHeader className="mb-6">
               <DialogTitle className="text-2xl font-black font-heading flex items-center gap-3">
                  <FileUp className="h-7 w-7 text-primary" /> הגשת הצדקה רשמית
               </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
               <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 flex items-center gap-4">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                     <p className="text-sm font-black italic">בקשה עבור חיסור בתאריך {records.find(r => r.id === selectedRecordId)?.date}</p>
                  </div>
               </div>
               <div className="space-y-2">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest px-2">סיבת ההיעדרות</p>
                  <Select value={excuseReason} onValueChange={setExcuseReason}>
                     <SelectTrigger className="rounded-lg border-border bg-muted/50 h-12 text-sm">
                        <SelectValue placeholder="בחר/י סיבה" />
                     </SelectTrigger>
                     <SelectContent>
                        {JUSTIFICATION_REASONS.map(r => (
                           <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest px-2">פירוט נוסף (אופציונלי)</p>
                  <Textarea
                     value={excuseText}
                     onChange={e => setExcuseText(e.target.value)}
                     placeholder="פרטים נוספים אם צריך..."
                     className="rounded-lg border-border bg-muted/50 min-h-[80px] p-4 text-sm"
                  />
               </div>
               <div className="space-y-2">
                  <input
                     id="justification-attachment"
                     type="file"
                     accept="image/*,.pdf"
                     className="hidden"
                     onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                  />
                  <Button
                     type="button"
                     variant="outline"
                     className="w-full h-12 rounded-lg border-dashed border-2 border-border text-xs font-bold gap-2"
                     onClick={() => document.getElementById("justification-attachment")?.click()}
                  >
                     {attachmentFile ? <Paperclip className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
                     {attachmentFile ? attachmentFile.name : "העלאת אישור רפואי / הורים"}
                  </Button>
               </div>
               <Button onClick={handleExcuseSubmit} disabled={submittingExcuse || !excuseReason} className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-black gap-3 transition-colors">
                  {submittingExcuse ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rotate-180" />}
                  שלח הצדקה למחנך/ת
               </Button>
            </div>
         </DialogContent>
      </Dialog>
    </motion.div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
