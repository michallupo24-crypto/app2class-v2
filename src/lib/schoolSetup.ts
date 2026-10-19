import { STICKER_GROUPS } from "@/lib/subjectStickers";

/* Shared model for the school registration form and the school settings
   page: the same sections are filled once in the application and edited
   later by the principal. */

export const ALL_GRADES = ["ז", "ח", "ט", "י", "יא", "יב"] as const;
export const MIDDLE_GRADES = ["ז", "ח", "ט"];
export const HIGH_GRADES = ["י", "יא", "יב"];

export type SubjectScope = "school" | "middle" | "high" | "grades";
export type SubjectKind = "regular" | "track" | "ability_group";
export type LogoMode = "catalog" | "upload" | "design_request";

export interface TrackDraft { name: string; sticker: string | null; logoUrl?: string | null; }

export interface SubjectDraft {
  name: string;
  /** Catalog subject whose sticker is the logo (catalog subjects: the name itself). */
  sticker: string | null;
  logoMode: LogoMode;
  logoUrl?: string | null;
  custom?: boolean;
  scope: SubjectScope;
  grades: string[];
  kind: SubjectKind;
  /** Ability groups share the subject's logo. */
  levels?: string[];
  /** Tracks each get their own logo. */
  tracks?: TrackDraft[];
}

export interface RoomDraft { name: string; kind: string; capacity: string; }
export interface TeacherDraft { id?: string; linked?: boolean; fullName: string; email: string; subjects: string[]; role: string; }
export interface CustomRoleDraft { id?: string; name: string; areas: string[]; }

export interface Guidelines {
  chat: {
    enabled: boolean;
    studentTeacherMessaging: boolean;
    parentTeacherMessaging: boolean;
    limitHours: boolean;
    allowedFrom: string;
    allowedUntil: string;
    classGroups: boolean;
  };
  exams: { maxPerWeek: number; maxPerDay: number; minNoticeDays: number; };
  assignments: { maxHomeworkPerDay: number; allowLate: boolean; maxWeeklyHours: number; };
  forums: { enabled: boolean; studentPosts: boolean; preModeration: boolean; };
  council: { enabled: boolean; seatsPerGrade: number; termMonths: number; };
  elections: { enabled: boolean; month: string; anonymousVoting: boolean; };
  newspaper: { enabled: boolean; studentWriters: boolean; editorApproval: boolean; };
  games: { enabled: boolean; bellVote: boolean; };
}

export const DEFAULT_GUIDELINES: Guidelines = {
  chat: { enabled: true, studentTeacherMessaging: true, parentTeacherMessaging: true, limitHours: true, allowedFrom: "07:00", allowedUntil: "21:00", classGroups: true },
  exams: { maxPerWeek: 3, maxPerDay: 1, minNoticeDays: 7 },
  assignments: { maxHomeworkPerDay: 2, allowLate: true, maxWeeklyHours: 6 },
  forums: { enabled: true, studentPosts: true, preModeration: false },
  council: { enabled: true, seatsPerGrade: 2, termMonths: 12 },
  elections: { enabled: true, month: "אוקטובר", anonymousVoting: true },
  newspaper: { enabled: true, studentWriters: true, editorApproval: true },
  games: { enabled: true, bellVote: true },
};

/** Fills in keys missing from stored guidelines (older rows, new options). */
export function withGuidelineDefaults(g: Partial<Guidelines> | null | undefined): Guidelines {
  const out: any = {};
  for (const [k, v] of Object.entries(DEFAULT_GUIDELINES)) out[k] = { ...v, ...((g as any)?.[k] || {}) };
  return out as Guidelines;
}

type Field =
  | { key: string; label: string; type: "bool"; hint?: string }
  | { key: string; label: string; type: "number"; min: number; max: number; hint?: string }
  | { key: string; label: string; type: "time" }
  | { key: string; label: string; type: "text" };

export const GUIDELINE_SECTIONS: { id: keyof Guidelines; title: string; toggle?: string; fields: Field[] }[] = [
  {
    id: "chat", title: "שיחות", toggle: "enabled",
    fields: [
      { key: "classGroups", label: "קבוצות כיתה ומקצוע אוטומטיות", type: "bool" },
      { key: "studentTeacherMessaging", label: "תלמידים יכולים לפנות למורים בפרטי", type: "bool" },
      { key: "parentTeacherMessaging", label: "הורים יכולים לפנות למורים בפרטי", type: "bool" },
      { key: "limitHours", label: "הגבלת שעות התכתבות", type: "bool" },
      { key: "allowedFrom", label: "מותר מ־", type: "time" },
      { key: "allowedUntil", label: "מותר עד", type: "time" },
    ],
  },
  {
    id: "exams", title: "תקני מבחנים",
    fields: [
      { key: "maxPerWeek", label: "מקסימום מבחנים בשבוע לשכבה", type: "number", min: 0, max: 10 },
      { key: "maxPerDay", label: "מקסימום מבחנים ביום", type: "number", min: 0, max: 4 },
      { key: "minNoticeDays", label: "הודעה מראש (ימים)", type: "number", min: 0, max: 60 },
    ],
  },
  {
    id: "assignments", title: "עבודות ושיעורי בית",
    fields: [
      { key: "maxHomeworkPerDay", label: "מקסימום הגשות לאותו יום", type: "number", min: 0, max: 10 },
      { key: "maxWeeklyHours", label: "שעות שיעורי בית בשבוע (המלצה)", type: "number", min: 0, max: 40 },
      { key: "allowLate", label: "מותר להגיש באיחור (לפי שיקול המורה)", type: "bool" },
    ],
  },
  {
    id: "forums", title: "פורומים וקהילה", toggle: "enabled",
    fields: [
      { key: "studentPosts", label: "תלמידים יכולים לפרסם", type: "bool" },
      { key: "preModeration", label: "פרסום רק אחרי אישור צוות", type: "bool" },
    ],
  },
  {
    id: "council", title: "מועצת תלמידים", toggle: "enabled",
    fields: [
      { key: "seatsPerGrade", label: "נציגים לכל שכבה", type: "number", min: 1, max: 10 },
      { key: "termMonths", label: "אורך כהונה (חודשים)", type: "number", min: 1, max: 36 },
    ],
  },
  {
    id: "elections", title: "בחירות", toggle: "enabled",
    fields: [
      { key: "month", label: "חודש הבחירות", type: "text" },
      { key: "anonymousVoting", label: "הצבעה חשאית", type: "bool" },
    ],
  },
  {
    id: "newspaper", title: "עיתון בית הספר", toggle: "enabled",
    fields: [
      { key: "studentWriters", label: "תלמידים כותבים כתבות", type: "bool" },
      { key: "editorApproval", label: "פרסום רק אחרי אישור העורכ/ת", type: "bool" },
    ],
  },
  {
    id: "games", title: "משחקים ופעילויות", toggle: "enabled",
    fields: [{ key: "bellVote", label: "הצבעה על שיר הצלצול", type: "bool" }],
  },
];

/** Dashboard pages a disabled feature hides (sidebar, bottom nav and route guard). */
export function disabledPages(g: Guidelines | null): Set<string> {
  const out = new Set<string>();
  if (!g) return out;
  if (!g.chat.enabled) out.add("chat");
  if (!g.forums.enabled) out.add("community");
  if (!g.council.enabled) out.add("council");
  if (!g.newspaper.enabled) out.add("newspaper");
  // games.bellVote now only hides bell-song polls inside the polls page.
  return out;
}

/** Roles the system knows; the principal picks which the school uses. */
export const BUILTIN_ROLES: { value: string; label: string; hint: string }[] = [
  { value: "council_advisor", label: "אחראית מועצה", hint: "מועצת תלמידים ובחירות" },
  { value: "grade_coordinator", label: "רכזת שכבה", hint: "מעקב שכבה, הודעות, תגבורים" },
  { value: "subject_coordinator", label: "רכזת מקצוע", hint: "שיבוץ מורים וסילבוס" },
  { value: "exam_coordinator", label: "רכזת בגרויות ומבחנים", hint: "לוח המבחנים" },
  { value: "secretary", label: "מזכירות", hint: "אישורי הרשמה ופניות" },
  { value: "counselor", label: "יועצת", hint: "מרחב ייעוץ ותיקים" },
  { value: "high_school_principal", label: "מנהלת חטיבה עליונה", hint: "ניהול שכבות י–יב" },
  { value: "middle_school_principal", label: "מנהלת חטיבת ביניים", hint: "ניהול שכבות ז–ט" },
];

/** Areas a custom role can open. Each maps to a built-in permission set. */
export const ROLE_AREAS: { value: string; label: string }[] = [
  { value: "council", label: "מועצת תלמידים ובחירות" },
  { value: "exams", label: "לוח מבחנים" },
  { value: "office", label: "מזכירות ואישורים" },
  { value: "counseling", label: "ייעוץ" },
  { value: "management", label: "ניהול בית הספר (מלא)" },
];

/** Every subject that has a sticker, grouped as in the sticker catalog. */
export const SUBJECT_CATALOG: { group: string; names: string[] }[] = STICKER_GROUPS.map(([group, items]) => ({
  group,
  names: items.map(([, name]) => name),
}));

export function scopeGrades(scope: SubjectScope, picked: string[], schoolGrades: string[]): string[] {
  if (scope === "school") return schoolGrades;
  if (scope === "middle") return schoolGrades.filter((g) => MIDDLE_GRADES.includes(g));
  if (scope === "high") return schoolGrades.filter((g) => HIGH_GRADES.includes(g));
  return picked.filter((g) => schoolGrades.includes(g));
}

export const SCOPE_LABELS: Record<SubjectScope, string> = {
  school: "כלל בית ספרי",
  middle: "חט״ב (ז–ט)",
  high: "חט״ע (י–יב)",
  grades: "שכבות מסוימות",
};

export function newSubject(name: string, custom = false): SubjectDraft {
  return { name, sticker: custom ? null : name, logoMode: "catalog", custom, scope: "school", grades: [], kind: "regular" };
}

export interface ApplicationPayload {
  school: { name: string; city: string; institutionCode: string; grades: string[]; classesPerGrade: Record<string, number> };
  subjects: SubjectDraft[];
  rooms: RoomDraft[];
  teachers: TeacherDraft[];
  constraints: { text: string }[];
  roles: { builtin: string[]; custom: CustomRoleDraft[] };
  guidelines: Guidelines;
  imports: { id: string; kind: string; name: string }[];
}

export const EMPTY_APPLICATION: ApplicationPayload = {
  school: { name: "", city: "", institutionCode: "", grades: [...ALL_GRADES], classesPerGrade: Object.fromEntries(ALL_GRADES.map((g) => [g, 3])) },
  subjects: [],
  rooms: [],
  teachers: [],
  constraints: [],
  roles: { builtin: ["council_advisor", "grade_coordinator", "subject_coordinator", "secretary", "counselor"], custom: [] },
  guidelines: DEFAULT_GUIDELINES,
  imports: [],
};
