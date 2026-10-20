// Prepares a full timetable setup for the demo school ("בית ספר הדגמה"), so
// the timetable builder can generate a realistic schedule with detailed
// constraints. Run seed-demo-school.mjs first.
//
// Usage (from the repo root):
//   node scripts/seed-demo-timetable.mjs
//
// Sets: school days (Sun-Fri), the bell schedule, rooms, the hours plan per
// grade (incl. grade-wide ability groups and a track block), placeholder
// teacher counts, school rules (short Friday, PE not first, morning subjects)
// and teacher constraints. It also clears the demo school's existing
// timetable so the next generation starts from an empty week.
// Safe to re-run.

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const SCHOOL_NAME = "בית ספר הדגמה";

function readDotEnvLocal() {
  if (!existsSync(".env.local")) return {};
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
}

const dotEnv = readDotEnvLocal();
const SUPABASE_URL = process.env.SUPABASE_URL || dotEnv.SUPABASE_URL || dotEnv.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || dotEnv.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function q(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

// ---------- the school's setup ----------

// Sunday-Thursday full days, Friday short (see RULES.shortDays).
const DAYS = [0, 1, 2, 3, 4, 5];

const BELLS = [
  { lesson_number: 1, label: "שיעור 1", start_time: "08:00", end_time: "08:45" },
  { lesson_number: 2, label: "שיעור 2", start_time: "08:45", end_time: "09:30" },
  { lesson_number: 3, label: "הפסקה", start_time: "09:30", end_time: "09:50", is_break: true, break_duration_minutes: 20 },
  { lesson_number: 4, label: "שיעור 3", start_time: "09:50", end_time: "10:35" },
  { lesson_number: 5, label: "שיעור 4", start_time: "10:35", end_time: "11:20" },
  { lesson_number: 6, label: "הפסקה", start_time: "11:20", end_time: "11:35", is_break: true, break_duration_minutes: 15 },
  { lesson_number: 7, label: "שיעור 5", start_time: "11:35", end_time: "12:20" },
  { lesson_number: 8, label: "שיעור 6", start_time: "12:20", end_time: "13:05" },
  { lesson_number: 9, label: "הפסקה", start_time: "13:05", end_time: "13:20", is_break: true, break_duration_minutes: 15 },
  { lesson_number: 10, label: "שיעור 7", start_time: "13:20", end_time: "14:05" },
  { lesson_number: 11, label: "שיעור 8", start_time: "14:05", end_time: "14:50" },
];

const ROOMS = [
  { name: "כיתה ז-1", room_type: "כיתה", capacity: 1 },
  { name: "כיתה י-1", room_type: "כיתה", capacity: 1 },
  { name: "כיתה י-2", room_type: "כיתה", capacity: 1 },
  { name: "חדר הקבצה", room_type: "כיתה", capacity: 1 },
  { name: "אולם ספורט", room_type: "אולם ספורט", capacity: 2 },
  { name: "מעבדת פיזיקה", room_type: "מעבדה", capacity: 1 },
  { name: "מעבדת ביולוגיה", room_type: "מעבדה", capacity: 1 },
  { name: "מעבדת מחשבים", room_type: "מעבדת מחשבים", capacity: 1 },
  { name: "חדר אמנות", room_type: "חדר אמנות", capacity: 1 },
];

const req = (grade, subject, weekly_hours, opts = {}) => ({
  grade, subject, weekly_hours,
  block_size: opts.block ?? 1,
  group_count: 1,
  preferred_room_type: opts.room ?? null,
  is_grade_wide: !!opts.gradeWide,
  track_group: opts.track ?? null,
  track_kind: opts.track ? "megama" : null,
  base_subject: null,
  group_label: null,
});

// Hours plan (per week). ז: middle school; י: high school with ability groups
// in math and English (whole grade at the same time) and a track block.
const HOURS = [
  req("ז", "מתמטיקה", 5),
  req("ז", "אנגלית", 4),
  req("ז", "לשון", 4),
  req("ז", "ספרות", 2),
  req("ז", "תנ״ך", 3),
  req("ז", "היסטוריה", 2),
  req("ז", "גאוגרפיה", 2),
  req("ז", "מדעים", 4, { block: 2, room: "מעבדה" }),
  req("ז", "ערבית", 3),
  req("ז", "חינוך גופני", 2, { room: "אולם ספורט" }),
  req("ז", "אמנות", 2, { block: 2, room: "חדר אמנות" }),
  req("ז", "מדעי המחשב", 2, { block: 2, room: "מעבדת מחשבים" }),
  req("ז", "שעת חינוך", 1),

  req("י", "מתמטיקה", 5, { gradeWide: true }),
  req("י", "אנגלית", 5, { gradeWide: true }),
  req("י", "לשון", 3),
  req("י", "ספרות", 2),
  req("י", "תנ״ך", 2),
  req("י", "היסטוריה", 2),
  req("י", "אזרחות", 2),
  req("י", "חינוך גופני", 2, { room: "אולם ספורט" }),
  req("י", "שעת חינוך", 1),
  req("י", "פיזיקה", 4, { block: 2, room: "מעבדה", track: "מגמות" }),
  req("י", "ביולוגיה", 4, { block: 2, room: "מעבדה", track: "מגמות" }),
  req("י", "מדעי המחשב", 4, { block: 2, room: "מעבדת מחשבים", track: "מגמות" }),
];

// How many teachers each subject has (the builder needs every subject). Where
// the demo school has fewer real teachers, the rest are placeholders
// ("לשיבוץ"). Math and English need two: grade י learns them in ability groups,
// both classes at once.
const TEACHER_COUNTS = {
  "מתמטיקה": 2, "אנגלית": 2,
  "לשון": 1, "ספרות": 1, "תנ״ך": 1, "היסטוריה": 1, "גאוגרפיה": 1, "אזרחות": 1,
  "מדעים": 1, "ערבית": 1, "חינוך גופני": 1, "אמנות": 1, "מדעי המחשב": 1,
  "פיזיקה": 1, "ביולוגיה": 1, "שעת חינוך": 1,
};

const RULES = {
  shortDays: { "5": 7 },                                  // Friday ends after lesson 5 (lesson_number 7)
  subjectEarliest: { "חינוך גופני": 2 },                  // no PE in the first lesson
  subjectLatest: { "מדעים": 8, "פיזיקה": 8, "ביולוגיה": 8 }, // labs end by lesson 6 (lesson_number 8)
  morningSubjects: ["מתמטיקה", "אנגלית"],
};

// ---------- run ----------

const school = await q(db.from("schools").select("id").eq("name", SCHOOL_NAME).maybeSingle(), "find school");
if (!school) {
  console.error(`"${SCHOOL_NAME}" not found - run: npm run seed:demo`);
  process.exit(1);
}
const schoolId = school.id;

const users = await q(
  db.from("profiles").select("id, email").eq("school_id", schoolId).like("email", "demo.%"),
  "demo users",
);
const id = (key) => users.find((u) => u.email === `demo.${key}@demo.il`)?.id;
const principal = id("principal");

// School days, approved hours plan, rules.
await q(db.from("school_timetable_settings").upsert({
  school_id: schoolId,
  days_of_week: DAYS,
  hours_template_approved: true,
  hours_template_approved_by: principal,
  hours_template_approved_at: new Date().toISOString(),
  rules: RULES,
  updated_at: new Date().toISOString(),
}, { onConflict: "school_id" }), "timetable settings");

// Bell schedule.
await q(db.from("bell_schedule").delete().eq("school_id", schoolId), "clear bells");
await q(db.from("bell_schedule").insert(BELLS.map((b) => ({
  school_id: schoolId, is_break: false, break_duration_minutes: 0, ...b,
}))), "bells");

// Rooms.
await q(db.from("rooms").delete().eq("school_id", schoolId), "clear rooms");
await q(db.from("rooms").insert(ROOMS.map((r) => ({ school_id: schoolId, ...r }))), "rooms");

// Hours plan (grade defaults, class_id null).
await q(db.from("subject_requirements").delete().eq("school_id", schoolId), "clear hours");
await q(db.from("subject_requirements").insert(HOURS.map((h) => ({ school_id: schoolId, class_id: null, ...h }))), "hours");

await q(db.from("subject_teacher_counts").delete().eq("school_id", schoolId), "clear teacher counts");
await q(db.from("subject_teacher_counts").insert(
  Object.entries(TEACHER_COUNTS).map(([subject, teacher_count]) => ({ school_id: schoolId, subject, teacher_count })),
), "teacher counts");

// Teacher constraints (approved, hard).
const constraint = (teacherKey, type, extra = {}) => ({
  school_id: schoolId,
  teacher_id: id(teacherKey),
  constraint_type: type,
  is_hard: true,
  status: "approved",
  created_by: principal,
  approved_by: principal,
  approved_at: new Date().toISOString(),
  ...extra,
});
await q(db.from("teacher_constraints").delete().eq("school_id", schoolId), "clear constraints");
await q(db.from("teacher_constraints").insert([
  constraint("teacher", "max_daily_hours", { max_value: 4, note: "עד 4 שיעורים ביום" }),
  constraint("educator", "no_edge_lesson", { note: "לא בשיעור הראשון ולא באחרון" }),
  constraint("subject-coordinator", "unavailable_slot", { day_of_week: 2, lesson_number: 1, note: "יום שלישי בבוקר - השתלמות" }),
  constraint("subject-coordinator", "unavailable_slot", { day_of_week: 2, lesson_number: 2, note: "יום שלישי בבוקר - השתלמות" }),
  constraint("grade-coordinator", "staff_meeting", { day_of_week: 1, lesson_number: 10, note: "ישיבת רכזים" }),
].filter((c) => c.teacher_id)), "constraints");

// Start the week empty: existing slots would otherwise be kept as locked.
await q(db.from("timetable_slots").delete().eq("school_id", schoolId), "clear timetable");

const hours = (g) => HOURS.filter((h) => h.grade === g && (!h.track_group || h.subject === "פיזיקה")).reduce((n, h) => n + h.weekly_hours, 0);
console.log(`Demo timetable setup ready for "${SCHOOL_NAME}".`);
console.log(`  ${DAYS.length} school days, ${BELLS.filter((b) => !b.is_break).length} lessons a day, Friday until lesson 5`);
console.log(`  hours: ז ${hours("ז")} / י ${hours("י")} a week, ${ROOMS.length} rooms, 5 teacher constraints`);
console.log("Next: open the timetable builder as the principal and press build.");
