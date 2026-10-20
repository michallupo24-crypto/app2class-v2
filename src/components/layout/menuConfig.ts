import {
  BarChart3, BookOpen, ClipboardCheck, GraduationCap, HeartHandshake, House, LayoutGrid,
  MessagesSquare, Settings2, Sparkles, Users, type LucideIcon,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";

// Side menu structure per the "Side Menu" design: titled groups, each with an
// icon and an accent color (the icon tile and the active item's marker).

/** Line icon per group icon id (the ids were tool stickers, too playful for a menu). */
export const GROUP_ICONS: Record<string, LucideIcon> = {
  home_flat: House,
  chat: MessagesSquare,
  approve: ClipboardCheck,
  learn_note: BookOpen,
  ai: Sparkles,
  people: Users,
  chart: BarChart3,
  gear: Settings2,
  classroom: GraduationCap,
  shield: HeartHandshake,
  seats: LayoutGrid,
};

export interface MenuItem {
  title: string;
  url: string;
  /** Counter shown as a red tag (unread chats, pending approvals). */
  badge?: number;
}

export interface MenuGroup {
  title: string;
  /** Icon id (see GROUP_ICONS). */
  icon: string;
  color: string;
  items: MenuItem[];
}

export const ROLE_LABELS: Record<string, string> = {
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

const MAIN = { title: "ראשי", icon: "home_flat", color: "#E5484D" };
const COMMS = { title: "תקשורת", icon: "chat", color: "#6B5BFF" };

const I = (title: string, page: string): MenuItem => ({ title, url: page ? `/dashboard/${page}` : "/dashboard" });

export function buildMenu(profile: UserProfile): MenuGroup[] {
  const roles = profile.roles;
  const has = (r: string) => roles.includes(r);
  const isAdmin = has("system_admin");
  const isManagement = has("management");
  const isTeacher = has("professional_teacher") || has("educator");
  const isCouncilAdvisor = has("council_advisor");
  const isExamCoordinator = has("exam_coordinator");
  const hasApprovalPower = isAdmin || isManagement || has("educator") || has("secretary") || has("grade_coordinator");

  const council = isCouncilAdvisor ? [I("מועצת תלמידים", "council")] : [];
  const examBoard = isExamCoordinator ? [I("לוח מבחנים", "master-scheduler")] : [];

  let groups: MenuGroup[];

  if (has("parent")) {
    groups = [
      { ...MAIN, items: [I("דף הבית", "my-child"), I("מערכת שעות", "schedule"), I("דוחות וציונים", "grades")] },
      { ...COMMS, items: [I("שיחות", "chat"), I("פגישות הורים", "meetings"), I("עיתון בית הספר", "newspaper")] },
      { title: "אישורים", icon: "approve", color: "#1A6BAA", items: [I("אישורי טיולים", "event-approvals"),I("מגן זכויות", "rights")] },
    ];
  } else if (has("student")) {
    groups = [
      { ...MAIN, items: [I("דאשבורד", "student-home"), I("שיעור חי", "live-student"), I("לוח זמנים", "schedule"), I("נוכחות", "attendance")] },
      { title: "לימודים", icon: "learn_note", color: "#C98A00", items: [I("המקצועות שלי", "subjects"), I("משימות", "tasks"), I("ציונים", "grades"), I("הישגים", "badges"), I("ארכיון מבחנים", "exam-archive"), I("מסמכים", "documents"), I("מצגות", "presentations")] },
      { title: "כלים", icon: "ai", color: "#12807C", items: [I("עוזר AI", "ai-tutor"), I("מגן זכויות", "rights")] },
      { title: "קהילה", icon: "people", color: "#6B5BFF", items: [I("שיחות", "chat"), I("קהילה", "community"), I("מועצת תלמידים", "council"), I("עיתון בית הספר", "newspaper"), I("הצבעה לצלצול", "bell-vote")] },
    ];
  } else if (has("grade_coordinator")) {
    groups = [
      { ...MAIN, items: [I("דאשבורד", "grade-coordinator-home"), I("לוח זמנים", "schedule"), I("אישורים", "approvals")] },
      { title: "שכבה", icon: "chart", color: "#2E9D5B", items: [I("בניית מערכת שעות", "timetable-builder"), I("לוח מבחנים", "master-scheduler"), I("דופק שכבתי", "grade-progress"), I("תגבורים", "tutoring"), I("ישיבות צוות", "staff-meetings"), I("הודעות לשכבה", "grade-announcements"), I("אישורי טיולים", "event-approvals")] },
      { ...COMMS, items: [I("שיחות", "chat"), I("מסמכים", "documents"), ...(isExamCoordinator ? [I("ארכיון מבחנים", "exam-archive")] : []), ...council] },
    ];
  } else if (has("subject_coordinator") && !isManagement && !isAdmin) {
    groups = [
      { ...MAIN, items: [I("דאשבורד", "subject-coordinator-home"), I("לוח זמנים", "schedule")] },
      { title: "ניהול מקצוע", icon: "gear", color: "#C22E62", items: [I("שיבוץ מורים", "assign-teachers"), I("תכנון סילבוס", "syllabus-planner"), ...examBoard] },
      { title: "הוראה", icon: "classroom", color: "#C98A00", items: [I("מסמכים", "documents"), I("ארכיון מבחנים", "exam-archive")] },
      { ...COMMS, items: [I("שיחות", "chat"), ...council] },
    ];
  } else if (has("counselor") && !isManagement && !isAdmin) {
    groups = [
      { ...MAIN, items: [I("דאשבורד", "counselor-home"), I("לוח זמנים", "schedule")] },
      { title: "ייעוץ", icon: "shield", color: "#12807C", items: [I("תיקי מעקב", "counselor-cases"), I("מפת הושבה", "seating"), ...examBoard, ...(isExamCoordinator ? [I("ארכיון מבחנים", "exam-archive")] : [])] },
      { ...COMMS, items: [I("שיחות", "chat"), I("מסמכים", "documents"), ...council] },
    ];
  } else if (isTeacher) {
    groups = [
      { ...MAIN, items: [I("דאשבורד", "teacher-home"), I("שיעור חי", "live-lesson"), I("לוח זמנים", "schedule"), I("הכיתות שלי", "my-classes")] },
      { title: "כיתה", icon: "seats", color: "#2E9D5B", items: [I("הקראת שמות", "roll-call"), I("מפת הושבה", "seating"), I("הצדקות היעדרות", "absence-justifications"), I("דוחות", "teacher-grades")] },
      { title: "הוראה", icon: "classroom", color: "#C98A00", items: [I("המקצועות שלי", "teaching"), I("משימות", "teacher-assignments"), I("סטודיו משימות", "task-studio"), I("מסמכים", "documents"), I("מצגות", "presentations"), I("ארכיון מבחנים", "exam-archive"), ...examBoard] },
      { ...COMMS, items: [I("שיחות", "chat"), I("פגישות הורים", "meetings"), I("אישורי טיולים", "event-approvals"), ...(has("educator") ? [I("אישורים", "approvals")] : []), ...council] },
    ];
  } else {
    const leads = isManagement || isAdmin;
    groups = [
      { ...MAIN, items: [I("דאשבורד", ""), ...(leads ? [I("דאשבורד מנהלת", "principal")] : []), ...(hasApprovalPower ? [I("אישורים", "approvals")] : []), I("לוח זמנים", "schedule")] },
      ...(leads ? [{
        title: "ניהול", icon: "gear", color: "#C22E62",
        items: [I("בניית מערכת שעות", "timetable-builder"), I("ניהול תפקידי צוות", "team-roles"), I("הגדרות בית הספר", "school-settings"), I("ארכיון מבחנים", "exam-archive"),
          ...(isAdmin ? [I("ניהול מערכת", "admin"), I("עץ ארגוני - כלל המערכת", "system-org-tree")] : [])],
      }] : []),
      { title: "קהילה ותקשורת", icon: "people", color: "#6B5BFF", items: [I("שיחות", "chat"), I("מסמכים", "documents"), ...(leads ? [I("מועצת תלמידים", "council"), I("עיתון בית הספר", "newspaper")] : [])] },
    ];
  }

  // Everyone gets help & support at the end of the last group.
  groups[groups.length - 1].items.push(I("עזרה ותמיכה", "support"));

  const badges: Record<string, number> = {
    "/dashboard/chat": profile.unreadChatCount || 0,
    "/dashboard/approvals": profile.pendingApprovalsCount || 0,
  };
  for (const g of groups) for (const it of g.items) {
    if (badges[it.url]) it.badge = badges[it.url];
  }
  return groups;
}
