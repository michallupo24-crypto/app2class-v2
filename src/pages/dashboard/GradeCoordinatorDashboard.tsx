import { useOutletContext, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Users, BarChart3, Bell, Megaphone, Layers, Brain, ClipboardList, Loader2, UserPen } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatClassName, formatGrade } from "@/hooks/useStudentDay";
import {
  HomeHeader, HeroCard, HomeSection, HomeColumns, StatTiles, BarList, HomeRow, HomeEmpty, IconTile,
  greeting, longHebrewDate, firstName, type Tone,
} from "@/components/home/HomeKit";

interface GradeStats {
  totalClasses: number;
  totalStudents: number;
  pendingEvents: number;
  upcomingExams: number;
  activeTutoring: number;
  scheduledMeetings: number;
  announcements: number;
  avgAttendance: number | null;
  absentToday: number;
}

interface GradeEventRow {
  id: string;
  title: string;
  subject: string | null;
  event_date: string;
  event_type: string;
  status: string;
}

const EVENT_TAG: Record<string, { label: string; tone: Tone }> = {
  exam: { label: "מבחן", tone: "alert" },
  bagrut: { label: "בגרות", tone: "alert" },
  quiz: { label: "בוחן", tone: "alert" },
  deadline: { label: "הגשה", tone: "warning" },
  trip: { label: "טיול", tone: "info" },
};
const dayFmt = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "numeric" });

const GradeCoordinatorDashboard = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const [grade, setGrade] = useState<string | null>(null);
  const [stats, setStats] = useState<GradeStats>({
    totalClasses: 0, totalStudents: 0, pendingEvents: 0,
    upcomingExams: 0, activeTutoring: 0, scheduledMeetings: 0,
    announcements: 0, avgAttendance: null, absentToday: 0,
  });
  const [classAttendance, setClassAttendance] = useState<{ label: string; value: number }[]>([]);
  const [weekEvents, setWeekEvents] = useState<GradeEventRow[]>([]);
  const [pendingList, setPendingList] = useState<GradeEventRow[]>([]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Get coordinator's grade from user_roles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("grade")
        .eq("user_id", profile.id)
        .eq("role", "grade_coordinator")
        .maybeSingle();

      const grade = roleData?.grade;
      if (!grade || !profile.schoolId) return;
      setGrade(grade);

      const [classesRes, eventsRes, tutoringRes, meetingsRes, announcementsRes] = await Promise.all([
        supabase.from("classes").select("id, class_number").eq("school_id", profile.schoolId).eq("grade", grade).order("class_number"),
        supabase.from("grade_events").select("id, title, subject, event_date, event_type, status")
          .eq("school_id", profile.schoolId).eq("grade", grade),
        supabase.from("tutoring_sessions").select("id", { count: "exact", head: true })
          .eq("school_id", profile.schoolId).eq("grade", grade).eq("status", "planned"),
        supabase.from("staff_meetings").select("id", { count: "exact", head: true })
          .eq("school_id", profile.schoolId).eq("grade", grade).eq("status", "scheduled"),
        supabase.from("grade_announcements").select("id", { count: "exact", head: true })
          .eq("school_id", profile.schoolId).eq("grade", grade),
      ]);

      const classes = (classesRes.data || []) as { id: string; class_number: number }[];
      const classIds = classes.map((c) => c.id);
      let students: { id: string; class_id: string }[] = [];
      if (classIds.length > 0) {
        const { data: studentsData } = await supabase.from("profiles")
          .select("id, class_id")
          .in("class_id", classIds);
        students = (studentsData || []) as any;
      }
      const studentIds = students.map((s) => s.id);

      const events = (eventsRes.data || []) as GradeEventRow[];
      const pendingEvents = events.filter((e) => e.status === "proposed").length;
      const upcomingExams = events.filter((e) => e.event_type === "exam" && e.status === "approved").length;

      // This week's approved events, and what still waits for approval.
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const inWeek = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return d >= weekStart && d <= new Date(weekEnd.getTime() + 86400000); };
      setWeekEvents(events.filter((e) => e.status === "approved" && inWeek(e.event_date)).sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setPendingList(events.filter((e) => e.status === "proposed").sort((a, b) => a.event_date.localeCompare(b.event_date)).slice(0, 4));

      let absentCount = 0;
      let avgAttendance: number | null = null;
      if (studentIds.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { data: todayAtt } = await supabase.from("attendance")
          .select("student_id")
          .in("student_id", studentIds)
          .gte("noted_at", today)
          .eq("status", "absent");
        absentCount = new Set((todayAtt || []).map((a: any) => a.student_id)).size;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentAtt } = await supabase.from("attendance")
          .select("status, student_id")
          .in("student_id", studentIds)
          .gte("noted_at", thirtyDaysAgo);
        if (recentAtt && recentAtt.length > 0) {
          const attended = recentAtt.filter((a: any) => a.status !== "absent").length;
          avgAttendance = Math.round((attended / recentAtt.length) * 100);

          // Same 30-day rate, per class.
          const classOf = new Map(students.map((s) => [s.id, s.class_id]));
          const per = new Map<string, { total: number; attended: number }>();
          recentAtt.forEach((a: any) => {
            const cid = classOf.get(a.student_id);
            if (!cid) return;
            const e = per.get(cid) || { total: 0, attended: 0 };
            e.total++;
            if (a.status !== "absent") e.attended++;
            per.set(cid, e);
          });
          setClassAttendance(classes.filter((c) => per.get(c.id)?.total).map((c) => ({
            label: formatClassName(grade, c.class_number),
            value: Math.round((per.get(c.id)!.attended / per.get(c.id)!.total) * 100),
          })));
        }
      }

      setStats({
        totalClasses: classIds.length,
        totalStudents: studentIds.length,
        pendingEvents,
        upcomingExams,
        activeTutoring: tutoringRes.count || 0,
        scheduledMeetings: meetingsRes.count || 0,
        announcements: announcementsRes.count || 0,
        avgAttendance,
        absentToday: absentCount,
      });
    };
    load();
  }, [profile.id, profile.schoolId]);

  // AI Insight
  useEffect(() => {
    const fetchInsight = async () => {
      if (!profile.schoolId) return;
      setLoadingInsight(true);
      try {
        const { data } = await supabase.functions.invoke("grade-coordinator-ai", {
          body: {
            action: "daily_insight",
            schoolId: profile.schoolId,
            userId: profile.id,
          },
        });
        setAiInsight(data?.insight || null);
      } catch {
        setAiInsight(null);
      }
      setLoadingInsight(false);
    };
    fetchInsight();
  }, [profile.id, profile.schoolId]);

  const gradeName = grade ? `שכבת ${formatGrade(grade)}` : "השכבה";
  const presentToday = stats.totalStudents - stats.absentToday;
  const presentPct = stats.totalStudents ? Math.round((presentToday / stats.totalStudents) * 100) : null;

  // Two exams on one day for the grade is worth flagging.
  const examDays = new Map<string, GradeEventRow[]>();
  weekEvents.filter((e) => ["exam", "bagrut", "quiz"].includes(e.event_type)).forEach((e) => examDays.set(e.event_date, [...(examDays.get(e.event_date) || []), e]));
  const clashes = [...examDays.entries()].filter(([, list]) => list.length > 1);

  const main = (
    <>
      <HeroCard
        color="#C47A08"
        subject="סוציולוגיה"
        tag={`${gradeName} היום`}
        title={presentPct !== null ? `${presentPct}% נוכחות` : gradeName}
        meta={[`${stats.totalStudents} תלמידים`, `${stats.absentToday} חסרים`, stats.avgAttendance !== null ? `${stats.avgAttendance}% ב-30 יום` : null].filter(Boolean).join(" · ")}
        action={{ label: "לדופק השכבתי", onClick: () => navigate("/dashboard/grade-progress") }}
      />

      <HomeSection title="התראות">
        {clashes.length === 0 && profile.pendingApprovalsCount === 0 && !loadingInsight && !aiInsight ? (
          <HomeEmpty>אין התראות כרגע</HomeEmpty>
        ) : (
          <>
            {clashes.map(([date, list], i) => (
              <HomeRow key={date} index={i} subject={list[0].subject || undefined} title={`${list.length} מבחנים באותו יום`}
                meta={`${list.map((e) => e.subject || e.title).join(" ו")} · ${dayFmt.format(new Date(`${date}T12:00:00`))}`}
                tag={{ label: "לבדיקה", tone: "warning" }} onClick={() => navigate("/dashboard/master-scheduler")} />
            ))}
            {profile.pendingApprovalsCount > 0 && (
              <HomeRow icon={<IconTile icon={Bell} color="#F2A007" />} title={`${profile.pendingApprovalsCount} בקשות הצטרפות ממתינות`}
                meta="תלמידים והורים שמחכים לאישור" action={{ label: "לטיפול", onClick: () => navigate("/dashboard/approvals") }} />
            )}
            {(loadingInsight || aiInsight) && (
              <HomeRow icon={<IconTile icon={Brain} color="#9257EC" />} title="תובנה יומית על השכבה"
                meta={loadingInsight ? <Loader2 className="h-4 w-4 animate-spin" /> : aiInsight} />
            )}
          </>
        )}
      </HomeSection>

      <HomeSection
        title="לוח מבחנים השבוע"
        action={<button type="button" onClick={() => navigate("/dashboard/master-scheduler")} className="font-body text-[13px] font-extrabold text-link">ללוח המלא ←</button>}
      >
        {weekEvents.length === 0 ? (
          <HomeEmpty>אין מבחנים או אירועים מאושרים השבוע</HomeEmpty>
        ) : (
          weekEvents.map((e, i) => (
            <HomeRow key={e.id} index={i} subject={e.subject || undefined} icon={!e.subject ? <IconTile icon={Calendar} color="#3B7BF2" /> : undefined}
              title={e.title} meta={[e.subject, dayFmt.format(new Date(`${e.event_date}T12:00:00`))].filter(Boolean).join(" · ")}
              tag={EVENT_TAG[e.event_type]} />
          ))
        )}
      </HomeSection>
    </>
  );

  const side = (
    <>
      <HomeSection title="נוכחות לפי כיתה">
        {classAttendance.length === 0 ? <HomeEmpty>עדיין אין נתוני נוכחות מ-30 הימים האחרונים</HomeEmpty> : <BarList items={classAttendance} />}
      </HomeSection>

      <HomeSection title="אישורים ממתינים">
        {pendingList.length === 0 ? (
          <HomeEmpty>אין אירועים שמחכים לאישור</HomeEmpty>
        ) : (
          pendingList.map((e, i) => (
            <HomeRow key={e.id} index={i} subject={e.subject || undefined} icon={!e.subject ? <IconTile icon={Calendar} color="#3B7BF2" /> : undefined}
              title={e.title} meta={dayFmt.format(new Date(`${e.event_date}T12:00:00`))}
              action={{ label: "לאישור", onClick: () => navigate("/dashboard/master-scheduler") }} />
          ))
        )}
      </HomeSection>

      <HomeSection title="השכבה במספרים">
        <StatTiles
          size="sm"
          items={[
            { value: stats.activeTutoring, label: "תגבורים מתוכננים", tone: "info" },
            { value: stats.scheduledMeetings, label: "ישיבות צוות", tone: "neutral" },
            { value: stats.announcements, label: "הודעות שפורסמו", tone: "success" },
          ]}
        />
      </HomeSection>

      <HomeSection title="כלים">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { icon: BarChart3, label: "דופק שכבתי", path: "/dashboard/grade-progress", color: "#23B26D" },
            { icon: Users, label: "תגבורים", path: "/dashboard/tutoring", color: "#F2A007" },
            { icon: ClipboardList, label: "ישיבות צוות", path: "/dashboard/staff-meetings", color: "#9257EC" },
            { icon: Megaphone, label: "הודעות לשכבה", path: "/dashboard/grade-announcements", color: "#1592B3" },
            { icon: Layers, label: "אישורי הורים", path: "/dashboard/event-approvals", color: "#E5484D" },
            { icon: Calendar, label: "לוח מבחנים", path: "/dashboard/master-scheduler", color: "#3B7BF2" },
            { icon: UserPen, label: "שמות תצוגה", path: "/dashboard/display-names", color: "#C22E62" },
          ].map((a) => (
            <button key={a.path} type="button" onClick={() => navigate(a.path)}
              className="flex items-center gap-2.5 rounded-[16px] bg-card px-3 py-2.5 text-right shadow-[0_4px_12px_-9px_rgba(40,30,15,0.4)] transition-colors hover:bg-soft">
              <IconTile icon={a.icon} color={a.color} size={32} />
              <span className="font-body text-[13px] font-extrabold text-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </HomeSection>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <HomeHeader
        title={`${greeting()}, ${firstName(profile.fullName)}`}
        subtitle={[longHebrewDate(), `רכז/ת ${gradeName}`, stats.totalClasses ? `${stats.totalClasses} כיתות` : null].filter(Boolean).join(" · ")}
      />
      <HomeColumns main={main} side={side} />
    </motion.div>
  );
};

export default GradeCoordinatorDashboard;
