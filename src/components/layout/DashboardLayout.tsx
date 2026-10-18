import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolGuidelines } from "@/hooks/useSchoolGuidelines";
import { disabledPages } from "@/lib/schoolSetup";
import { Bell, Clock, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Navigate, Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FontSizeToggle } from "@/components/FontSizeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import NotificationBell from "@/components/notifications/NotificationBell";

// Which roles may open each role-specific page. Pages not listed are shared.
// The sidebar already hides these links; this stops opening them by URL
// (RLS still protects the data either way). Admins may open everything.
const STAFF = "staff";
const ROUTE_ROLES: Record<string, string[] | typeof STAFF> = {
  "teacher-home": STAFF, "live-lesson": STAFF, "roll-call": STAFF, "absence-justifications": STAFF,
  "teacher-assignments": STAFF, "task-studio": STAFF, "teacher-grades": STAFF, "seating": STAFF, "my-classes": STAFF, "teaching": STAFF,
  "admin": [], "system-org-tree": [], "school-settings": ["management"],
  "principal": ["management"], "team-roles": ["management"],
  "counselor-home": ["counselor"], "counselor-cases": ["counselor"],
  "subject-coordinator-home": ["subject_coordinator", "management"], "syllabus-planner": ["subject_coordinator", "management"],
  "assign-teachers": ["subject_coordinator", "management"],
  "grade-coordinator-home": ["grade_coordinator", "management"], "grade-progress": ["grade_coordinator", "management"],
  "tutoring": ["grade_coordinator", "subject_coordinator", "management"], "staff-meetings": ["grade_coordinator", "subject_coordinator", "management"],
  "grade-announcements": ["grade_coordinator", "management"],
  "master-scheduler": ["grade_coordinator", "subject_coordinator", "management", "exam_coordinator", "counselor"],
  "timetable-builder": ["grade_coordinator", "subject_coordinator", "management"],
  "my-child": ["parent"],
  "student-home": ["student"], "live-student": ["student"], "student-seating": ["student"],
};

function canOpen(pathname: string, roles: string[]): boolean {
  if (roles.includes("system_admin") || roles.includes("super_admin")) return true;
  const page = pathname.replace(/^\/dashboard\/?/, "").split("/")[0];
  const allowed = ROUTE_ROLES[page];
  if (allowed === undefined) return true;
  if (allowed === STAFF) return roles.some((r) => r !== "student" && r !== "parent");
  return allowed.some((r) => roles.includes(r));
}

const DashboardLayout = () => {
  const { profile, loading, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const guidelines = useSchoolGuidelines(profile?.schoolId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <img
              src="/logo.png"
              alt="App2Class"
              className="absolute inset-0 m-auto h-8 w-8 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (!profile.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" dir="rtl">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <h1 className="font-heading font-bold text-xl">החשבון שלך ממתין לאישור</h1>
          <p className="text-sm text-muted-foreground">
            {profile.schoolId
              ? "תקבל/י גישה מלאה למערכת לאחר אישור הגורם המוסמך בבית הספר."
              : "אם רשמת בית ספר חדש, הוא ייפתח לאחר אישור מנהל המערכת."}
          </p>
          {!profile.schoolId && (
            <Button variant="secondary" onClick={() => navigate("/register/school")}>לבקשת רישום בית הספר</Button>
          )}
          <Button variant="outline" onClick={logout}>התנתקות</Button>
        </div>
      </div>
    );
  }

  const page = location.pathname.replace(/^\/dashboard\/?/, "").split("/")[0];
  const managesSchool = profile.roles.some((r) => ["management", "system_admin", "super_admin"].includes(r));
  if (!canOpen(location.pathname, profile.roles) || (!managesSchool && disabledPages(guidelines).has(page))) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:font-heading"
      >
        דלג לתוכן הראשי
      </a>
      <div className="min-h-screen flex w-full" dir="rtl">
        {/* Sidebar */}
        <div className="hidden md:flex flex-col border-l border-border">
          <div className="h-14 flex items-center justify-center border-b border-border bg-card/80 backdrop-blur-sm">
            <SidebarTrigger />
          </div>
          <AppSidebar profile={profile} onLogout={logout} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">

          {/* Top Bar */}
          <header className="h-14 border-b border-border bg-background/85 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="App2Class"
                className="h-8 w-8 object-contain cursor-pointer"
                onClick={() => navigate("/dashboard")}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <span className="font-heading font-black text-lg hidden sm:block cursor-pointer" onClick={() => navigate("/dashboard")}>
                App2Class
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Unread chat */}
              {profile.unreadChatCount > 0 && (
                <Button variant="ghost" size="icon" className="relative h-9 w-9"
                  aria-label={`שיחות שלא נקראו: ${profile.unreadChatCount}`}
                  onClick={() => navigate("/dashboard/chat")}>
                  <MessageCircle className="h-4 w-4" />
                  <Badge variant="destructive" aria-hidden="true"
                    className="absolute -top-0.5 -left-0.5 text-[9px] px-1 py-0 h-4 min-w-4 flex items-center justify-center">
                    {profile.unreadChatCount > 9 ? "9+" : profile.unreadChatCount}
                  </Badge>
                </Button>
              )}

              {/* Pending approvals */}
              {profile.pendingApprovalsCount > 0 && (
                <Button variant="ghost" size="icon" className="relative h-9 w-9"
                  aria-label={`בקשות אישור ממתינות: ${profile.pendingApprovalsCount}`}
                  onClick={() => navigate("/dashboard/approvals")}>
                  <Bell className="h-4 w-4" />
                  <Badge variant="destructive" aria-hidden="true"
                    className="absolute -top-0.5 -left-0.5 text-[9px] px-1 py-0 h-4 min-w-4 flex items-center justify-center">
                    {profile.pendingApprovalsCount > 9 ? "9+" : profile.pendingApprovalsCount}
                  </Badge>
                </Button>
              )}

              {/* Notifications */}
              <NotificationBell userId={profile.id} />

              {/* Font size */}
              <FontSizeToggle />

              {/* Dark mode toggle */}
              <ThemeToggle />
            </div>
          </header>

          <AnnouncementBanner schoolId={profile.schoolId} />

          {/* Main Content */}
          <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8 overflow-auto">
            <ErrorBoundary>
              <Outlet context={{ profile, refresh }} />
            </ErrorBoundary>
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav profile={profile} />
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
