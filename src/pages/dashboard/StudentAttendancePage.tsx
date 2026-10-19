import { useState, useEffect, useCallback, useMemo } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { uploadPrivateFile } from "@/lib/privateFiles";
import { useToast } from "@/hooks/use-toast";
import { SubjectSticker } from "@/components/SubjectSticker";
import { ToolSticker } from "@/components/ToolSticker";

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
        // uploader-scoped folder (parent or student), not the justification's student_id
        attachmentUrl = await uploadPrivateFile("absence-justifications", profile.id, `${Date.now()}.${ext}`, attachmentFile);
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

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  const selected = records.find(r => r.id === selectedRecordId);
  const praise = notes.filter(n => POSITIVE.includes(n.category));
  const remarks = notes.filter(n => !POSITIVE.includes(n.category));
  const margin = Math.max(0, 15 - stats.absencePct);
  const fmt = (d: string) => d ? new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }) : "";

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-[22px]">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <ToolSticker id="attendance" size={52} className="max-md:w-10 max-md:h-10" />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading font-black text-[26px] md:text-[30px] leading-none">{isParentView ? `הנוכחות של ${studentName}` : "הנוכחות שלי"}</h1>
          <p className="font-body font-semibold text-sm leading-none text-muted-foreground max-md:hidden">חיסורים, איחורים וציונים לשבח מכל השיעורים</p>
        </div>
      </div>

      {/* Rate + counters */}
      <div className="grid grid-cols-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-2 md:gap-3.5">
        <div className={`col-span-3 md:col-span-1 flex flex-col gap-3 px-[22px] py-5 rounded-[22px] text-white shadow-raised ${stats.nearRedLine ? "bg-[#B42318]" : "bg-[#1B2333]"}`}>
          <div className="flex items-baseline gap-2.5">
            <span className="font-heading font-black text-[50px] md:text-[54px] leading-none">{stats.presencePct}%</span>
            <span className="font-body font-bold text-sm text-white/80">נוכחות השנה</span>
          </div>
          <div className="relative h-3 rounded-md bg-white/15" role="progressbar" aria-valuenow={stats.presencePct} aria-valuemin={0} aria-valuemax={100} aria-label="אחוז נוכחות">
            <div className="h-full rounded-md bg-[#23B26D]" style={{ width: `${stats.presencePct}%` }} />
            <div className="absolute -top-[5px] -bottom-[5px] right-[85%] w-[3px] rounded-sm bg-[#FF8A7A]" title="הקו האדום: 15% היעדרות" />
          </div>
          <p className="font-body font-semibold text-[12.5px] leading-snug text-white/75">
            {stats.nearRedLine
              ? `${stats.absencePct}% היעדרות - עברת את הקו האדום של משרד החינוך (15%).`
              : `הקו האדום של משרד החינוך הוא 15% היעדרות. יש לך עוד מרווח של ${margin}%.`}
          </p>
        </div>
        {[
          { v: stats.unexcused, label: "חיסורים", cls: "bg-destructive-soft text-destructive -rotate-2" },
          { v: stats.lates, label: "איחורים", cls: "bg-warning-soft text-warning rotate-2" },
          { v: stats.highlights, label: "ציונים לשבח", cls: "bg-success-soft text-success -rotate-1" },
        ].map(s => (
          <div key={s.label} className={`flex flex-col justify-end gap-1.5 md:gap-2 p-3 md:p-4 rounded-[18px] md:rounded-[20px] border-[3px] border-white dark:border-card shadow-[0_8px_16px_-11px_rgba(40,30,15,.45)] ${s.cls}`}>
            <span className="font-heading font-black text-2xl md:text-[34px] leading-none">{s.v}</span>
            <span className="font-body font-extrabold text-[12.5px] md:text-sm leading-tight">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        {/* Absences */}
        <section className="flex flex-col gap-2.5">
          <h2 className="font-heading font-black text-[17px] md:text-lg leading-none px-1 pb-1">חיסורים ואיחורים</h2>
          {records.length === 0 ? (
            <EmptyCard text="אין חיסורים או איחורים. כל הכבוד!" />
          ) : records.map(r => {
            const tag = r.status === "excused" || r.justificationStatus === "approved" ? TAGS.approved
              : r.justificationStatus === "pending" ? TAGS.pending
              : r.justificationStatus === "rejected" ? TAGS.rejected
              : r.status === "late" ? TAGS.late : null;
            return (
              <div key={r.id} className="flex items-center gap-3 px-3.5 py-3 rounded-[20px] bg-card shadow-[0_8px_16px_-12px_rgba(40,30,15,.4)]">
                <SubjectSticker subject={r.subject} size={42} />
                <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
                  <span className="font-heading font-extrabold text-[15px] leading-tight truncate">{r.subject}</span>
                  <span className="font-body font-semibold text-[12.5px] leading-none text-muted-foreground">{r.status === "late" ? "איחור" : "חיסור"} · שיעור {r.lesson_number} · {fmt(r.date)}</span>
                </div>
                {tag ? (
                  <span className={`px-[9px] py-[5px] rounded-[9px] border-2 border-white dark:border-card font-body font-extrabold text-xs leading-none rotate-3 shadow-sticker ${tag.cls}`}>{tag.label}</span>
                ) : (
                  <button type="button" onClick={() => setSelectedRecordId(r.id)} className="px-3 py-[9px] rounded-xl bg-primary text-primary-foreground font-body font-extrabold text-[13px] leading-none">
                    <span className="md:hidden">הצדקה</span><span className="max-md:hidden">הגש/י הצדקה</span>
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {/* Praise (and other lesson remarks) */}
        <section className="flex flex-col gap-2.5">
          <h2 className="font-heading font-black text-[17px] md:text-lg leading-none px-1 pb-1">ציונים לשבח</h2>
          {praise.length === 0 ? <EmptyCard text="עדיין לא נרשמו ציונים לשבח" /> : praise.map(n => <NoteCard key={n.id} n={n} fmt={fmt} />)}
          {remarks.length > 0 && (
            <>
              <h2 className="font-heading font-black text-[17px] md:text-lg leading-none px-1 pt-3 pb-1">הערות מהשיעורים</h2>
              {remarks.map(n => <NoteCard key={n.id} n={n} fmt={fmt} />)}
            </>
          )}
        </section>
      </div>

      {/* Justification sheet */}
      <Dialog open={!!selectedRecordId} onOpenChange={o => { if (!o) { setSelectedRecordId(null); setExcuseReason(""); setExcuseText(""); setAttachmentFile(null); } }}>
        <DialogContent className="rounded-[28px] p-6 max-w-md text-right bg-background gap-3.5" dir="rtl">
          <DialogHeader className="space-y-1.5 text-right">
            <DialogTitle className="font-heading font-black text-xl leading-tight">הצדקת {selected?.status === "late" ? "איחור" : "חיסור"}</DialogTitle>
            {selected && <p className="font-body font-semibold text-[13px] text-muted-foreground">{selected.subject} · שיעור {selected.lesson_number} · {fmt(selected.date)}</p>}
          </DialogHeader>
          <p className="font-body font-extrabold text-[13px] leading-none">מה הסיבה?</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="סיבת ההיעדרות">
            {JUSTIFICATION_REASONS.map(r => {
              const on = excuseReason === r.value;
              return (
                <button key={r.value} type="button" role="radio" aria-checked={on} onClick={() => setExcuseReason(r.value)}
                  className={`px-3 py-[9px] rounded-full font-body font-extrabold text-[13px] leading-none shadow-[0_3px_8px_-5px_rgba(40,30,15,.35)] ${on ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>
                  {r.label}
                </button>
              );
            })}
          </div>
          <Textarea value={excuseText} onChange={e => setExcuseText(e.target.value)} placeholder="פירוט נוסף (לא חובה)" className="rounded-[14px] bg-card min-h-[70px] text-sm" />
          <input id="justification-attachment" type="file" accept="image/*,.pdf" className="hidden" onChange={e => setAttachmentFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => document.getElementById("justification-attachment")?.click()}
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-[14px] border-2 border-dashed border-input text-right">
            <ToolSticker id="drive" size={32} />
            <span className="font-body font-bold text-[13.5px] leading-tight text-text-secondary truncate">{attachmentFile ? attachmentFile.name : "צירוף אישור רפואי או מכתב הורים"}</span>
          </button>
          <Button onClick={handleExcuseSubmit} disabled={submittingExcuse || !excuseReason} className="w-full h-12 rounded-[13px] font-body font-extrabold text-[15px] gap-2">
            {submittingExcuse && <Loader2 className="h-5 w-5 animate-spin" />}
            שלח/י למחנך/ת
          </Button>
          <p className="text-center font-body font-semibold text-[12.5px] text-muted-foreground -mt-1">הבקשה תופיע אצל המחנך/ת לאישור</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const POSITIVE = ["excellence", "positive_participation", "helped_peer", "custom_positive"];

const NOTE_KINDS: Record<string, { label: string; icon: string }> = {
  excellence: { label: "הצטיינות", icon: "trophy" },
  positive_participation: { label: "השתתפות פעילה", icon: "star" },
  helped_peer: { label: "עזרה לחבר/ה", icon: "people" },
  disruption: { label: "הפרעה", icon: "alert" },
  phone: { label: "שימוש בטלפון", icon: "chat" },
  no_homework: { label: "חסרים שיעורי בית", icon: "tasks" },
  // Events a school added to its roll call menu; the event name is in the note.
  custom_positive: { label: "הערה חיובית", icon: "star" },
  custom_negative: { label: "הערת משמעת", icon: "alert" },
};

const TAGS = {
  approved: { label: "הוצדק", cls: "bg-success-soft text-success" },
  pending: { label: "ממתין לאישור", cls: "bg-warning-soft text-warning" },
  rejected: { label: "הצדקה נדחתה", cls: "bg-destructive-soft text-destructive" },
  late: { label: "איחור", cls: "bg-muted text-muted-foreground" },
};

function NoteCard({ n, fmt }: { n: LessonNote; fmt: (d: string) => string }) {
  const kind = NOTE_KINDS[n.category] || { label: "הערה", icon: "docs" };
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-[20px] bg-card shadow-[0_8px_16px_-12px_rgba(40,30,15,.4)]">
      <ToolSticker id={kind.icon} size={44} className="max-md:w-10 max-md:h-10" />
      <div className="flex-1 flex flex-col gap-[5px]">
        <span className="font-heading font-extrabold text-[15px] leading-tight">{kind.label}</span>
        {n.comment && <p className="font-body font-semibold text-[13.5px] leading-relaxed text-text-secondary">{n.comment}</p>}
        <span className="font-body font-bold text-xs leading-none text-hint">{n.subject} · {fmt(n.date)}</span>
      </div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="px-4 py-8 rounded-[20px] border-2 border-dashed border-input text-center font-body font-bold text-sm text-muted-foreground">{text}</div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
