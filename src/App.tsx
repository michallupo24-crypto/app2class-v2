import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";

const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const StudentRegistration = lazy(() => import("./pages/register/StudentRegistration"));
const ParentRegistration = lazy(() => import("./pages/register/ParentRegistration"));
const StaffRegistration = lazy(() => import("./pages/register/StaffRegistration"));
const DashboardLayout = lazy(() => import("./components/layout/DashboardLayout"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const ApprovalsPage = lazy(() => import("./pages/dashboard/ApprovalsPage"));
const SubjectDetailPage = lazy(() => import("./pages/dashboard/SubjectDetailPage"));
const StudentDashboard = lazy(() => import("./pages/dashboard/StudentDashboard"));
const SubjectHubsPage = lazy(() => import("./pages/dashboard/SubjectHubsPage"));
const TasksPage = lazy(() => import("./pages/dashboard/TasksPage"));
const TeacherDashboard = lazy(() => import("./pages/dashboard/TeacherDashboard"));
const RollCallPage = lazy(() => import("./pages/dashboard/RollCallPage"));
const AbsenceJustificationsPage = lazy(() => import("./pages/dashboard/AbsenceJustificationsPage"));
const MeetingSlotsPage = lazy(() => import("./pages/dashboard/MeetingSlotsPage"));
const TeacherAssignmentsPage = lazy(() => import("./pages/dashboard/TeacherAssignmentsPage"));
const TeacherGradesPage = lazy(() => import("./pages/dashboard/TeacherGradesPage"));
const TaskStudioPage = lazy(() => import("./pages/dashboard/TaskStudioPage"));
const SyllabusPlannerPage = lazy(() => import("./pages/dashboard/SyllabusPlannerPage"));
const StudentReportPage = lazy(() => import("./pages/dashboard/StudentReportPage"));
const BadgesPage = lazy(() => import("./pages/dashboard/BadgesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ParentDashboardPage = lazy(() => import("./pages/dashboard/ParentDashboardPage"));
const StudentGradesPage = lazy(() => import("./pages/dashboard/StudentGradesPage"));
const AITutorPage = lazy(() => import("./pages/dashboard/AITutorPage"));
const StudentPracticePage = lazy(() => import("./pages/dashboard/StudentPracticePage"));
const StudentLiveLessonPage = lazy(() => import("./pages/dashboard/StudentLiveLessonPage"));
const StudentRightsPage = lazy(() => import("./pages/dashboard/StudentRightsPage"));
const SnakesLaddersGamePage = lazy(() => import("./pages/dashboard/SnakesLaddersGamePage"));
const MountainClimbGamePage = lazy(() => import("./pages/dashboard/MountainClimbGamePage"));
const CoopGamePage = lazy(() => import("./pages/dashboard/CoopGamePage"));
const TeacherLiveLessonPage = lazy(() => import("./pages/dashboard/TeacherLiveLessonPage"));
const TeacherAssignmentPage = lazy(() => import("./pages/dashboard/TeacherAssignmentPage"));
const GradeCoordinatorDashboard = lazy(() => import("./pages/dashboard/GradeCoordinatorDashboard"));
const MasterSchedulerPage = lazy(() => import("./pages/dashboard/MasterSchedulerPage"));
const GradeProgressPage = lazy(() => import("./pages/dashboard/GradeProgressPage"));
const TutoringManagementPage = lazy(() => import("./pages/dashboard/TutoringManagementPage"));
const StaffMeetingsPage = lazy(() => import("./pages/dashboard/StaffMeetingsPage"));
const GradeAnnouncementsPage = lazy(() => import("./pages/dashboard/GradeAnnouncementsPage"));
const AvatarEditPage = lazy(() => import("./pages/dashboard/AvatarEditPage"));
const ChatPage = lazy(() => import("./pages/dashboard/ChatPage"));
const SystemAdminPage = lazy(() => import("./pages/dashboard/SystemAdminPage"));
const PrincipalDashboardPage = lazy(() => import("./pages/dashboard/PrincipalDashboardPage"));
const SchoolOrgTreePage = lazy(() => import("./pages/dashboard/SchoolOrgTreePage"));
const SystemAdminOrgTreePage = lazy(() => import("./pages/dashboard/SystemAdminOrgTreePage"));
const SchedulePage = lazy(() => import("./pages/dashboard/SchedulePage"));
const CommunityPage = lazy(() => import("./pages/dashboard/CommunityPage"));
const StudentAttendancePage = lazy(() => import("./pages/dashboard/StudentAttendancePage"));
const StudentSeatingPage = lazy(() => import("./pages/dashboard/StudentSeatingPage"));
const SeatingMapPage = lazy(() => import("./pages/dashboard/SeatingMapPage"));
const CounselorDashboard = lazy(() => import("./pages/dashboard/CounselorDashboard"));
const CounselorCasesPage = lazy(() => import("./pages/dashboard/CounselorCasesPage"));
const CouncilPage = lazy(() => import("./pages/dashboard/CouncilPage"));
const NewspaperPage = lazy(() => import("./pages/dashboard/NewspaperPage"));
const BellVotePage = lazy(() => import("./pages/dashboard/BellVotePage"));
const EventApprovalsPage = lazy(() => import("./pages/dashboard/EventApprovalsPage"));
const SubjectCoordinatorDashboard = lazy(() => import("./pages/dashboard/SubjectCoordinatorDashboard"));
const SupportPage = lazy(() => import("./pages/dashboard/SupportPage"));
const FinanceHubPage = lazy(() => import("./pages/dashboard/FinanceHubPage"));
const ExamArchivePage = lazy(() => import("./pages/dashboard/ExamArchivePage"));
const MyClassesPage = lazy(() => import("./pages/dashboard/MyClassesPage"));
const TimetableBuilderPage = lazy(() => import("./pages/dashboard/TimetableBuilderPage"));
const DocumentsPage = lazy(() => import("./pages/dashboard/DocumentsPage"));
const PresentationsPage = lazy(() => import("./pages/dashboard/PresentationsPage"));
const TeamRolesPage = lazy(() => import("./pages/dashboard/TeamRolesPage"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/register/student" element={<StudentRegistration />} />
            <Route path="/register/parent" element={<ParentRegistration />} />
            <Route path="/register/staff" element={<StaffRegistration />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="my-child" element={<ParentDashboardPage />} />
              <Route path="admin" element={<SystemAdminPage />} />
              <Route path="principal" element={<PrincipalDashboardPage />} />
              <Route path="org-tree" element={<SchoolOrgTreePage />} />
              <Route path="system-org-tree" element={<SystemAdminOrgTreePage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="timetable" element={<SchedulePage />} />
              <Route path="calendar" element={<SchedulePage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="presentations" element={<PresentationsPage />} />
              {/* Student routes */}
              <Route path="student-home" element={<StudentDashboard />} />
              <Route path="subjects" element={<SubjectHubsPage />} />
              <Route path="subjects/:subjectName" element={<SubjectDetailPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="ai-tutor" element={<AITutorPage />} />
              <Route path="grades" element={<StudentGradesPage />} />
              <Route path="grades/:studentId" element={<StudentGradesPage />} />
              <Route path="report/:studentId" element={<StudentReportPage />} />
              <Route path="badges" element={<BadgesPage />} />
              <Route path="practice/:assignmentId" element={<StudentPracticePage />} />
              <Route path="live-student" element={<StudentLiveLessonPage />} />
              <Route path="rights" element={<StudentRightsPage />} />
              <Route path="game/snakes/:assignmentId" element={<SnakesLaddersGamePage />} />
              <Route path="game/mountain/:assignmentId" element={<MountainClimbGamePage />} />
              <Route path="game/coop/:assignmentId" element={<CoopGamePage />} />
              <Route path="attendance" element={<StudentAttendancePage />} />
              <Route path="attendance/:studentId" element={<StudentAttendancePage />} />
              <Route path="student-seating" element={<StudentSeatingPage />} />
              {/* Teacher routes */}
              <Route path="teacher-home" element={<TeacherDashboard />} />
              <Route path="roll-call" element={<RollCallPage />} />
              <Route path="absence-justifications" element={<AbsenceJustificationsPage />} />
              <Route path="meetings" element={<MeetingSlotsPage />} />
              <Route path="seating" element={<SeatingMapPage />} />
              <Route path="live-lesson" element={<TeacherLiveLessonPage />} />
              <Route path="teacher-assignments" element={<TeacherAssignmentsPage />} />
              <Route path="task-studio" element={<TaskStudioPage />} />
              <Route path="teacher-grades" element={<TeacherGradesPage />} />
              <Route path="my-classes" element={<MyClassesPage />} />
              <Route path="assign-teachers" element={<TeacherAssignmentPage />} />
              <Route path="subject-coordinator-home" element={<SubjectCoordinatorDashboard />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="finance-hub" element={<FinanceHubPage />} />
              <Route path="exam-archive" element={<ExamArchivePage />} />
              {/* Grade Coordinator routes */}
              <Route path="grade-coordinator-home" element={<GradeCoordinatorDashboard />} />
              <Route path="timetable-builder" element={<TimetableBuilderPage />} />
              <Route path="team-roles" element={<TeamRolesPage />} />
              <Route path="master-scheduler" element={<MasterSchedulerPage />} />
              <Route path="grade-progress" element={<GradeProgressPage />} />
              <Route path="tutoring" element={<TutoringManagementPage />} />
              <Route path="staff-meetings" element={<StaffMeetingsPage />} />
              <Route path="grade-announcements" element={<GradeAnnouncementsPage />} />
              <Route path="syllabus-planner" element={<SyllabusPlannerPage />} />
              <Route path="avatar-edit" element={<AvatarEditPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="event-approvals" element={<EventApprovalsPage />} />
              {/* Counselor routes */}
              <Route path="counselor-home" element={<CounselorDashboard />} />
              <Route path="counselor-cases" element={<CounselorCasesPage />} />
              {/* Student Life Hub */}
              <Route path="council" element={<CouncilPage />} />
              <Route path="newspaper" element={<NewspaperPage />} />
              <Route path="bell-vote" element={<BellVotePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
