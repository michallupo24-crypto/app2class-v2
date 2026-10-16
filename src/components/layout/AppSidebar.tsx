import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Bell,
  Settings,
  GraduationCap,
  UserCheck,
  BookOpen,
  BarChart3,
  LogOut,
  Shield,
  Activity,
  Trophy,
  Calendar,
  Brain,
  ClipboardList,
  Flame,
  FileText,
  MessageCircle,
  Building2,
  Lock,
  User,
  HeartPulse,
  Landmark,
  Newspaper,
  Music,
  FileSignature,
  LifeBuoy,
  Wallet,
  Archive,
  FileCheck2,
  CalendarClock,
  LayoutGrid,
  Wand2,
  FileEdit,
  UserCog,
  Presentation,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  council_advisor: "אחראית מועצה",
  exam_coordinator: "רכז/ת בגרויות ומבחנים",
  secretary: "מזכירה/מזכיר",
  parent_committee_rep: "נציג/ת ועד הורים",
};

interface AppSidebarProps {
  profile: UserProfile;
  onLogout: () => void;
}

export function AppSidebar({ profile, onLogout }: AppSidebarProps) {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const roles = profile.roles;

  const isStudent = roles.includes("student");
  const isTeacher = roles.includes("professional_teacher") || roles.includes("educator");
  const isGradeCoordinator = roles.includes("grade_coordinator");
  const isSubjectCoordinator = roles.includes("subject_coordinator");
  const isCounselor = roles.includes("counselor");
  const isAdmin = roles.includes("system_admin");
  const isManagement = roles.includes("management");
  const isEducator = roles.includes("educator");
  const isCouncilAdvisor = roles.includes("council_advisor");
  const isExamCoordinator = roles.includes("exam_coordinator");
  const isSecretary = roles.includes("secretary");
  const hasApprovalPower = isAdmin || isManagement || isEducator || isSecretary || roles.includes("grade_coordinator");

  // Student navigation
  const studentItems = [
    { title: "דאשבורד", url: "/dashboard/student-home", icon: LayoutDashboard },
    { title: "המקצועות שלי", url: "/dashboard/subjects", icon: BookOpen },
    { title: "משימות", url: "/dashboard/tasks", icon: Activity },
    { title: "הישגים", url: "/dashboard/badges", icon: Trophy },
    { title: "ציונים", url: "/dashboard/grades", icon: FileText },
    { title: "שיעור חי", url: "/dashboard/live-student", icon: Activity },
    { title: "לוח זמנים", url: "/dashboard/schedule", icon: Calendar },
    { title: "נוכחות", url: "/dashboard/attendance", icon: ClipboardList },
    { title: "מגן זכויות", url: "/dashboard/rights", icon: Shield },
    { title: "עוזר AI", url: "/dashboard/ai-tutor", icon: Brain },
    { title: "מסמכים", url: "/dashboard/documents", icon: FileEdit },
    { title: "מצגות", url: "/dashboard/presentations", icon: Presentation },
    { title: "ארכיון מבחנים", url: "/dashboard/exam-archive", icon: Archive },
    { title: "שיחות", url: "/dashboard/chat", icon: MessageCircle },
    { title: "קהילה", url: "/dashboard/community", icon: Users },
    { title: "מועצת תלמידים", url: "/dashboard/council", icon: Landmark },
    { title: "עיתון בית הספר", url: "/dashboard/newspaper", icon: Newspaper },
    { title: "הצבעה לצלצול", url: "/dashboard/bell-vote", icon: Music },
  ];

  // Teacher navigation
  const teacherItems: { title: string; url: string; icon: any }[] = [
    { title: "דאשבורד", url: "/dashboard/teacher-home", icon: LayoutDashboard },
    { title: "שיעור חי", url: "/dashboard/live-lesson", icon: Activity },
    { title: "הקראת שמות", url: "/dashboard/roll-call", icon: ClipboardList },
    { title: "הצדקות היעדרות", url: "/dashboard/absence-justifications", icon: FileCheck2 },
    { title: "פגישות הורים", url: "/dashboard/meetings", icon: CalendarClock },
    { title: "משימות", url: "/dashboard/teacher-assignments", icon: FileText },
    { title: "סטודיו משימות", url: "/dashboard/task-studio", icon: Settings },
    { title: "דוחות", url: "/dashboard/teacher-grades", icon: BarChart3 },
    { title: "מפת הושבה", url: "/dashboard/seating", icon: LayoutGrid },
    { title: "מסמכים", url: "/dashboard/documents", icon: FileEdit },
    { title: "מצגות", url: "/dashboard/presentations", icon: Presentation },
    { title: "לוח זמנים", url: "/dashboard/schedule", icon: Calendar },
    { title: "הכיתות שלי", url: "/dashboard/my-classes", icon: Users },
    { title: "אישורי טיולים", url: "/dashboard/event-approvals", icon: FileSignature },
    { title: "ארכיון מבחנים", url: "/dashboard/exam-archive", icon: Archive },
    { title: "שיחות", url: "/dashboard/chat", icon: MessageCircle },
  ];
  if (isCouncilAdvisor) teacherItems.push({ title: "מועצת תלמידים", url: "/dashboard/council", icon: Landmark });
  if (isExamCoordinator) teacherItems.push({ title: "לוח מבחנים", url: "/dashboard/master-scheduler", icon: Calendar });

  // Subject coordinator
  const subjectCoordinatorItems: { title: string; url: string; icon: any }[] = [
    { title: "דאשבורד", url: "/dashboard/subject-coordinator-home", icon: LayoutDashboard },
    { title: "שיבוץ מורים", url: "/dashboard/assign-teachers", icon: GraduationCap },
    { title: "תכנון סילבוס", url: "/dashboard/syllabus-planner", icon: BookOpen },
    { title: "מסמכים", url: "/dashboard/documents", icon: FileEdit },
    { title: "ארכיון מבחנים", url: "/dashboard/exam-archive", icon: Archive },
    { title: "לוח זמנים", url: "/dashboard/schedule", icon: Calendar },
    { title: "שיחות", url: "/dashboard/chat", icon: MessageCircle },
  ];
  if (isCouncilAdvisor) subjectCoordinatorItems.push({ title: "מועצת תלמידים", url: "/dashboard/council", icon: Landmark });
  if (isExamCoordinator) subjectCoordinatorItems.push({ title: "לוח מבחנים", url: "/dashboard/master-scheduler", icon: Calendar });

  // Grade coordinator
  const gradeCoordinatorItems: { title: string; url: string; icon: any }[] = [
    { title: "דאשבורד", url: "/dashboard/grade-coordinator-home", icon: LayoutDashboard },
    { title: "בניית מערכת שעות", url: "/dashboard/timetable-builder", icon: Wand2 },
    { title: "לוח מבחנים", url: "/dashboard/master-scheduler", icon: Calendar },
    { title: "דופק שכבתי", url: "/dashboard/grade-progress", icon: BarChart3 },
    { title: "אישורי טיולים", url: "/dashboard/event-approvals", icon: FileSignature },
    { title: "מסמכים", url: "/dashboard/documents", icon: FileEdit },
    { title: "לוח זמנים", url: "/dashboard/schedule", icon: Calendar },
    { title: "שיחות", url: "/dashboard/chat", icon: MessageCircle },
  ];
  if (isCouncilAdvisor) gradeCoordinatorItems.push({ title: "מועצת תלמידים", url: "/dashboard/council", icon: Landmark });
  if (isExamCoordinator) gradeCoordinatorItems.push({ title: "ארכיון מבחנים", url: "/dashboard/exam-archive", icon: Archive });

  // Counselor navigation
  const counselorItems: { title: string; url: string; icon: any }[] = [
    { title: "דאשבורד", url: "/dashboard/counselor-home", icon: LayoutDashboard },
    { title: "תיקי מעקב", url: "/dashboard/counselor-cases", icon: HeartPulse },
    { title: "מפת הושבה", url: "/dashboard/seating", icon: LayoutGrid },
    { title: "מסמכים", url: "/dashboard/documents", icon: FileEdit },
    { title: "לוח זמנים", url: "/dashboard/schedule", icon: Calendar },
    { title: "שיחות", url: "/dashboard/chat", icon: MessageCircle },
  ];
  if (isCouncilAdvisor) counselorItems.push({ title: "מועצת תלמידים", url: "/dashboard/council", icon: Landmark });
  if (isExamCoordinator) {
    counselorItems.push({ title: "לוח מבחנים", url: "/dashboard/master-scheduler", icon: Calendar });
    counselorItems.push({ title: "ארכיון מבחנים", url: "/dashboard/exam-archive", icon: Archive });
  }

  // Parent Navigation (CLEAN & PREMIUM)
  const parentItems = [
    { title: "דף הבית", url: "/dashboard/my-child", icon: LayoutDashboard },
    { title: "דוחות וציונים", url: "/dashboard/grades", icon: BarChart3 },
    { title: "מערכת שעות", url: "/dashboard/schedule", icon: Calendar },
    { title: "שיחות", url: "/dashboard/chat", icon: MessageCircle },
    { title: "פגישות הורים", url: "/dashboard/meetings", icon: CalendarClock },
    { title: "מגן זכויות", url: "/dashboard/rights", icon: Shield },
    { title: "אישורי טיולים", url: "/dashboard/event-approvals", icon: FileSignature },
    { title: "עיתון בית הספר", url: "/dashboard/newspaper", icon: Newspaper },
    { title: "תשלומים", url: "/dashboard/finance-hub", icon: Wallet },
  ];

  // Admin/Management
  const adminItems: { title: string; url: string; icon: any }[] = [
    { title: "דאשבורד", url: "/dashboard", icon: LayoutDashboard },
  ];

  if (hasApprovalPower) adminItems.push({ title: "אישורים", url: "/dashboard/approvals", icon: UserCheck });
  if (isManagement || isAdmin) {
    adminItems.push({ title: "דאשבורד מנהלת", url: "/dashboard/principal", icon: User });
  }
  if (isAdmin) {
    adminItems.push({ title: "ניהול מערכת", url: "/dashboard/admin", icon: Shield });
    adminItems.push({ title: "עץ ארגוני - כלל המערכת", url: "/dashboard/system-org-tree", icon: Building2 });
  }
  adminItems.push({ title: "שיחות", url: "/dashboard/chat", icon: MessageCircle });
  adminItems.push({ title: "מסמכים", url: "/dashboard/documents", icon: FileEdit });
  adminItems.push({ title: "לוח זמנים", url: "/dashboard/schedule", icon: Calendar });
  if (isManagement || isAdmin) {
    adminItems.push({ title: "בניית מערכת שעות", url: "/dashboard/timetable-builder", icon: Wand2 });
    adminItems.push({ title: "ניהול תפקידי צוות", url: "/dashboard/team-roles", icon: UserCog });
    adminItems.push({ title: "מועצת תלמידים", url: "/dashboard/council", icon: Landmark });
    adminItems.push({ title: "עיתון בית הספר", url: "/dashboard/newspaper", icon: Newspaper });
    adminItems.push({ title: "מרכז תשלומים", url: "/dashboard/finance-hub", icon: Wallet });
    adminItems.push({ title: "ארכיון מבחנים", url: "/dashboard/exam-archive", icon: Archive });
  }

  // SELECT ITEMS BASED ON ROLE PRIORITY
  const getItems = () => {
    if (roles.includes("parent")) return parentItems;
    if (isStudent) return studentItems;
    if (isGradeCoordinator) return gradeCoordinatorItems;
    if (isSubjectCoordinator && !isManagement && !isAdmin) return subjectCoordinatorItems;
    if (isCounselor && !isManagement && !isAdmin) return counselorItems;
    if (isTeacher) return teacherItems;
    return adminItems;
  };

  const mainItems = getItems();

  return (
    <Sidebar side="right" collapsible="icon" className="border-r-0 border-l border-border [&_[data-sidebar=sidebar]]:bg-card/80 [&_[data-sidebar=sidebar]]:backdrop-blur">
      <SidebarContent>
        {/* Brand + user profile card */}
        <SidebarGroup className="gap-2.5">
          {!collapsed && (
            <div className="flex items-center gap-2 px-1.5 pt-1">
              <img src="/logo.png" alt="" className="h-[34px] w-[34px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="font-heading text-[17px] font-black text-foreground">App2Class</span>
            </div>
          )}
          <button
            type="button"
            className={`w-full p-2.5 flex items-center gap-2.5 text-right bg-card hover:bg-soft rounded-[16px] shadow-[0_4px_12px_-9px_rgba(40,30,15,0.4)] transition-colors ${collapsed ? "justify-center" : ""}`}
            onClick={() => navigate("/dashboard/avatar-edit")}
            aria-label="ערוך אווטאר"
            title="ערוך אווטאר"
          >
            {/* Round avatar with a white rim on a pastel background, per the design language */}
            <div
              className="shrink-0 rounded-full overflow-hidden border-[2.5px] border-white shadow-[0_2px_6px_rgba(40,30,15,0.25)] bg-info-soft flex items-center justify-center dark:border-card"
              style={{ width: collapsed ? 32 : 42, height: collapsed ? 32 : 42 }}
            >
              {profile.avatar ? (
                <AvatarPreview config={profile.avatar} size={collapsed ? 32 : 42} />
              ) : (
                <span className="font-heading font-black text-info text-base">{profile.fullName.trim().charAt(0)}</span>
              )}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-heading font-extrabold text-[13.5px] leading-none truncate">{profile.fullName}</p>
                <div className="flex flex-wrap gap-1 mt-[5px]">
                  {roles.slice(0, 2).map((r) => (
                    <span key={r} className="text-[10.5px] leading-none bg-[#E3EEFD] text-link px-[7px] py-[3px] rounded-full font-body font-extrabold">
                      {ROLE_LABELS[r] || r}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </button>
        </SidebarGroup>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="font-body text-[11.5px] font-extrabold text-hint">תפריט ראשי</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={true}
                      className="flex items-center gap-3 px-3 py-2 rounded-[11px] font-bold text-text-secondary transition-colors hover:bg-muted"
                      activeClassName="!bg-primary !text-primary-foreground shadow-[0_6px_12px_-6px_rgba(27,35,51,0.5)]"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="font-body text-[13.5px]">{item.title}</span>
                      )}
                      {!collapsed && item.url === "/dashboard/chat" && (profile as any).unreadChatCount > 0 && (
                        <div className="mr-auto">
                          <Badge className="text-[10px] leading-none px-1.5 py-[3px] h-auto border-0 bg-[#E5484D] hover:bg-[#E5484D] text-white font-heading font-black">
                            {(profile as any).unreadChatCount}
                          </Badge>
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/dashboard/support"
                className="flex items-center gap-3 px-3 py-2 rounded-[11px] font-bold text-text-secondary transition-colors hover:bg-muted"
                activeClassName="!bg-primary !text-primary-foreground"
              >
                <LifeBuoy className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="font-body text-sm">עזרה ותמיכה</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} className="font-bold text-destructive hover:bg-destructive-soft hover:text-destructive">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="font-body text-sm">התנתק</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
