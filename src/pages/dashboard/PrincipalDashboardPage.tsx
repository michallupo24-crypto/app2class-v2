import { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  BarChart3, Users, BookOpen, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Loader2, Send, Radio,
  Shield, FileText, Building2, Brain, UserCheck, Crown,
  Inbox, Printer, GitBranch, History, Plus, MessageSquareReply, X,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

interface SchoolStat {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  avgGrade: number | null;
  presentToday: number | null;
  absentToday: number | null;
  pendingApprovals: number;
}

interface GradeAvg {
  grade: string;
  avg: number;
  classCount: number;
}

interface ComplianceItem {
  teacherId: string;
  teacherName: string;
  violation: string;
  type: "late_material" | "late_grade" | "overload";
  detail: string;
}

interface TeacherLoad {
  id: string;
  name: string;
  classCount: number;
  assignmentCount: number;
  avgGradeDelay: number;
  burnoutRisk: "low" | "medium" | "high";
}

interface SupervisorInquiry {
  id: string;
  subject: string;
  content: string;
  priority: "normal" | "high";
  status: "pending" | "answered" | "closed";
  response: string | null;
  createdAt: string;
}

interface YearlyTrend {
  year: number;
  avg: number;
  count: number;
}

interface Bottleneck {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
}

const PrincipalDashboardPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SchoolStat | null>(null);
  const [gradeAvgs, setGradeAvgs] = useState<GradeAvg[]>([]);
  const [compliance, setCompliance] = useState<ComplianceItem[]>([]);
  const [teacherLoads, setTeacherLoads] = useState<TeacherLoad[]>([]);
  const [inquiries, setInquiries] = useState<SupervisorInquiry[]>([]);
  const [yearlyTrend, setYearlyTrend] = useState<YearlyTrend[]>([]);

  // Broadcast dialog
  const [broadcastDialog, setBroadcastDialog] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSeverity, setBroadcastSeverity] = useState<"info" | "emergency">("info");

  // Supervisor inbox
  const [inquiryDialog, setInquiryDialog] = useState(false);
  const [inquirySubject, setInquirySubject] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");
  const [inquiryPriority, setInquiryPriority] = useState<"normal" | "high">("normal");
  const [savingInquiry, setSavingInquiry] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [savingResponse, setSavingResponse] = useState(false);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (!profile.schoolId) { setLoading(false); return; }

      // 1. Basic school stats
      const [studRes, schoolProfilesRes, classRes, approvalRes, inquiriesRes, trendRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", profile.schoolId).eq("is_approved", true),
        supabase.from("profiles").select("id").eq("school_id", profile.schoolId),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", profile.schoolId),
        supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("supervisor_inquiries")
          .select("id, subject, content, priority, status, response, created_at")
          .eq("school_id", profile.schoolId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.rpc("get_school_yearly_grade_trend", { p_school_id: profile.schoolId }),
      ]);

      setInquiries((inquiriesRes.data || []).map((i: any) => ({
        id: i.id,
        subject: i.subject,
        content: i.content,
        priority: i.priority,
        status: i.status,
        response: i.response,
        createdAt: i.created_at,
      })));
      setYearlyTrend((trendRes.data || []).map((r: any) => ({
        year: r.school_year,
        avg: r.avg_grade,
        count: r.submission_count,
      })));

      // user_roles has no school_id column, so teacher count must be scoped
      // by intersecting with this school's own profile ids.
      const schoolProfileIds = (schoolProfilesRes.data || []).map((p: any) => p.id);
      let teacherCount = 0;
      if (schoolProfileIds.length > 0) {
        const { data: schoolRoles } = await supabase.from("user_roles")
          .select("user_id, role")
          .in("user_id", schoolProfileIds)
          .in("role", ["professional_teacher", "educator", "subject_coordinator"]);
        teacherCount = new Set((schoolRoles || []).map((r: any) => r.user_id)).size;
      }

      // 2. Grade averages by school grade (ז'–י"ב)
      const { data: classes } = await supabase
        .from("classes")
        .select("id, grade, class_number")
        .eq("school_id", profile.schoolId);

      const classIds = (classes || []).map((c: any) => c.id);

      // Aggregated server-side (get_school_grade_averages) instead of pulling
      // raw graded submissions client-side with a row limit - a school with
      // more than a few hundred graded submissions would otherwise have this
      // KPI silently computed from an arbitrary truncated slice.
      const { data: gradeAveragesData } = classIds.length > 0
        ? await supabase.rpc("get_school_grade_averages", { p_school_id: profile.schoolId })
        : { data: [] };

      const gradeOrder = ["ז'", "ח'", "ט'", "י'", "י\"א", "י\"ב"];
      const avgs: GradeAvg[] = (gradeAveragesData || []).map((row: any) => ({
        grade: row.grade,
        avg: row.avg_grade,
        classCount: (classes || []).filter((c: any) => c.grade === row.grade).length,
      }));
      avgs.sort((a, b) => gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade));

      const overallAvg = avgs.length > 0 ? Math.round(avgs.reduce((s, g) => s + g.avg, 0) / avgs.length) : null;

      // Fetch attendance for today (school's own students only)
      const today = new Date().toISOString().split("T")[0];
      const { data: schoolStudents } = classIds.length > 0
        ? await supabase.from("profiles").select("id").in("class_id", classIds)
        : { data: [] };
      const studentIds = (schoolStudents || []).map((s: any) => s.id);

      const { data: attendanceData } = studentIds.length > 0
        ? await supabase.from("attendance")
          .select("status, student_id")
          .in("student_id", studentIds)
          .gte("noted_at", today)
        : { data: [] };

      const uniqueStudents = new Map<string, string>();
      (attendanceData || []).forEach((a: any) => {
        // If they have any "absent", consider them absent (worst case), otherwise present/late is present.
        const existing = uniqueStudents.get(a.student_id);
        if (existing !== "absent") {
          uniqueStudents.set(a.student_id, a.status);
        }
      });

      let presentCount = 0;
      let absentCount = 0;
      uniqueStudents.forEach(status => {
        if (status === "present" || status === "late") presentCount++;
        if (status === "absent") absentCount++;
      });

      setStats({
        totalStudents: studRes.count || 0,
        totalTeachers: teacherCount,
        totalClasses: classRes.count || 0,
        avgGrade: overallAvg,
        presentToday: presentCount,
        absentToday: absentCount,
        pendingApprovals: approvalRes.count || 0,
      });
      setGradeAvgs(avgs);

      // 3. Compliance check — late materials & late grades.
      // assignments.teacher_id has no actual FK constraint to profiles (verified:
      // no such constraint exists in any migration), so the previous
      // `profiles!assignments_teacher_id_fkey(...)` embed 400'd on every load -
      // uncaught, which aborted this whole load() before it ever reached
      // setLoading(false), leaving the entire page stuck spinning. Resolving
      // names via a separate lookup instead. Also scoping the late-grades query
      // to this school's own classes - it previously queried ALL "submitted"
      // rows system-wide with no class/school filter at all.
      const violations: ComplianceItem[] = [];
      let assigns2: { id: string; title: string; teacher_id: string; due_date: string | null; created_at: string }[] | null = null;
      if (classIds.length > 0) {
        const { data } = await supabase
          .from("assignments")
          .select("id, title, teacher_id, due_date, created_at")
          .in("class_id", classIds)
          .eq("published", true)
          .limit(100);
        assigns2 = data;

        const { data: pendingSubs } = await supabase
          .from("submissions")
          .select("submitted_at, assignment_id, assignments!inner(title, teacher_id, class_id)")
          .in("assignments.class_id", classIds)
          .in("status", ["submitted"])
          .not("submitted_at", "is", null)
          .limit(100);

        const complianceTeacherIds = Array.from(new Set([
          ...(assigns2 || []).map((a: any) => a.teacher_id),
          ...(pendingSubs || []).map((s: any) => s.assignments?.teacher_id).filter(Boolean),
        ]));
        const { data: complianceProfiles } = complianceTeacherIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", complianceTeacherIds)
          : { data: [] };
        const complianceNameById = new Map((complianceProfiles || []).map((p: any) => [p.id, p.full_name]));

        for (const a of (assigns2 || [])) {
          if (a.due_date && a.created_at) {
            const daysNotice = Math.floor(
              (new Date(a.due_date).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysNotice < 7 && daysNotice >= 0) {
              violations.push({
                teacherId: a.teacher_id,
                teacherName: complianceNameById.get(a.teacher_id) || "מורה לא ידוע",
                violation: "חומר מבחן מאוחר",
                type: "late_material",
                detail: `"${a.title}" הועלה ${daysNotice} ימים לפני המועד`,
              });
            }
          }
        }

        for (const s of (pendingSubs || [])) {
          if (s.submitted_at) {
            const days = Math.floor((Date.now() - new Date(s.submitted_at).getTime()) / (1000 * 60 * 60 * 24));
            if (days > 14) {
              const teacherId = (s.assignments as any)?.teacher_id || "";
              violations.push({
                teacherId,
                teacherName: complianceNameById.get(teacherId) || "מורה לא ידוע",
                violation: "ציון מאוחר",
                type: "late_grade",
                detail: `"${(s.assignments as any)?.title}" — לא הוחזר ציון כבר ${days} ימים`,
              });
            }
          }
        }
      }

      // Deduplicate — max 1 per teacher per type
      const seen = new Set<string>();
      const unique = violations.filter(v => {
        const key = `${v.teacherId}-${v.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setCompliance(unique.slice(0, 8));

      // 4. Teacher Wellness — load count proxy, plus real assignment load & grading delay.
      // teacher_classes.user_id references auth.users, not public.profiles, so it has
      // no FK PostgREST can embed profiles(full_name) through (this always 400'd -
      // the panel was silently empty on every load). Scope to this school's own
      // classes and resolve names with a separate query instead.
      const { data: tcLinks } = classIds.length > 0
        ? await supabase.from("teacher_classes").select("user_id, class_id").in("class_id", classIds).limit(200)
        : { data: [] };

      if (tcLinks) {
        const teacherIds = Array.from(new Set(tcLinks.map((tc: any) => tc.user_id)));
        const { data: teacherProfiles } = teacherIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
          : { data: [] };
        const nameById = new Map((teacherProfiles || []).map((p: any) => [p.id, p.full_name]));

        const countByTeacher = new Map<string, { name: string; count: number }>();
        tcLinks.forEach((tc: any) => {
          const entry = countByTeacher.get(tc.user_id) || { name: nameById.get(tc.user_id) || "", count: 0 };
          entry.count++;
          countByTeacher.set(tc.user_id, entry);
        });

        const assignmentCountByTeacher = new Map<string, number>();
        (assigns2 || []).forEach((a: any) => {
          assignmentCountByTeacher.set(a.teacher_id, (assignmentCountByTeacher.get(a.teacher_id) || 0) + 1);
        });

        const delaysByTeacher = new Map<string, number[]>();
        if (classIds.length > 0) {
          const { data: gradedSubs } = await supabase
            .from("submissions")
            .select("submitted_at, graded_at, assignments!inner(teacher_id, class_id)")
            .in("assignments.class_id", classIds)
            .eq("status", "graded")
            .not("submitted_at", "is", null)
            .not("graded_at", "is", null)
            .limit(200);

          (gradedSubs || []).forEach((s: any) => {
            const teacherId = s.assignments?.teacher_id;
            if (!teacherId) return;
            const days = (new Date(s.graded_at).getTime() - new Date(s.submitted_at).getTime()) / (1000 * 60 * 60 * 24);
            const list = delaysByTeacher.get(teacherId) || [];
            list.push(days);
            delaysByTeacher.set(teacherId, list);
          });
        }

        const loads: TeacherLoad[] = [];
        countByTeacher.forEach(({ name, count }, id) => {
          const assignmentCount = assignmentCountByTeacher.get(id) || 0;
          const delays = delaysByTeacher.get(id) || [];
          const avgGradeDelay = delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
          const risk: TeacherLoad["burnoutRisk"] =
            count >= 8 || avgGradeDelay > 10 ? "high" : count >= 5 || avgGradeDelay > 5 ? "medium" : "low";
          loads.push({ id, name, classCount: count, assignmentCount, avgGradeDelay, burnoutRisk: risk });
        });
        setTeacherLoads(loads.sort((a, b) => b.classCount - a.classCount).slice(0, 6));
      }

      setLoading(false);
    };
    load();
  }, [profile.schoolId]);

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      const { error } = await (supabase as any).from("system_announcements").insert({
        school_id: profile.schoolId,
        title: broadcastSeverity === "emergency" ? "🚨 הודעת חירום" : "הודעת הנהלה",
        content: broadcastMsg,
        severity: broadcastSeverity,
        created_by: profile.id,
      });
      if (error) throw error;
      toast({ title: "ההודעה שוגרה לכלל הקהילה! 📢" });
      setBroadcastDialog(false);
      setBroadcastMsg("");
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBroadcasting(false);
    }
  };

  const submitInquiry = async () => {
    if (!inquirySubject.trim() || !inquiryContent.trim() || !profile.schoolId) return;
    setSavingInquiry(true);
    try {
      const { data, error } = await supabase.from("supervisor_inquiries").insert({
        school_id: profile.schoolId,
        subject: inquirySubject.trim(),
        content: inquiryContent.trim(),
        priority: inquiryPriority,
        created_by: profile.id,
      }).select("id, subject, content, priority, status, response, created_at").single();
      if (error) throw error;
      setInquiries(prev => [{
        id: data.id, subject: data.subject, content: data.content,
        priority: data.priority as "normal" | "high", status: data.status as SupervisorInquiry["status"],
        response: data.response, createdAt: data.created_at,
      }, ...prev]);
      setInquiryDialog(false);
      setInquirySubject("");
      setInquiryContent("");
      setInquiryPriority("normal");
      toast({ title: "הפנייה נרשמה בתיבה" });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSavingInquiry(false);
    }
  };

  const submitResponse = async (id: string) => {
    if (!responseText.trim()) return;
    setSavingResponse(true);
    try {
      const { error } = await supabase.from("supervisor_inquiries").update({
        status: "answered",
        response: responseText.trim(),
        responded_by: profile.id,
        responded_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: "answered", response: responseText.trim() } : i));
      setRespondingId(null);
      setResponseText("");
      toast({ title: "התשובה נשלחה ותועדה" });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSavingResponse(false);
    }
  };

  const closeInquiry = async (id: string) => {
    const { error } = await supabase.from("supervisor_inquiries").update({ status: "closed" }).eq("id", id);
    if (!error) setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: "closed" } : i));
  };

  const printReport = () => {
    const prevTitle = document.title;
    document.title = `דוח_מנהלת_${profile.schoolName || ""}_${new Date().toISOString().split("T")[0]}`;
    window.print();
    window.setTimeout(() => { document.title = prevTitle; }, 1000);
  };

  const bottlenecks = useMemo<Bottleneck[]>(() => {
    if (!stats) return [];
    const items: Bottleneck[] = [];

    const highBurnout = teacherLoads.filter(t => t.burnoutRisk === "high");
    if (highBurnout.length > 0) {
      items.push({
        id: "teacher-load",
        title: "עומס יתר על מורים",
        description: `${highBurnout.length} מורים בסיכון שחיקה גבוה: ${highBurnout.map(t => t.name).filter(Boolean).join(", ")}`,
        severity: "high",
      });
    }

    const lateGradeCount = compliance.filter(c => c.type === "late_grade").length;
    if (lateGradeCount >= 2) {
      items.push({
        id: "grading-delay",
        title: "צוואר בקבוק בהחזרת ציונים",
        description: `${lateGradeCount} מטלות ממתינות לציון מעבר לזמן הסביר`,
        severity: lateGradeCount >= 5 ? "high" : "medium",
      });
    }

    const weakGrades = gradeAvgs.filter(g => g.avg < 65);
    if (weakGrades.length > 0) {
      items.push({
        id: "weak-grades",
        title: "פערי הישגים לפי שכבה",
        description: `שכבות עם ממוצע מתחת ל-65: ${weakGrades.map(g => `${g.grade} (${g.avg})`).join(", ")}`,
        severity: weakGrades.some(g => g.avg < 55) ? "high" : "medium",
      });
    }

    if (stats.pendingApprovals >= 5) {
      items.push({
        id: "approvals-backlog",
        title: "צוואר בקבוק באישורים",
        description: `${stats.pendingApprovals} בקשות אישור ממתינות לטיפול הנהלה`,
        severity: stats.pendingApprovals >= 10 ? "high" : "medium",
      });
    }

    const totalToday = (stats.presentToday || 0) + (stats.absentToday || 0);
    if (totalToday > 0 && (stats.absentToday || 0) / totalToday > 0.15) {
      items.push({
        id: "attendance",
        title: "שיעור היעדרויות חריג",
        description: `${Math.round(((stats.absentToday || 0) / totalToday) * 100)}% מהתלמידים נעדרים היום`,
        severity: "medium",
      });
    }

    const stalePending = inquiries.filter(i => i.status === "pending" &&
      (Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24) > 5);
    if (stalePending.length > 0) {
      items.push({
        id: "supervisor-inbox",
        title: "פניות מפקחת ללא מענה",
        description: `${stalePending.length} פניות ממתינות למענה מעל 5 ימים`,
        severity: "high",
      });
    }

    const order = { high: 0, medium: 1, low: 2 } as const;
    return items.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [stats, teacherLoads, compliance, gradeAvgs, inquiries]);

  const trendPrediction = useMemo(() => {
    if (yearlyTrend.length < 2) return null;
    const n = yearlyTrend.length;
    const xs = yearlyTrend.map((_, i) => i);
    const ys = yearlyTrend.map(t => t.avg);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;
    const predicted = Math.round(Math.max(0, Math.min(100, intercept + slope * n)));
    return { predicted, nextYear: yearlyTrend[n - 1].year + 1, direction: slope > 0.5 ? "up" : slope < -0.5 ? "down" : "flat" };
  }, [yearlyTrend]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const gradeColor = (g: number) =>
    g >= 85 ? "#22c55e" : g >= 70 ? "hsl(var(--primary))" : g >= 55 ? "#eab308" : "hsl(var(--destructive))";

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
    <div className="print:hidden space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Crown className="h-7 w-7 text-yellow-500" />דאשבורד מנהלת
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">מבט-על על כלל בית הספר</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 font-heading text-xs" onClick={printReport}>
            <Printer className="h-3.5 w-3.5" />ייצוא דוח PDF למשה"ח
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 font-heading text-xs"
            onClick={() => { setBroadcastSeverity("emergency"); setBroadcastDialog(true); }}>
            <Radio className="h-3.5 w-3.5 text-red-500" />שידור חירום
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 font-heading text-xs"
            onClick={() => navigate("/dashboard/approvals")}>
            <UserCheck className="h-3.5 w-3.5" />
            אישורים
            {stats?.pendingApprovals ? (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">{stats.pendingApprovals}</Badge>
            ) : null}
          </Button>
        </div>
      </motion.div>

      {/* KPI Row */}
      {stats && (
        <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "תלמידים", val: stats.totalStudents, icon: Users, color: "text-primary" },
            { label: "מורים", val: stats.totalTeachers, icon: BookOpen, color: "text-green-600" },
            { label: "נוכחים היום", val: stats.presentToday || 0, icon: UserCheck, color: "text-blue-600" },
            { label: "חיסורים היום", val: stats.absentToday || 0, icon: AlertTriangle, color: (stats.absentToday || 0) > 0 ? "text-destructive" : "text-muted-foreground" },
            { label: "ממוצע בי\"ס", val: stats.avgGrade ?? "—", icon: BarChart3, color: stats.avgGrade ? (stats.avgGrade >= 75 ? "text-green-600" : "text-yellow-600") : "text-muted-foreground" },
            { label: "ממתינים", val: stats.pendingApprovals, icon: UserCheck, color: stats.pendingApprovals > 0 ? "text-destructive" : "text-muted-foreground" },
          ].map((s, i) => (
            <Card key={i} className={s.label === "ממתינים לאישור" && stats.pendingApprovals > 0 ? "border-destructive/30" : ""}>
              <CardContent className="py-4 text-center">
                <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                <p className={`text-2xl font-heading font-bold ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Grade averages chart */}
      {gradeAvgs.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />ממוצעים לפי שכבה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeAvgs}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [`${v}`, "ממוצע"]}
                    />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                      {gradeAvgs.map((g, i) => (
                        <Cell key={i} fill={gradeColor(g.avg)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 justify-center mt-2 text-[10px] text-muted-foreground flex-wrap">
                {gradeAvgs.map(g => (
                  <span key={g.grade}>{g.grade}: ממוצע {g.avg} ({g.classCount} כיתות)</span>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Multi-year trend prediction */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />חיזוי מגמות רב-שנתי
            </CardTitle>
          </CardHeader>
          <CardContent>
            {yearlyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-4">
                אין עדיין נתוני ציונים היסטוריים לחישוב מגמה
              </p>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={yearlyTrend.map(t => ({ ...t, label: `${t.year}/${String(t.year + 1).slice(2)}` }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any, n: any, p: any) => [`${v} (${p.payload.count} ציונים)`, "ממוצע"]}
                      />
                      <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {trendPrediction ? (
                  <div className="flex items-center gap-2 mt-2 justify-center text-xs font-body">
                    {trendPrediction.direction === "up" && <TrendingUp className="h-4 w-4 text-green-600" />}
                    {trendPrediction.direction === "down" && <TrendingDown className="h-4 w-4 text-destructive" />}
                    <span className="text-muted-foreground">
                      תחזית לשנה"ל {trendPrediction.nextYear}/{String(trendPrediction.nextYear + 1).slice(2)}: ממוצע משוער <b className="text-foreground">{trendPrediction.predicted}</b>
                      {" "}(מבוסס על {yearlyTrend.length} שנות נתונים — אינדיקציה ראשונית בלבד)
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-body text-center mt-2">
                    נדרש ותק של שנתיים לפחות כדי לחשב תחזית מגמה
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Bottleneck detection */}
      {bottlenecks.length > 0 && (
        <motion.div variants={item}>
          <Card className="border-orange-400/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-orange-500" />זיהוי צווארי בקבוק
                <Badge variant="destructive" className="text-[10px]">{bottlenecks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bottlenecks.map(b => (
                <div key={b.id} className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                  b.severity === "high" ? "bg-destructive/5 border-destructive/30" : "bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800"
                }`}>
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${b.severity === "high" ? "text-destructive" : "text-orange-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-heading font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground font-body">{b.description}</p>
                  </div>
                  <Badge variant={b.severity === "high" ? "destructive" : "outline"} className="text-[9px] shrink-0">
                    {b.severity === "high" ? "דחוף" : "לעקוב"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Compliance Guard */}
      <motion.div variants={item}>
        <Card className={compliance.length > 0 ? "border-orange-400/40" : "border-green-500/30"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Shield className={`h-5 w-5 ${compliance.length > 0 ? "text-orange-500" : "text-green-500"}`} />
              Compliance Guard — מגן זכויות כלל-בית-ספרי
              {compliance.length === 0 && <Badge className="text-[10px] bg-green-500">הכל תקין ✓</Badge>}
              {compliance.length > 0 && <Badge variant="destructive" className="text-[10px]">{compliance.length} חריגות</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {compliance.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-4">
                כל המורים עומדים בנהלים — אין חריגות כרגע 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {compliance.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
                    <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-heading font-medium">{c.teacherName}</p>
                      <p className="text-xs text-muted-foreground font-body">{c.detail}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0 border-orange-300 text-orange-600">{c.violation}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Teacher Wellness */}
      {teacherLoads.length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />Teacher Wellness AI — זיהוי שחיקת מורים
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {teacherLoads.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.burnoutRisk === "high" ? "bg-destructive" : t.burnoutRisk === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                    <div>
                      <p className="font-heading text-sm font-medium">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.classCount} כיתות • {t.assignmentCount} מטלות
                        {t.avgGradeDelay > 0 && ` • עיכוב ציונים ממוצע: ${t.avgGradeDelay} ימים`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 hidden sm:block">
                      <Progress value={Math.min((t.classCount / 10) * 100, 100)} className={`h-1.5 ${t.burnoutRisk === "high" ? "[&>div]:bg-destructive" : t.burnoutRisk === "medium" ? "[&>div]:bg-yellow-500" : ""}`} />
                    </div>
                    <Badge variant={t.burnoutRisk === "high" ? "destructive" : "outline"} className="text-[10px]">
                      {t.burnoutRisk === "high" ? "סיכון גבוה" : t.burnoutRisk === "medium" ? "לעקוב" : "תקין"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Supervisor inbox */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Inbox className="h-5 w-5 text-blue-600" />תיבת פניות מפקחת
                {inquiries.filter(i => i.status === "pending").length > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {inquiries.filter(i => i.status === "pending").length} ממתינות
                  </Badge>
                )}
              </CardTitle>
              <Button size="sm" variant="outline" className="gap-1.5 font-heading text-xs" onClick={() => setInquiryDialog(true)}>
                <Plus className="h-3.5 w-3.5" />פנייה חדשה
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {inquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-4">
                אין פניות רשומות מהמפקחת
              </p>
            ) : (
              <div className="space-y-2">
                {inquiries.map(inq => (
                  <div key={inq.id} className="p-2.5 rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-heading font-medium">{inq.subject}</p>
                          {inq.priority === "high" && <Badge variant="destructive" className="text-[9px]">דחוף</Badge>}
                          <Badge variant={inq.status === "pending" ? "outline" : inq.status === "answered" ? "default" : "secondary"} className="text-[9px]">
                            {inq.status === "pending" ? "ממתינה למענה" : inq.status === "answered" ? "נענתה" : "סגורה"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-body mt-1">{inq.content}</p>
                        {inq.response && (
                          <div className="mt-2 p-2 rounded-md bg-muted/50 text-xs font-body">
                            <span className="font-heading text-[10px] text-muted-foreground">תשובת ההנהלה:</span> {inq.response}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(inq.createdAt).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                    {inq.status === "pending" && (
                      respondingId === inq.id ? (
                        <div className="mt-2 space-y-2">
                          <Textarea value={responseText} onChange={e => setResponseText(e.target.value)}
                            placeholder="נסחו תשובה למפקחת..." className="text-sm font-body resize-none" rows={2} />
                          <div className="flex gap-2">
                            <Button size="sm" className="gap-1.5 font-heading text-xs" disabled={savingResponse || !responseText.trim()}
                              onClick={() => submitResponse(inq.id)}>
                              {savingResponse ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareReply className="h-3.5 w-3.5" />}
                              שלח תשובה
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1.5 font-heading text-xs"
                              onClick={() => { setRespondingId(null); setResponseText(""); }}>
                              <X className="h-3.5 w-3.5" />ביטול
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" className="gap-1.5 font-heading text-xs"
                            onClick={() => { setRespondingId(inq.id); setResponseText(""); }}>
                            <MessageSquareReply className="h-3.5 w-3.5" />השב
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1.5 font-heading text-xs text-muted-foreground"
                            onClick={() => closeInquiry(inq.id)}>
                            סגור ללא מענה
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick actions */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">פעולות מהירות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "אישורים ממתינים", icon: UserCheck, route: "/dashboard/approvals", color: "text-primary" },
                { label: "עץ ארגוני", icon: Building2, route: profile.schoolId ? "/dashboard/org-tree" : "/dashboard/system-org-tree", color: "text-purple-600" },
                { label: "לוח שנה", icon: BarChart3, route: "/dashboard/schedule", color: "text-green-600" },
                { label: "שיחות", icon: FileText, route: "/dashboard/chat", color: "text-blue-600" },
                { label: "דוחות AI", icon: Brain, route: "/dashboard/grade-progress", color: "text-orange-600" },
                { label: "שידור לכולם", icon: Radio, onClick: () => { setBroadcastSeverity("info"); setBroadcastDialog(true); }, color: "text-red-500" },
              ].map((a, i) => (
                <button key={i}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all"
                  onClick={() => a.onClick ? a.onClick() : navigate(a.route!)}>
                  <a.icon className={`h-6 w-6 ${a.color}`} />
                  <span className="text-xs font-heading text-center leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastDialog} onOpenChange={o => { if (!o) setBroadcastDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Radio className="h-5 w-5 text-red-500 animate-pulse" />
              שידור לכלל הקהילה
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <p className="text-xs text-destructive font-body">
                ⚠️ ההודעה תוצג לכל התלמידים, המורים וההורים. השתמש בכלי זה רק לאירועים חשובים.
              </p>
            </div>
            <Textarea
              placeholder="לדוגמה: בשל מצב חירום בית הספר יסגר היום בשעה 12:00. אנא תאמו איסוף של ילדיכם."
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              className="font-body text-sm resize-none" rows={4}
            />
            <Button className="w-full gap-2 font-heading bg-destructive hover:bg-destructive/90"
              onClick={sendBroadcast} disabled={broadcasting || !broadcastMsg.trim()}>
              {broadcasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {broadcasting ? "שולח..." : "שגר הודעה לכולם"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Supervisor Inquiry Dialog */}
      <Dialog open={inquiryDialog} onOpenChange={o => { if (!o) setInquiryDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Inbox className="h-5 w-5 text-blue-600" />
              רישום פנייה מהמפקחת
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="נושא הפנייה"
              value={inquirySubject}
              onChange={e => setInquirySubject(e.target.value)}
              className="font-body text-sm"
            />
            <Textarea
              placeholder="תוכן הפנייה כפי שהתקבלה מהמפקחת..."
              value={inquiryContent}
              onChange={e => setInquiryContent(e.target.value)}
              className="font-body text-sm resize-none" rows={4}
            />
            <div className="flex gap-2">
              <Button size="sm" variant={inquiryPriority === "normal" ? "default" : "outline"} className="font-heading text-xs flex-1"
                onClick={() => setInquiryPriority("normal")}>רגילה</Button>
              <Button size="sm" variant={inquiryPriority === "high" ? "destructive" : "outline"} className="font-heading text-xs flex-1"
                onClick={() => setInquiryPriority("high")}>דחופה</Button>
            </div>
            <Button className="w-full gap-2 font-heading" onClick={submitInquiry} disabled={savingInquiry || !inquirySubject.trim() || !inquiryContent.trim()}>
              {savingInquiry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {savingInquiry ? "רושם..." : "רשום פנייה בתיבה"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

    {/* Printable report — Ministry of Education export (screen-hidden, print-only) */}
    <div className="hidden print:block text-black" dir="rtl">
      <h1 className="text-xl font-bold mb-1">דוח מנהלת — {profile.schoolName || "בית ספר"}</h1>
      <p className="text-xs text-gray-600 mb-4">הופק בתאריך {new Date().toLocaleDateString("he-IL")}</p>

      {stats && (
        <table className="w-full text-sm border-collapse mb-4">
          <tbody>
            <tr><td className="border px-2 py-1 font-bold">תלמידים</td><td className="border px-2 py-1">{stats.totalStudents}</td>
              <td className="border px-2 py-1 font-bold">מורים</td><td className="border px-2 py-1">{stats.totalTeachers}</td></tr>
            <tr><td className="border px-2 py-1 font-bold">כיתות</td><td className="border px-2 py-1">{stats.totalClasses}</td>
              <td className="border px-2 py-1 font-bold">ממוצע בי"ס</td><td className="border px-2 py-1">{stats.avgGrade ?? "—"}</td></tr>
            <tr><td className="border px-2 py-1 font-bold">נוכחים היום</td><td className="border px-2 py-1">{stats.presentToday ?? "—"}</td>
              <td className="border px-2 py-1 font-bold">חיסורים היום</td><td className="border px-2 py-1">{stats.absentToday ?? "—"}</td></tr>
          </tbody>
        </table>
      )}

      {gradeAvgs.length > 0 && (
        <>
          <h2 className="text-base font-bold mb-1">ממוצעים לפי שכבה</h2>
          <table className="w-full text-sm border-collapse mb-4">
            <thead><tr><th className="border px-2 py-1">שכבה</th><th className="border px-2 py-1">ממוצע</th><th className="border px-2 py-1">כיתות</th></tr></thead>
            <tbody>
              {gradeAvgs.map(g => (
                <tr key={g.grade}><td className="border px-2 py-1">{g.grade}</td><td className="border px-2 py-1">{g.avg}</td><td className="border px-2 py-1">{g.classCount}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {yearlyTrend.length > 0 && (
        <>
          <h2 className="text-base font-bold mb-1">מגמה רב-שנתית</h2>
          <table className="w-full text-sm border-collapse mb-4">
            <thead><tr><th className="border px-2 py-1">שנת לימודים</th><th className="border px-2 py-1">ממוצע</th><th className="border px-2 py-1">מספר ציונים</th></tr></thead>
            <tbody>
              {yearlyTrend.map(t => (
                <tr key={t.year}><td className="border px-2 py-1">{t.year}/{String(t.year + 1).slice(2)}</td><td className="border px-2 py-1">{t.avg}</td><td className="border px-2 py-1">{t.count}</td></tr>
              ))}
            </tbody>
          </table>
          {trendPrediction && (
            <p className="text-xs mb-4">תחזית לשנה"ל {trendPrediction.nextYear}/{String(trendPrediction.nextYear + 1).slice(2)}: ממוצע משוער {trendPrediction.predicted}</p>
          )}
        </>
      )}

      {bottlenecks.length > 0 && (
        <>
          <h2 className="text-base font-bold mb-1">צווארי בקבוק שזוהו</h2>
          <table className="w-full text-sm border-collapse mb-4">
            <thead><tr><th className="border px-2 py-1">חומרה</th><th className="border px-2 py-1">תחום</th><th className="border px-2 py-1">פירוט</th></tr></thead>
            <tbody>
              {bottlenecks.map(b => (
                <tr key={b.id}><td className="border px-2 py-1">{b.severity === "high" ? "דחוף" : "לעקוב"}</td><td className="border px-2 py-1">{b.title}</td><td className="border px-2 py-1">{b.description}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {compliance.length > 0 && (
        <>
          <h2 className="text-base font-bold mb-1">חריגות ציות</h2>
          <table className="w-full text-sm border-collapse mb-4">
            <thead><tr><th className="border px-2 py-1">מורה</th><th className="border px-2 py-1">סוג</th><th className="border px-2 py-1">פירוט</th></tr></thead>
            <tbody>
              {compliance.map((c, i) => (
                <tr key={i}><td className="border px-2 py-1">{c.teacherName}</td><td className="border px-2 py-1">{c.violation}</td><td className="border px-2 py-1">{c.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {inquiries.length > 0 && (
        <>
          <h2 className="text-base font-bold mb-1">פניות מפקחת</h2>
          <table className="w-full text-sm border-collapse">
            <thead><tr><th className="border px-2 py-1">תאריך</th><th className="border px-2 py-1">נושא</th><th className="border px-2 py-1">סטטוס</th><th className="border px-2 py-1">תשובה</th></tr></thead>
            <tbody>
              {inquiries.map(inq => (
                <tr key={inq.id}>
                  <td className="border px-2 py-1">{new Date(inq.createdAt).toLocaleDateString("he-IL")}</td>
                  <td className="border px-2 py-1">{inq.subject}</td>
                  <td className="border px-2 py-1">{inq.status === "pending" ? "ממתינה" : inq.status === "answered" ? "נענתה" : "סגורה"}</td>
                  <td className="border px-2 py-1">{inq.response || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
    </motion.div>
  );
};

export default PrincipalDashboardPage;
