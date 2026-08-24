import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeartPulse, AlertTriangle, ClipboardList, MessageCircle, Calendar, Send } from "lucide-react";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FlaggedStudent {
  id: string;
  full_name: string;
  signals: string[];
}

interface Stats {
  activeCases: number;
  riskFlagged: number;
  recommendationsThisMonth: number;
}

const CounselorDashboard = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ activeCases: 0, riskFlagged: 0, recommendationsThisMonth: 0 });
  const [flagged, setFlagged] = useState<FlaggedStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

  useEffect(() => {
    const load = async () => {
      if (!profile.schoolId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [casesRes, recsRes, studentsRes] = await Promise.all([
        (supabase as any).from("counselor_cases").select("id, status").eq("counselor_id", profile.id),
        (supabase as any)
          .from("counselor_recommendations")
          .select("id, created_at")
          .eq("counselor_id", profile.id)
          .gte("created_at", monthStart.toISOString()),
        supabase
          .from("profiles")
          .select("id, full_name, class_id")
          .eq("school_id", profile.schoolId)
          .not("class_id", "is", null),
      ]);

      const activeCases = (casesRes.data || []).filter((c: any) => c.status !== "closed").length;
      const students: { id: string; full_name: string; class_id: string | null }[] = studentsRes.data || [];
      const studentIds = students.map((s) => s.id);

      const riskMap = new Map<string, Set<string>>();

      if (studentIds.length > 0) {
        const now = Date.now();
        const since = (days: number) => new Date(now - days * 86400000).toISOString();

        const [attRes, focusRes, subRes] = await Promise.all([
          supabase
            .from("attendance")
            .select("student_id, status, noted_at")
            .eq("status", "absent")
            .gte("noted_at", since(30))
            .in("student_id", studentIds),
          supabase
            .from("focus_reports")
            .select("student_id, level, created_at")
            .gte("created_at", since(14))
            .in("student_id", studentIds),
          supabase
            .from("submissions")
            .select("student_id, grade, graded_at")
            .not("grade", "is", null)
            .gte("graded_at", since(60))
            .in("student_id", studentIds),
        ]);

        const absenceCounts = new Map<string, number>();
        (attRes.data || []).forEach((a: any) => {
          absenceCounts.set(a.student_id, (absenceCounts.get(a.student_id) || 0) + 1);
        });

        const focusSums = new Map<string, { sum: number; n: number }>();
        (focusRes.data || []).forEach((f: any) => {
          const cur = focusSums.get(f.student_id) || { sum: 0, n: 0 };
          cur.sum += f.level;
          cur.n += 1;
          focusSums.set(f.student_id, cur);
        });

        const cutoff30 = now - 30 * 86400000;
        const recentGrades = new Map<string, number[]>();
        const priorGrades = new Map<string, number[]>();
        (subRes.data || []).forEach((s: any) => {
          const t = new Date(s.graded_at).getTime();
          const bucket = t >= cutoff30 ? recentGrades : priorGrades;
          const arr = bucket.get(s.student_id) || [];
          arr.push(s.grade);
          bucket.set(s.student_id, arr);
        });
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

        // Multi-factor trigger: flag only when at least 2 independent signals line up
        // (mirrors the spec's "AI doesn't flag on a single low grade" rule).
        studentIds.forEach((sid) => {
          const signals = new Set<string>();
          if ((absenceCounts.get(sid) || 0) >= 5) signals.add("חיסורים גבוהים");

          const f = focusSums.get(sid);
          if (f && f.n >= 2 && f.sum / f.n < 2.5) signals.add("ריכוז נמוך");

          const rec = recentGrades.get(sid);
          const pri = priorGrades.get(sid);
          if (rec && rec.length >= 1 && pri && pri.length >= 1 && avg(pri) - avg(rec) >= 15) {
            signals.add("ירידה בציונים");
          }

          if (signals.size >= 2) riskMap.set(sid, signals);
        });
      }

      const flaggedList: FlaggedStudent[] = Array.from(riskMap.entries()).map(([sid, signals]) => {
        const s = students.find((st) => st.id === sid);
        return { id: sid, full_name: s?.full_name || "תלמיד/ה", signals: Array.from(signals) };
      });

      setStats({
        activeCases,
        riskFlagged: flaggedList.length,
        recommendationsThisMonth: (recsRes.data || []).length,
      });
      setFlagged(flaggedList);
      setLoading(false);
    };
    load();
  }, [profile.id, profile.schoolId]);

  const openCase = async (studentId: string) => {
    const { data: existingRows, error: lookupError } = await (supabase as any)
      .from("counselor_cases")
      .select("id")
      .eq("counselor_id", profile.id)
      .eq("student_id", studentId)
      .neq("status", "closed")
      .limit(1);

    if (lookupError) {
      toast({ title: "שגיאה בפתיחת התיק", description: lookupError.message, variant: "destructive" });
      return;
    }

    if (!existingRows || existingRows.length === 0) {
      const { error: insertError } = await (supabase as any).from("counselor_cases").insert({
        school_id: profile.schoolId,
        student_id: studentId,
        counselor_id: profile.id,
        status: "new",
        flagged_reason: "ai_risk_flag",
      });
      if (insertError) {
        toast({ title: "שגיאה בפתיחת התיק", description: insertError.message, variant: "destructive" });
        return;
      }
    }
    navigate("/dashboard/counselor-cases");
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center gap-4">
        {profile.avatar && <AvatarPreview config={profile.avatar} size={72} />}
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">שלום, {profile.fullName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="font-heading">יועץ/ת</Badge>
            {profile.schoolName && <span className="text-sm text-muted-foreground font-body">{profile.schoolName}</span>}
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <ClipboardList className="h-7 w-7 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-heading font-bold">{stats.activeCases}</p>
            <p className="text-xs text-muted-foreground font-body">תיקי מעקב פעילים</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <AlertTriangle className={`h-7 w-7 mx-auto mb-2 ${stats.riskFlagged > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <p className="text-2xl font-heading font-bold">{stats.riskFlagged}</p>
            <p className="text-xs text-muted-foreground font-body">תלמידים בסיכון (AI)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Send className="h-7 w-7 mx-auto mb-2 text-info" />
            <p className="text-2xl font-heading font-bold">{stats.recommendationsThisMonth}</p>
            <p className="text-xs text-muted-foreground font-body">המלצות שנשלחו החודש</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-destructive" /> זיהוי סיכון (AI)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground animate-pulse">מנתח נתוני נוכחות, ריכוז וציונים...</p>
            ) : flagged.length === 0 ? (
              <p className="text-sm text-muted-foreground">לא זוהו תלמידים עם צניחה רב-מערכתית כרגע</p>
            ) : (
              <div className="space-y-2">
                {flagged.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                  >
                    <div className="min-w-0">
                      <p className="font-heading font-medium text-sm">{f.full_name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.signals.map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => openCase(f.id)}
                      className="shrink-0 text-xs font-heading font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      פתח תיק מעקב
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <h2 className="font-heading font-bold text-lg mb-3">פעולות מהירות</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: ClipboardList, label: "ניהול תיקים", path: "/dashboard/counselor-cases", color: "text-primary", desc: "תיקי טיפול מאובטחים" },
            { icon: MessageCircle, label: "שיחות", path: "/dashboard/chat", color: "text-info", desc: "תקשורת מאובטחת" },
            { icon: Calendar, label: "לוח זמנים", path: "/dashboard/schedule", color: "text-accent", desc: "לוח שנה בית ספרי" },
          ].map((action, i) => (
            <Card key={i} className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5" onClick={() => navigate(action.path)}>
              <CardContent className="py-5 text-center">
                <action.icon className={`h-8 w-8 mx-auto mb-2 ${action.color}`} />
                <p className="text-sm font-heading font-bold">{action.label}</p>
                <p className="text-[10px] text-muted-foreground">{action.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CounselorDashboard;
