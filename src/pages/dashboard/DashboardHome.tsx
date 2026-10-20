import { useOutletContext, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Calendar, UserCheck, BarChart3, Building2, Newspaper } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  HomeHeader, HeroCard, HomeSection, HomeColumns, StatTiles, BarList, HomeRow, HomeEmpty, IconTile,
  greeting, longHebrewDate, firstName, type Tone,
} from "@/components/home/HomeKit";

const ROLE_LABELS: Record<string, string> = {
  student: "תלמיד/ה",
  parent: "הורה",
  educator: "מחנך/ת",
  professional_teacher: "מורה מקצועי/ת",
  subject_coordinator: "רכז/ת מקצוע",
  grade_coordinator: "רכז/ת שכבה",
  counselor: "יועץ/ת",
  management: "הנהלה",
  system_admin: "מנהל/ת מערכת",
};

interface Stats {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  totalClasses: number;
}

interface SchoolToday {
  students: number;
  present: number;
  absent: number;
  reported: number;
}

interface WeekItem {
  id: string;
  title: string;
  date: string;
  subject: string | null;
  kind: "exam" | "event" | "holiday";
}

const GRADE_ORDER = ["ז'", "ח'", "ט'", "י'", "י\"א", "י\"ב"];
const dayFmt = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "numeric" });
const KIND_TAG: Record<WeekItem["kind"], { label: string; tone: Tone }> = {
  exam: { label: "מבחן", tone: "alert" },
  event: { label: "אירוע", tone: "info" },
  holiday: { label: "חופשה", tone: "success" },
};

const DashboardHome = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, approvedUsers: 0, pendingUsers: 0, totalClasses: 0 });
  const [today, setToday] = useState<SchoolToday | null>(null);
  const [gradeAvgs, setGradeAvgs] = useState<{ label: string; value: number }[]>([]);
  const [week, setWeek] = useState<WeekItem[]>([]);

  const isStudent = profile.roles.includes("student");
  const isTeacher = profile.roles.includes("professional_teacher");
  const isEducator = profile.roles.includes("educator");
  const isGradeCoordinator = profile.roles.includes("grade_coordinator");
  const isSubjectCoordinator = profile.roles.includes("subject_coordinator");
  const isCounselor = profile.roles.includes("counselor");
  const isManagementOrAdmin = profile.roles.some((r) =>
    ["management", "system_admin"].includes(r)
  );
  const isStaff = profile.roles.some((r) =>
    ["educator", "professional_teacher", "subject_coordinator", "grade_coordinator", "counselor", "management", "system_admin"].includes(r)
  );

  const isSystemAdmin = profile.roles.includes("system_admin");

  useEffect(() => {
    if (!isStaff) return;
    const load = async () => {
      // System admins oversee every school, so their totals stay global.
      // Everyone else (e.g. "management") should only see their own school.
      const classesQuery = supabase.from("classes").select("id", { count: "exact", head: true });
      const scoped = !isSystemAdmin && !!profile.schoolId;

      // user_roles has no school_id column, so scoping it requires first
      // narrowing to this school's own profile ids.
      const rolesCountPromise = scoped
        ? supabase.from("profiles").select("id").eq("school_id", profile.schoolId).then(async ({ data }) => {
            const ids = (data || []).map((p: any) => p.id);
            if (ids.length === 0) return 0;
            const { data: roles } = await supabase.from("user_roles").select("user_id").in("user_id", ids);
            return new Set((roles || []).map((r: any) => r.user_id)).size;
          })
        : supabase.from("user_roles").select("id", { count: "exact", head: true }).then(({ count }) => count || 0);

      const [pendingRes, approvedRes, totalRoles, classesRes] = await Promise.all([
        supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "approved"),
        rolesCountPromise,
        scoped ? classesQuery.eq("school_id", profile.schoolId) : classesQuery,
      ]);
      setStats({
        totalUsers: totalRoles || (approvedRes.count || 0) + (pendingRes.count || 0),
        approvedUsers: approvedRes.count || 0,
        pendingUsers: pendingRes.count || 0,
        totalClasses: classesRes.count || 0,
      });
    };
    load();
  }, [isStaff, isSystemAdmin, profile.schoolId]);

  // School-wide picture for management: today's attendance, grade averages,
  // and this week's exams/events (same sources as the principal dashboard).
  useEffect(() => {
    if (!isManagementOrAdmin || !profile.schoolId) return;
    const schoolId = profile.schoolId;
    const load = async () => {
      const todayIso = new Date().toISOString().split("T")[0];
      const now = new Date();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const [{ data: classes }, { data: avgRows }, { data: gEvents }, { data: sEvents }] = await Promise.all([
        supabase.from("classes").select("id").eq("school_id", schoolId),
        supabase.rpc("get_school_grade_averages", { p_school_id: schoolId }),
        supabase.from("grade_events").select("id, title, subject, event_date, event_type, grade")
          .eq("school_id", schoolId).eq("status", "approved").gte("event_date", iso(weekStart)).lte("event_date", iso(weekEnd)),
        supabase.from("school_events").select("id, title, start_date, is_holiday")
          .eq("school_id", schoolId).gte("start_date", iso(weekStart)).lte("start_date", iso(weekEnd)),
      ]);

      setGradeAvgs(
        ((avgRows || []) as any[])
          .sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade))
          .map((r) => ({ label: r.grade, value: Math.round(r.avg_grade) }))
      );

      setWeek([
        ...((gEvents || []) as any[]).filter((e) => ["exam", "bagrut"].includes(e.event_type))
          .map((e) => ({ id: e.id, title: e.title, date: e.event_date, subject: e.subject, kind: "exam" as const })),
        ...((sEvents || []) as any[]).map((e) => ({ id: e.id, title: e.title, date: e.start_date, subject: null, kind: e.is_holiday ? "holiday" as const : "event" as const })),
      ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6));

      const classIds = (classes || []).map((c: any) => c.id);
      if (classIds.length === 0) return;
      const { data: students } = await supabase.from("profiles").select("id").in("class_id", classIds);
      const studentIds = (students || []).map((s: any) => s.id);
      if (studentIds.length === 0) { setToday({ students: 0, present: 0, absent: 0, reported: 0 }); return; }
      const { data: att } = await supabase.from("attendance").select("status, student_id").in("student_id", studentIds).gte("noted_at", todayIso);
      // A student absent from any lesson counts as absent today.
      const byStudent = new Map<string, string>();
      (att || []).forEach((a: any) => { if (byStudent.get(a.student_id) !== "absent") byStudent.set(a.student_id, a.status); });
      let present = 0, absent = 0;
      byStudent.forEach((s) => { if (s === "absent") absent++; else present++; });
      setToday({ students: studentIds.length, present, absent, reported: byStudent.size });
    };
    load();
  }, [isManagementOrAdmin, profile.schoolId]);

  // Redirect students to their dedicated dashboard
  if (isStudent) {
    return <Navigate to="/dashboard/student-home" replace />;
  }

  // Teachers and homeroom educators (non-management) share the teacher dashboard,
  // which also carries the homeroom view.
  if ((isTeacher || isEducator) && !isManagementOrAdmin && !isGradeCoordinator && !isCounselor) {
    return <Navigate to="/dashboard/teacher-home" replace />;
  }

  // Redirect grade coordinators to their dashboard
  if (isGradeCoordinator && !isManagementOrAdmin) {
    return <Navigate to="/dashboard/grade-coordinator-home" replace />;
  }

  // Redirect subject coordinators to their dashboard
  if (isSubjectCoordinator && !isManagementOrAdmin && !isGradeCoordinator) {
    return <Navigate to="/dashboard/subject-coordinator-home" replace />;
  }

  // Redirect counselors to their dedicated dashboard
  if (isCounselor && !isManagementOrAdmin) {
    return <Navigate to="/dashboard/counselor-home" replace />;
  }

  // Redirect parents to their dedicated 'WOW' dashboard
  if (profile.roles.includes("parent") && !isStaff) {
    return <Navigate to="/dashboard/my-child" replace />;
  }

  const presentPct = today && today.reported > 0 ? Math.round((today.present / today.reported) * 100) : null;
  const roleLabel = profile.roles.map((r) => ROLE_LABELS[r]).filter(Boolean)[0];

  const main = (
    <>
      <HeroCard
        color="#2B3350"
        subject="ניהול"
        tag={isManagementOrAdmin ? "בית הספר היום" : roleLabel || "App2Class"}
        title={presentPct !== null ? `${presentPct}% נוכחות` : profile.schoolName || "בית הספר"}
        meta={[
          today ? `${today.students.toLocaleString("he-IL")} תלמידים` : null,
          today && today.absent ? `${today.absent} חסרים` : null,
          today && today.reported < today.students ? `${today.reported.toLocaleString("he-IL")} דווחו עד עכשיו` : null,
          stats.totalClasses ? `${stats.totalClasses} כיתות` : null,
        ].filter(Boolean).join(" · ") || undefined}
        action={isManagementOrAdmin ? { label: "לדאשבורד המנהלת", onClick: () => navigate("/dashboard/principal") } : undefined}
      />

      <HomeSection title="דורש החלטה">
        {profile.pendingApprovalsCount > 0 ? (
          <HomeRow icon={<IconTile icon={UserCheck} color="#F2A007" />} title={`${profile.pendingApprovalsCount} בקשות ממתינות לאישור`}
            meta="הצטרפות, אירועים ובקשות צוות" action={{ label: "לאישורים", onClick: () => navigate("/dashboard/approvals") }} />
        ) : (
          <HomeEmpty>אין בקשות שמחכות להחלטה שלך</HomeEmpty>
        )}
      </HomeSection>

      {isManagementOrAdmin && (
        <HomeSection title="השבוע בבית הספר">
          {week.length === 0 ? (
            <HomeEmpty>אין מבחנים או אירועים מאושרים השבוע</HomeEmpty>
          ) : (
            week.map((w, i) => (
              <HomeRow key={w.id} index={i} subject={w.subject || undefined} icon={!w.subject ? <IconTile icon={Calendar} color="#3B7BF2" /> : undefined}
                title={w.title} meta={[w.subject, dayFmt.format(new Date(`${w.date}T12:00:00`))].filter(Boolean).join(" · ")} tag={KIND_TAG[w.kind]} />
            ))
          )}
        </HomeSection>
      )}
    </>
  );

  const side = (
    <>
      <HomeSection title="משתמשים">
        <StatTiles
          size="sm"
          items={[
            { value: stats.totalUsers.toLocaleString("he-IL"), label: "רשומים", tone: "ink" },
            { value: stats.pendingUsers, label: "ממתינים לאישור", tone: stats.pendingUsers ? "warning" : "success" },
            { value: stats.totalClasses, label: "כיתות", tone: "info" },
          ]}
        />
      </HomeSection>

      {gradeAvgs.length > 0 && (
        <HomeSection title="ממוצע ציונים לפי שכבה">
          <BarList items={gradeAvgs} threshold={75} unit="" />
        </HomeSection>
      )}

      {isManagementOrAdmin && (
        <HomeSection title="כלים">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: BarChart3, label: "דאשבורד מנהלת", path: "/dashboard/principal", color: "#2B3350" },
              { icon: Users, label: "תפקידי צוות", path: "/dashboard/team-roles", color: "#9257EC" },
              { icon: Building2, label: "מבנה בית הספר", path: "/dashboard/org-tree", color: "#1592B3" },
              { icon: Newspaper, label: "עיתון בית הספר", path: "/dashboard/newspaper", color: "#EE5A8F" },
              { icon: Calendar, label: "לוח זמנים", path: "/dashboard/schedule", color: "#3B7BF2" },
            ].map((a) => (
              <button key={a.path} type="button" onClick={() => navigate(a.path)}
                className="flex items-center gap-2.5 rounded-[16px] bg-card px-3 py-2.5 text-right shadow-[0_4px_12px_-9px_rgba(40,30,15,0.4)] transition-colors hover:bg-soft">
                <IconTile icon={a.icon} color={a.color} size={32} />
                <span className="font-body text-[13px] font-extrabold text-foreground">{a.label}</span>
              </button>
            ))}
          </div>
        </HomeSection>
      )}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <HomeHeader
        title={`${greeting()}, ${firstName(profile.fullName)}`}
        subtitle={[longHebrewDate(), roleLabel, profile.schoolName].filter(Boolean).join(" · ")}
      />
      <HomeColumns main={main} side={side} />
    </motion.div>
  );
};

export default DashboardHome;
