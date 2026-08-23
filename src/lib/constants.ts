export const SCHOOLS = [
  "תיכון חדש תל אביב",
  "תיכון בן צבי קריית אונו",
  "בית ספר אהבת ציון",
  'תיכון ליד"ה ירושלים',
] as const;

export const GRADES = ["ז", "ח", "ט", "י", "יא", "יב"] as const;

export const EMAIL_SUFFIXES = [
  "gmail.com",
  "outlook.com",
  "taded.org.il",
  "demo.il",
] as const;

export const STAFF_ROLES = [
  { value: "educator", label: "מחנך/ת", requiresClass: true, requiresGrade: false, requiresSubject: false, approvedBy: "grade_coordinator" },
  { value: "professional_teacher", label: "מורה מקצועי/ת", requiresClass: false, requiresGrade: false, requiresSubject: true, approvedBy: "management" },
  { value: "subject_coordinator", label: "רכז/ת מקצוע", requiresClass: false, requiresGrade: false, requiresSubject: true, approvedBy: "management" },
  { value: "grade_coordinator", label: "רכז/ת שכבה", requiresClass: false, requiresGrade: true, requiresSubject: false, approvedBy: "management" },
  { value: "counselor", label: "יועץ/ת", requiresClass: false, requiresGrade: true, requiresSubject: false, approvedBy: "management" },
  { value: "management", label: "הנהלה", requiresClass: false, requiresGrade: false, requiresSubject: false, approvedBy: "system_admin" },
] as const;

export const SUBJECTS = [
  "מתמטיקה", "אנגלית", "עברית", "ספרות", "היסטוריה", "אזרחות",
  "תנ\"ך", "ערבית", "מדעים", "פיזיקה", "כימיה", "ביולוגיה", "מדעי המחשב",
  "אמנות", "מוזיקה", "חינוך גופני", "טכנולוגיה", "גיאוגרפיה",
  "סוציולוגיה", "אדריכלות", "תקשורת", "צרפתית", "אקואטיקה",
  "תרבות יהודית-ישראלית",
] as const;

export const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;

export type GradeLevel = typeof GRADES[number];
export type StaffRoleValue = typeof STAFF_ROLES[number]["value"];
