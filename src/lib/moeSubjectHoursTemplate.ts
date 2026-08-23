import type { GradeLevel } from "@/lib/constants";

/**
 * Starter estimate for weekly teaching hours per mandatory subject, by grade,
 * for a general state Jewish school (ממ"ד כללי, חילוני).
 *
 * חטיבת ביניים (ז'-ט'): grounded in the one binding circular that exists -
 * חוזר מנכ"ל תשס"ט/8(א), סעיף 3.1-36, "תוכנית היסוד (הליבה) לחטיבות הביניים
 * בחינוך העל-יסודי" (פורסם 1.4.2009, עדכון פרסום באתר משרד החינוך
 * 8.11.2022, בתוקף) - 107 מחייבות שעות שבועיות על פני שלוש שנים לממ"ד עברי,
 * כפי שמאושר גם על ידי מרכז המחקר והמידע של הכנסת (אסף וינינגר, 18.9.2022).
 * Per-grade weekly numbers below (שפת אם/מתמטיקה/מדע וטכנולוגיה/אנגלית/
 * תרבות יהודית-ישראלית/חינוך גופני) are taken directly from that circular's
 * per-grade breakdown; summed over ז-ט they reproduce the circular's own
 * subject totals exactly (מתמטיקה 13, מדע וטכנולוגיה 14, אנגלית 12, שפת אם 8,
 * חינוך גופני 6, תרבות יהודית-ישראלית 3) - a strong internal-consistency check.
 *
 * The "רוח וחברה" cluster (תנ"ך/היסטוריה/ספרות/גיאוגרפיה) is explicitly
 * NOT fixed per grade in the circular - it's a three-year minimum of ≥6
 * weekly hours per subject that schools may redistribute across ז-ט however
 * they choose (the circular's own "מרחב גמישות" clause, expanded further
 * since the covid years to ~30% flexibility + up to 25% cross-cluster
 * transfer, per the same Knesset research note). 2/week each here is that
 * minimum spread evenly (6÷3), matching what the source notes many schools
 * actually do in practice - not a fixed per-year requirement.
 *
 * חטיבה עליונה (י'-יב'): there is NO equivalent binding circular - the 2009
 * circular's high-school companion was cancelled and never replaced (per the
 * same Knesset research note), so hours here are actual school practice
 * derived from matriculation (יח"ל) requirements, not a national norm. Track
 * hours (מגמות) are intentionally excluded - configure those separately as
 * grade-wide track blocks, they vary too much per school to seed responsibly.
 *
 * None of this is a substitute for the school's actual, approved program -
 * it exists only to pre-fill subject_requirements as an editable starting
 * point; a principal's review/approval is still required before generating.
 *
 * gradeWide: מתמטיקה/אנגלית default to true because cross-class ability
 * grouping (הקבצות) for these two subjects specifically is extremely common
 * practice - not something either circular mandates, just a sensible default
 * a school can turn off per subject in the "תכנית שעות" tab.
 */
export interface MoeHoursTemplateEntry {
  grade: GradeLevel;
  subject: string;
  weekly_hours: number;
  gradeWide?: boolean;
}

export const MOE_SUBJECT_HOURS_TEMPLATE: MoeHoursTemplateEntry[] = [
  // ז' - חוזר מנכ"ל 3.1-36, טבלת כיתה ז'
  { grade: "ז", subject: "עברית", weekly_hours: 3 },
  { grade: "ז", subject: "מתמטיקה", weekly_hours: 4, gradeWide: true },
  { grade: "ז", subject: "מדעים", weekly_hours: 4 },
  { grade: "ז", subject: "אנגלית", weekly_hours: 4, gradeWide: true },
  { grade: "ז", subject: "תרבות יהודית-ישראלית", weekly_hours: 1 },
  { grade: "ז", subject: "חינוך גופני", weekly_hours: 2 },
  { grade: "ז", subject: "ערבית", weekly_hours: 3 },
  { grade: "ז", subject: "תנ\"ך", weekly_hours: 2 },
  { grade: "ז", subject: "היסטוריה", weekly_hours: 2 },
  { grade: "ז", subject: "ספרות", weekly_hours: 2 },
  { grade: "ז", subject: "גיאוגרפיה", weekly_hours: 2 },

  // ח' - חוזר מנכ"ל 3.1-36, טבלת כיתה ח'
  { grade: "ח", subject: "עברית", weekly_hours: 3 },
  { grade: "ח", subject: "מתמטיקה", weekly_hours: 5, gradeWide: true },
  { grade: "ח", subject: "מדעים", weekly_hours: 5 },
  { grade: "ח", subject: "אנגלית", weekly_hours: 4, gradeWide: true },
  { grade: "ח", subject: "תרבות יהודית-ישראלית", weekly_hours: 2 },
  { grade: "ח", subject: "חינוך גופני", weekly_hours: 2 },
  { grade: "ח", subject: "ערבית", weekly_hours: 3 },
  { grade: "ח", subject: "תנ\"ך", weekly_hours: 2 },
  { grade: "ח", subject: "היסטוריה", weekly_hours: 2 },
  { grade: "ח", subject: "ספרות", weekly_hours: 2 },
  { grade: "ח", subject: "גיאוגרפיה", weekly_hours: 2 },

  // ט' - חוזר מנכ"ל 3.1-36, טבלת כיתה ט' (אזרחות מחליפה כאן את תרבות יהודית-ישראלית)
  { grade: "ט", subject: "עברית", weekly_hours: 2 },
  { grade: "ט", subject: "מתמטיקה", weekly_hours: 4, gradeWide: true },
  { grade: "ט", subject: "מדעים", weekly_hours: 5 },
  { grade: "ט", subject: "אנגלית", weekly_hours: 4, gradeWide: true },
  { grade: "ט", subject: "אזרחות", weekly_hours: 2 },
  { grade: "ט", subject: "חינוך גופני", weekly_hours: 2 },
  { grade: "ט", subject: "ערבית", weekly_hours: 3 },
  { grade: "ט", subject: "תנ\"ך", weekly_hours: 2 },
  { grade: "ט", subject: "היסטוריה", weekly_hours: 2 },
  { grade: "ט", subject: "ספרות", weekly_hours: 2 },
  { grade: "ט", subject: "גיאוגרפיה", weekly_hours: 2 },

  // י' - אומדן נהוג (אין חוזר מחייב), נגזר מדרישות בגרות
  { grade: "י", subject: "עברית", weekly_hours: 2 },
  { grade: "י", subject: "מתמטיקה", weekly_hours: 5, gradeWide: true },
  { grade: "י", subject: "אנגלית", weekly_hours: 5, gradeWide: true },
  { grade: "י", subject: "תנ\"ך", weekly_hours: 2 },
  { grade: "י", subject: "היסטוריה", weekly_hours: 2 },
  { grade: "י", subject: "ספרות", weekly_hours: 2 },
  { grade: "י", subject: "אזרחות", weekly_hours: 2 },
  { grade: "י", subject: "מדעים", weekly_hours: 2 },
  { grade: "י", subject: "חינוך גופני", weekly_hours: 2 },

  // יא' - אומדן נהוג (אין חוזר מחייב), נגזר מדרישות בגרות
  { grade: "יא", subject: "עברית", weekly_hours: 2 },
  { grade: "יא", subject: "מתמטיקה", weekly_hours: 5, gradeWide: true },
  { grade: "יא", subject: "אנגלית", weekly_hours: 5, gradeWide: true },
  { grade: "יא", subject: "תנ\"ך", weekly_hours: 2 },
  { grade: "יא", subject: "היסטוריה", weekly_hours: 2 },
  { grade: "יא", subject: "ספרות", weekly_hours: 2 },
  { grade: "יא", subject: "אזרחות", weekly_hours: 2 },
  { grade: "יא", subject: "חינוך גופני", weekly_hours: 2 },

  // יב' - אומדן נהוג (אין חוזר מחייב); תנ"ך/ספרות/היסטוריה לרוב כבר הושלמו בשנים קודמות
  { grade: "יב", subject: "עברית", weekly_hours: 2 },
  { grade: "יב", subject: "מתמטיקה", weekly_hours: 5, gradeWide: true },
  { grade: "יב", subject: "אנגלית", weekly_hours: 5, gradeWide: true },
  { grade: "יב", subject: "אזרחות", weekly_hours: 2 },
  { grade: "יב", subject: "חינוך גופני", weekly_hours: 2 },
];
