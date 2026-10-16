import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardList, MessageCircle, Calendar } from "lucide-react";
import { HomeHeader, HeroCard, HomeSection, HomeColumns, StatTiles, HomeRow, HomeEmpty, IconTile, greeting, longHebrewDate, firstName } from "@/components/home/HomeKit";
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

  const main = (
    <>
      <HeroCard
        color="#137A96"
        subject="פסיכולוגיה"
        tag={flagged.length > 0 ? "שווה לבדוק היום" : "תיקי מעקב"}
        title={loading ? "מנתח/ת נתונים..." : flagged.length > 0 ? `${flagged.length} תלמידים עם כמה סימנים יחד` : `${stats.activeCases} תיקים פתוחים`}
        meta={flagged.length > 0 ? "נוכחות, ריכוז וציונים שירדו יחד. הסימון אינו אבחנה" : "לא זוהו תלמידים עם ירידה בכמה תחומים יחד"}
        action={{ label: "לתיקי המעקב", onClick: () => navigate("/dashboard/counselor-cases") }}
      />

      <HomeSection title="שווה לבדוק">
        {loading ? (
          <HomeEmpty>בודק/ת נוכחות, ריכוז וציונים מהשבועות האחרונים...</HomeEmpty>
        ) : flagged.length === 0 ? (
          <HomeEmpty>אין כרגע תלמידים עם שני סימנים או יותר. זה מתעדכן כל יום</HomeEmpty>
        ) : (
          flagged.map((f, i) => (
            <HomeRow
              key={f.id}
              index={i}
              person={f.full_name}
              title={f.full_name}
              meta={f.signals.join(" · ")}
              action={{ label: "פתיחת תיק", onClick: () => openCase(f.id) }}
            />
          ))
        )}
      </HomeSection>
    </>
  );

  const side = (
    <>
      <HomeSection title="תיקי מעקב">
        <StatTiles
          size="sm"
          items={[
            { value: stats.activeCases, label: "פתוחים", tone: "info" },
            { value: stats.riskFlagged, label: "סומנו לבדיקה", tone: stats.riskFlagged ? "warning" : "success" },
            { value: stats.recommendationsThisMonth, label: "המלצות החודש", tone: "success" },
          ]}
        />
      </HomeSection>

      <HomeSection title="כלים">
        {[
          { icon: ClipboardList, label: "ניהול תיקים", meta: "תיקי טיפול מאובטחים", path: "/dashboard/counselor-cases", color: "#1592B3" },
          { icon: MessageCircle, label: "שיחות", meta: "עם תלמידים, הורים וצוות", path: "/dashboard/chat", color: "#4F70C9" },
          { icon: Calendar, label: "לוח זמנים", meta: "מערכת ולוח השנה", path: "/dashboard/schedule", color: "#9257EC" },
        ].map((a, i) => (
          <HomeRow key={a.path} index={i} icon={<IconTile icon={a.icon} color={a.color} />} title={a.label} meta={a.meta} onClick={() => navigate(a.path)} />
        ))}
      </HomeSection>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <HomeHeader title={`${greeting()}, ${firstName(profile.fullName)}`} subtitle={[longHebrewDate(), "יועץ/ת", profile.schoolName].filter(Boolean).join(" · ")} />
      <HomeColumns main={main} side={side} />
    </motion.div>
  );
};

export default CounselorDashboard;
