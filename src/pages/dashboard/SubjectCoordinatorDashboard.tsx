import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  BookOpen, Users, GraduationCap, TrendingUp, Plus, Calendar,
  ClipboardList, BarChart3, Bell,
} from "lucide-react";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GRADES } from "@/lib/constants";
import { format } from "date-fns";

interface Stats {
  teacherCount: number;
  classCount: number;
  subjectAvg: number | null;
  pendingExams: number;
}
interface ExamProposal {
  id: string;
  title: string;
  grade: string;
  event_date: string;
  status: string;
}

const SubjectCoordinatorDashboard = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [subject, setSubject] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ teacherCount: 0, classCount: 0, subjectAvg: null, pendingExams: 0 });
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);
  const [exams, setExams] = useState<ExamProposal[]>([]);
  const [gradeAverages, setGradeAverages] = useState<{ grade: string; avg: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", grade: "", event_date: "", notes: "" });

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

  const load = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: myRole } = await supabase
      .from("user_roles").select("subject")
      .eq("user_id", profile.id).eq("role", "subject_coordinator").maybeSingle();
    const mySubject = myRole?.subject || null;
    setSubject(mySubject);
    if (!mySubject) {
      setLoading(false);
      return;
    }

    // lessons and submissions are queried through SECURITY DEFINER RPCs, not
    // directly: subject_coordinator has no RLS access to either table (verified
    // against every policy on both), so the previous direct queries silently
    // returned empty arrays - "כיתות מלמדות" always showed 0 and "ממוצע כללי
    // במקצוע" always showed "-" even when real data existed.
    const [teacherRolesRes, examsRes, classCountRes, gradeStatsRes] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "professional_teacher").eq("subject", mySubject),
      supabase.from("grade_events").select("id, title, grade, event_date, status")
        .eq("school_id", profile.schoolId).eq("subject", mySubject).order("event_date", { ascending: false }),
      supabase.rpc("get_subject_coordinator_class_count", { p_subject: mySubject }),
      supabase.rpc("get_subject_coordinator_grade_stats", { p_subject: mySubject }),
    ]);

    const teacherIds = Array.from(new Set((teacherRolesRes.data || []).map((r: any) => r.user_id)));
    let teacherProfiles: { id: string; full_name: string }[] = [];
    if (teacherIds.length) {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds).eq("school_id", profile.schoolId);
      teacherProfiles = data || [];
    }
    setTeachers(teacherProfiles);

    const examsList: ExamProposal[] = examsRes.data || [];
    setExams(examsList);

    const gradeStats = gradeStatsRes.data || [];
    const gradeAvgs = gradeStats.map((row: any) => ({ grade: row.grade, avg: row.avg_grade }));
    setGradeAverages(gradeAvgs);

    const totalCount = gradeStats.reduce((sum: number, r: any) => sum + r.grade_count, 0);
    const overallAvg = totalCount > 0
      ? Math.round(gradeStats.reduce((sum: number, r: any) => sum + r.avg_grade * r.grade_count, 0) / totalCount)
      : null;

    setStats({
      teacherCount: teacherProfiles.length,
      classCount: classCountRes.data || 0,
      subjectAvg: overallAvg,
      pendingExams: examsList.filter((e) => e.status === "proposed").length,
    });

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile.id, profile.schoolId]);

  const proposeExam = async () => {
    if (!form.title || !form.grade || !form.event_date || !subject || !profile.schoolId) {
      toast({ title: "נא למלא את כל השדות", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("grade_events").insert({
      school_id: profile.schoolId,
      grade: form.grade as any,
      title: form.title,
      subject,
      event_type: "exam",
      event_date: form.event_date,
      status: "proposed",
      proposed_by: profile.id,
      notes: form.notes || null,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "✅ הבחינה הוצעה - ממתינה לאישור הנהלה" });
    setDialogOpen(false);
    setForm({ title: "", grade: "", event_date: "", notes: "" });
    load();
  };

  if (!loading && !subject) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-center text-muted-foreground p-8">
        <p>לא נמצא מקצוע משויך לתפקיד רכז/ת המקצוע שלך. פנה/י למנהל המערכת.</p>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center gap-4">
        {profile.avatar && <AvatarPreview config={profile.avatar} size={72} />}
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">שלום, {profile.fullName} 👋</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="font-heading">רכז/ת מקצוע</Badge>
            {subject && <Badge variant="outline" className="font-heading">{subject}</Badge>}
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "מורים במקצוע", value: stats.teacherCount, color: "text-primary" },
          { icon: BookOpen, label: "כיתות מלמדות", value: stats.classCount, color: "text-info" },
          { icon: TrendingUp, label: "ממוצע כללי במקצוע", value: stats.subjectAvg ?? "-", color: "text-success" },
          { icon: Bell, label: "הצעות ממתינות", value: stats.pendingExams, color: stats.pendingExams > 0 ? "text-warning" : "text-muted-foreground" },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="py-4 text-center">
              <s.icon className={`h-7 w-7 mx-auto mb-2 ${s.color}`} />
              <p className="text-2xl font-heading font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground font-body">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <h2 className="font-heading font-bold text-lg mb-3">פעולות מהירות</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: GraduationCap, label: "שיבוץ מורים", path: "/dashboard/assign-teachers", color: "text-primary" },
            { icon: BookOpen, label: "תכנון סילבוס", path: "/dashboard/syllabus-planner", color: "text-secondary" },
            { icon: Calendar, label: "לוח זמנים", path: "/dashboard/schedule", color: "text-accent" },
            { icon: ClipboardList, label: "בניית מערכת שעות", path: "/dashboard/timetable-builder", color: "text-warning" },
          ].map((a, i) => (
            <Card key={i} className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5" onClick={() => navigate(a.path)}>
              <CardContent className="py-5 text-center">
                <a.icon className={`h-7 w-7 mx-auto mb-2 ${a.color}`} />
                <p className="text-sm font-heading font-bold">{a.label}</p>
              </CardContent>
            </Card>
          ))}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 border-dashed">
                <CardContent className="py-5 text-center">
                  <Plus className="h-7 w-7 mx-auto mb-2 text-warning" />
                  <p className="text-sm font-heading font-bold">הצע/י בחינה</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">הצעת בחינה במקצוע {subject}</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <Input placeholder="כותרת (למשל: מבחן מחצית)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                  <SelectTrigger><SelectValue placeholder="בחר שכבה" /></SelectTrigger>
                  <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}׳</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                <Textarea placeholder="הערות (אופציונלי)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                <Button onClick={proposeExam} className="w-full">שלח/י הצעה להנהלה</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div variants={item}>
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5" /> בחינות במקצוע</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {exams.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין הצעות בחינה</p>}
              {exams.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                  <div>
                    <p className="text-sm font-heading font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">שכבה {e.grade}׳ · {format(new Date(e.event_date), "dd/MM/yyyy")}</p>
                  </div>
                  <Badge variant={e.status === "approved" ? "secondary" : e.status === "proposed" ? "outline" : "destructive"}>
                    {e.status === "approved" ? "אושר" : e.status === "proposed" ? "ממתין" : e.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" /> ממוצע לפי שכבה</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {gradeAverages.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין מספיק נתוני ציונים</p>}
              {gradeAverages.sort((a, b) => a.grade.localeCompare(b.grade)).map((g) => (
                <div key={g.grade} className="flex items-center gap-3">
                  <span className="text-xs font-heading font-bold w-8">{g.grade}׳</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${g.avg}%` }} />
                  </div>
                  <span className="text-xs font-heading font-bold w-8 text-left">{g.avg}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={item}>
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><Users className="h-5 w-5" /> מורי המקצוע</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {teachers.length === 0 && <p className="text-sm text-muted-foreground">לא נמצאו מורים משויכים למקצוע זה</p>}
            {teachers.map((t) => (
              <Badge key={t.id} variant="outline" className="font-body">{t.full_name}</Badge>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default SubjectCoordinatorDashboard;
