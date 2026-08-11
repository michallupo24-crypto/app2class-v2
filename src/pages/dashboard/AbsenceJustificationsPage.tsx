import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileCheck2, Check, X, Paperclip, Loader2 } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const REASON_LABELS: Record<string, string> = {
  illness: "מחלה",
  medical_appointment: "תור רפואי",
  family_event: "אירוע משפחתי",
  religious_observance: "חג / מועד דתי",
  transportation: "בעיית הסעה",
  other: "אחר",
};

interface JustificationRow {
  id: string;
  reason: string;
  details: string | null;
  attachment_url: string | null;
  created_at: string;
  status: string;
  studentName: string;
  lessonDate: string | null;
  subject: string | null;
}

const AbsenceJustificationsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<JustificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("absence_justifications")
      .select("id, reason, details, attachment_url, created_at, status, student_id, attendance_id, attendance(lesson_id, lessons(lesson_date, subject))")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const list: any[] = data || [];
    const studentIds: string[] = Array.from(new Set<string>(list.map((r: any) => r.student_id)));
    let namesMap: Record<string, string> = {};
    if (studentIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
      (profs || []).forEach((p: any) => { namesMap[p.id] = p.full_name; });
    }

    setRows(list.map((r: any) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      attachment_url: r.attachment_url,
      created_at: r.created_at,
      status: r.status,
      studentName: namesMap[r.student_id] || "תלמיד/ה",
      lessonDate: r.attendance?.lessons?.lesson_date || null,
      subject: r.attendance?.lessons?.subject || null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile.id]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setProcessingId(id);
    const { error } = await (supabase as any).from("absence_justifications").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "ההצדקה אושרה ✅" : "ההצדקה נדחתה" });
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
    setProcessingId(null);
  };

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <FileCheck2 className="h-7 w-7 text-primary" />הצדקות היעדרות
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">בקשות הצדקה ממתינות מתלמידי הכיתה שלך</p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground font-body">
            אין בקשות הצדקה ממתינות כרגע
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <motion.div key={r.id} variants={item}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading flex items-center justify-between">
                    <span>{r.studentName}</span>
                    <Badge variant="outline" className="text-[10px]">{REASON_LABELS[r.reason] || r.reason}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground font-body">
                    {r.lessonDate && new Date(r.lessonDate).toLocaleDateString("he-IL")}
                    {r.subject && ` • ${r.subject}`}
                  </p>
                  {r.details && <p className="text-sm font-body bg-muted/40 rounded-lg p-2">{r.details}</p>}
                  {r.attachment_url && (
                    <a href={r.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                      <Paperclip className="h-3.5 w-3.5" />צפייה באישור מצורף
                    </a>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 gap-1.5 font-heading" onClick={() => decide(r.id, "approved")} disabled={processingId === r.id}>
                      <Check className="h-3.5 w-3.5" />אשר
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5 font-heading text-destructive border-destructive/30" onClick={() => decide(r.id, "rejected")} disabled={processingId === r.id}>
                      <X className="h-3.5 w-3.5" />דחה
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default AbsenceJustificationsPage;
