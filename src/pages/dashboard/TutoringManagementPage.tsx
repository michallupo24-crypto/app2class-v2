import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, Calendar, Clock, BookOpen, MapPin, CheckCircle2, HandHelping, X } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TutoringSession {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  max_students: number | null;
  status: string;
  teacher_id: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planned: { label: "מתוכנן", color: "bg-info/10 text-info border-info/30" },
  active: { label: "פעיל", color: "bg-success/10 text-success border-success/30" },
  completed: { label: "הושלם", color: "bg-muted text-muted-foreground" },
  cancelled: { label: "בוטל", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface TutoringRequest {
  id: string;
  classId: string;
  subject: string;
  reason: string | null;
  requestedByName: string;
  className: string;
  grade: string;
}

const TutoringManagementPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [requests, setRequests] = useState<TutoringRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<TutoringRequest | null>(null);

  const [form, setForm] = useState({
    title: "", subject: "", description: "",
    session_date: "", start_time: "", end_time: "",
    room: "", max_students: "",
  });

  const loadSessions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tutoring_sessions")
      .select("*")
      .eq("school_id", profile.schoolId!)
      .order("session_date", { ascending: true });
    setSessions(data || []);
    setLoading(false);
  };

  const loadRequests = async () => {
    const { data } = await supabase
      .from("tutoring_requests")
      .select("id, class_id, subject, reason, requested_by, classes(grade, class_number)")
      .eq("status", "pending");
    const rows = data || [];
    const requesterIds = Array.from(new Set(rows.map((r: any) => r.requested_by)));
    const { data: requesterProfiles } = requesterIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", requesterIds)
      : { data: [] as any[] };
    const nameMap = new Map((requesterProfiles || []).map((p: any) => [p.id, p.full_name]));
    setRequests(rows.map((r: any) => ({
      id: r.id,
      classId: r.class_id,
      subject: r.subject,
      reason: r.reason,
      requestedByName: nameMap.get(r.requested_by) || "מחנך/ת",
      className: r.classes ? `${r.classes.grade}'${r.classes.class_number}` : "",
      grade: r.classes?.grade || "",
    })));
  };

  // No school (e.g. a system-wide admin): stop the spinner instead of loading forever.
  useEffect(() => { if (profile.schoolId) { loadSessions(); loadRequests(); } else setLoading(false); }, [profile.schoolId]);

  const dismissRequest = async (id: string) => {
    const { error } = await supabase.from("tutoring_requests")
      .update({ status: "dismissed", resolved_by: profile.id, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast({ variant: "destructive", title: "שגיאה", description: error.message }); return; }
    toast({ title: "הבקשה נדחתה" });
    loadRequests();
  };

  const startApproving = (request: TutoringRequest) => {
    setApprovingRequest(request);
    setForm({
      title: `תגבור ${request.subject} — כיתה ${request.className}`,
      subject: request.subject, description: request.reason || "",
      session_date: "", start_time: "", end_time: "", room: "", max_students: "",
    });
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.title || !form.subject || !form.session_date) {
      toast({ title: "שגיאה", description: "נא למלא שם, מקצוע ותאריך", variant: "destructive" });
      return;
    }

    let grade = approvingRequest?.grade;
    if (!grade) {
      const { data: roleData } = await supabase
        .from("user_roles").select("grade")
        .eq("user_id", profile.id).eq("role", "grade_coordinator").maybeSingle();
      grade = roleData?.grade;
    }

    if (!grade) {
      toast({ title: "שגיאה", description: "לא נמצאה שכבה", variant: "destructive" });
      return;
    }

    const { data: newSession, error } = await supabase.from("tutoring_sessions").insert({
      school_id: profile.schoolId!,
      grade: grade as any,
      title: form.title,
      subject: form.subject,
      description: form.description || null,
      session_date: form.session_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      room: form.room || null,
      max_students: form.max_students ? parseInt(form.max_students) : null,
      created_by: profile.id,
    }).select().single();

    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }

    if (approvingRequest) {
      await supabase.from("tutoring_requests").update({
        status: "approved", resolved_by: profile.id, resolved_at: new Date().toISOString(), linked_session_id: newSession.id,
      }).eq("id", approvingRequest.id);
      loadRequests();
    }

    toast({ title: "✅ תגבור נוצר בהצלחה" });
    setForm({ title: "", subject: "", description: "", session_date: "", start_time: "", end_time: "", room: "", max_students: "" });
    setApprovingRequest(null);
    setDialogOpen(false);
    loadSessions();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-warning" />
            ניהול תגבורים
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">ארגון שעות תגבור, שיבוץ מורים וקבוצות תלמידים</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setApprovingRequest(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setApprovingRequest(null)}><Plus className="h-4 w-4" /> תגבור חדש</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">{approvingRequest ? "אישור בקשת תגבור" : "יצירת תגבור חדש"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">שם התגבור</label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="מרתון מתמטיקה..." />
                </div>
                <div>
                  <label className="text-sm font-medium">מקצוע</label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="מתמטיקה..." />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">תיאור</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">תאריך</label>
                  <Input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">שעת התחלה</label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">שעת סיום</label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">חדר</label>
                  <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="חדר 204..." />
                </div>
                <div>
                  <label className="text-sm font-medium">מקסימום תלמידים</label>
                  <Input type="number" value={form.max_students} onChange={(e) => setForm({ ...form, max_students: e.target.value })} placeholder="20" />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">צור תגבור</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {requests.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2"><HandHelping className="h-4.5 w-4.5 text-primary" /> בקשות תגבור ממחנכות ({requests.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-background">
                <div>
                  <p className="text-sm font-heading font-medium">{r.className} — {r.subject}</p>
                  <p className="text-xs text-muted-foreground">{r.requestedByName}{r.reason ? `: ${r.reason}` : ""}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => startApproving(r)}><CheckCircle2 className="h-3.5 w-3.5" />אשר</Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => dismissRequest(r.id)}><X className="h-3.5 w-3.5" />דחה</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-heading font-medium">אין תגבורים מתוכננים</p>
            <p className="text-sm mt-1">צור תגבור חדש כדי להתחיל</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => {
            const statusConf = STATUS_LABELS[s.status] || STATUS_LABELS.planned;
            return (
              <Card key={s.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-heading font-bold">{s.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusConf.color}`}>{statusConf.label}</span>
                  </div>
                  <Badge variant="secondary" className="mb-2">{s.subject}</Badge>
                  {s.description && <p className="text-xs text-muted-foreground mb-2">{s.description}</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(s.session_date), "dd/MM/yyyy")}</span>
                    {s.start_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.start_time.slice(0, 5)}{s.end_time && ` - ${s.end_time.slice(0, 5)}`}</span>}
                    {s.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.room}</span>}
                    {s.max_students && <span className="flex items-center gap-1"><Users className="h-3 w-3" />עד {s.max_students}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default TutoringManagementPage;
