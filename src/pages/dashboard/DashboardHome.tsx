import { useOutletContext, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Users, CheckCircle2, Clock, GraduationCap, BookOpen, Shield } from "lucide-react";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const ROLE_COLORS: Record<string, string> = {
  student: "bg-student/10 text-student border-student/20",
  parent: "bg-parent/10 text-parent border-parent/20",
  educator: "bg-staff/10 text-staff border-staff/20",
  professional_teacher: "bg-primary/10 text-primary border-primary/20",
  subject_coordinator: "bg-accent/10 text-accent-foreground border-accent/20",
  grade_coordinator: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  counselor: "bg-info/10 text-info border-info/20",
  management: "bg-management/10 text-management border-management/20",
  system_admin: "bg-admin/10 text-admin border-admin/20",
};

interface Stats {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  totalClasses: number;
}

const DashboardHome = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, approvedUsers: 0, pendingUsers: 0, totalClasses: 0 });

  const isStudent = profile.roles.includes("student");
  const isTeacher = profile.roles.includes("professional_teacher");
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

  // Redirect students to their dedicated dashboard
  if (isStudent) {
    return <Navigate to="/dashboard/student-home" replace />;
  }

  // Redirect teachers (non-management) to teacher dashboard
  if (isTeacher && !isManagementOrAdmin && !isGradeCoordinator) {
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

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Welcome */}
      <motion.div variants={item} className="flex items-center gap-4">
        {profile.avatar && <AvatarPreview config={profile.avatar} size={80} />}
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">שלום, {profile.fullName}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {profile.roles.map((r) => (
              <span key={r} className={`text-xs px-2.5 py-1 rounded-full font-heading border ${ROLE_COLORS[r] || "bg-muted text-muted-foreground"}`}>
                {ROLE_LABELS[r] || r}
              </span>
            ))}
          </div>
          {profile.schoolName && (
            <p className="text-sm text-muted-foreground mt-1 font-body">{profile.schoolName}</p>
          )}
        </div>
      </motion.div>

      {/* Status */}
      {!profile.isApproved && (
        <motion.div variants={item}>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="font-heading font-medium text-warning">החשבון שלך ממתין לאישור</p>
                <p className="text-xs text-muted-foreground">תקבל/י גישה מלאה לאחר אישור הגורם המוסמך</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pending notifications */}
      {profile.pendingApprovalsCount > 0 && (
        <motion.div variants={item}>
          <Card className="border-destructive/30 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
                onClick={() => window.location.href = "/dashboard/approvals"}>
            <CardContent className="py-4 flex items-center gap-3">
              <div className="relative">
                <Users className="h-6 w-6 text-destructive" />
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {profile.pendingApprovalsCount}
                </span>
              </div>
              <div>
                <p className="font-heading font-medium">יש {profile.pendingApprovalsCount} בקשות אישור ממתינות</p>
                <p className="text-xs text-muted-foreground">לחץ כדי לצפות ולאשר</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid - Staff only */}
      {isStaff && (
        <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Users className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-heading font-bold">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground font-body">משתמשים</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
              <p className="text-2xl font-heading font-bold">{stats.approvedUsers}</p>
              <p className="text-xs text-muted-foreground font-body">מאושרים</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <Clock className="h-8 w-8 mx-auto text-warning mb-2" />
              <p className="text-2xl font-heading font-bold">{stats.pendingUsers}</p>
              <p className="text-xs text-muted-foreground font-body">ממתינים</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <BookOpen className="h-8 w-8 mx-auto text-secondary mb-2" />
              <p className="text-2xl font-heading font-bold">{stats.totalClasses}</p>
              <p className="text-xs text-muted-foreground font-body">כיתות</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Info */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">מידע כללי</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-body text-sm">
            <p><span className="text-muted-foreground">אימייל:</span> {profile.email}</p>
            {profile.schoolName && (
              <p><span className="text-muted-foreground">בית ספר:</span> {profile.schoolName}</p>
            )}
            <p>
              <span className="text-muted-foreground">סטטוס:</span>{" "}
              {profile.isApproved ? "מאושר" : "ממתין לאישור"}
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default DashboardHome;
