// Seeds "DeFounder", a full-size mock school: 6 grades (ז–יב, one class each),
// 50 students, 25 staff, 6 parents. Every user gets a hand-matched avatar, and
// the school gets a month of activity: a bell schedule with breaks, a timetable
// with math/English study groups in י–יב, lessons and attendance for the last
// 20 school days, assignments built from a real question bank (with answered
// submissions), interactive code tasks, a student newspaper, last year's
// council plus this year's election tournament, events and seating plans.
// The written content lives in defounder-content.mjs.
//
// Usage (from the repo root):
//   npm run seed:defounder          # create or refresh the school
//   npm run seed:defounder:reset    # delete everything it created
//
// Needs SUPABASE_SERVICE_ROLE_KEY, either as an env var or as a line in .env.local.
// The URL is read from SUPABASE_URL or VITE_SUPABASE_URL in .env.local.
// The password for all users comes from DEMO_PASSWORD, or is generated once and
// written to defounder-school.credentials.local.json (git-ignored) with the emails.
// Safe to re-run: users are reused by email and activity data is replaced.
// Everything random is seeded, so every run produces the same school.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  ARTICLES, CAMPAIGN_STATEMENTS, INTERACTIVE_TASKS, LAST_YEAR, QUESTION_BANK, wrongAnswerFor,
} from "./defounder-content.mjs";

const SCHOOL_NAME = "DeFounder";
const EMAIL_PREFIX = "defounder.";
// demo.il is on the allowed_email_domains list (migration 20260810060000).
const EMAIL_DOMAIN = "demo.il";
const CREDENTIALS_FILE = "defounder-school.credentials.local.json";

// ---------- env ----------

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
// Not VITE_-prefixed, so Vite never exposes it to the browser bundle.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || dotEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("The service role key is in Supabase → Project Settings → API.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RESET = process.argv.includes("--reset");

// ---------- helpers ----------

async function q(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

// Inserts in chunks so a month of attendance doesn't hit the request size limit.
async function insertMany(table, rows, what, select) {
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    let query = db.from(table).insert(rows.slice(i, i + 500));
    if (select) query = query.select(select);
    const data = await q(query, what);
    if (select) out.push(...data);
  }
  return out;
}

// Deterministic PRNG (mulberry32), so re-runs give the same avatars and grades.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// Valid Israeli ID (Luhn-style check digit) from an 8-digit base.
function israeliId(base8) {
  const digits = String(base8).padStart(8, "0").split("").map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    let v = d * (i % 2 === 0 ? 1 : 2);
    if (v > 9) v -= 9;
    sum += v;
  });
  return digits.join("") + String((10 - (sum % 10)) % 10);
}

const email = (key) => `${EMAIL_PREFIX}${key}@${EMAIL_DOMAIN}`;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// The last `count` school days (Sunday–Thursday) before today.
function recentSchoolDays(count) {
  const days = [];
  const d = new Date();
  while (days.length < count) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() <= 4) days.push(new Date(d));
  }
  return days.reverse();
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function loadOrCreatePassword() {
  if (process.env.DEMO_PASSWORD) return process.env.DEMO_PASSWORD;
  if (existsSync(CREDENTIALS_FILE)) return JSON.parse(readFileSync(CREDENTIALS_FILE, "utf8")).password;
  return "Defounder-" + randomBytes(6).toString("base64url");
}

// ---------- avatars ----------
// Values are the ones the avatar editor offers (src/components/avatar/AvatarStudio.tsx).

const SKINS = ["#FEECD2", "#FDDBB4", "#F5C5A3", "#EEB98A", "#E0AC69", "#D4915A", "#C68642", "#A0622A", "#8D5524", "#6B3A1F"];
const HAIR = {
  black: "#0D0D0D", darkBrown: "#2C1A0E", brown: "#5C3317", midBrown: "#8B4513", auburn: "#A0522D",
  ginger: "#C0392B", lightGinger: "#E8603C", darkBlond: "#B8860B", blond: "#D4A017", lightBlond: "#F0C040",
  gray: "#808080", lightGray: "#B0B0B0",
};
const OUTFIT_COLORS = ["#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#A855F7", "#1F2937"];
// Each outfit colour gets backgrounds that contrast with it rather than echo it.
const BACKGROUNDS_FOR = {
  "#3B82F6": ["#FEF3C7", "#FCE7F3", "#DCFCE7"],
  "#EF4444": ["#E0F2FE", "#E0F7FA", "#E8EDF7"],
  "#22C55E": ["#EDE9FE", "#FCE7F3", "#FEF3C7"],
  "#F59E0B": ["#E0F2FE", "#EDE9FE", "#E8EDF7"],
  "#A855F7": ["#DCFCE7", "#FEF3C7", "#E0F7FA"],
  "#1F2937": ["#FEF3C7", "#E0F2FE", "#FCE7F3", "#DCFCE7"],
};

// Hair colour that fits the skin tone: darker skin → dark hair; lighter skin
// can also be blond or ginger (and that's when freckles show up).
function hairColorFor(r, skinIdx) {
  if (skinIdx >= 6) return pick(r, [HAIR.black, HAIR.black, HAIR.darkBrown]);
  if (skinIdx >= 4) return pick(r, [HAIR.black, HAIR.darkBrown, HAIR.brown, HAIR.midBrown]);
  return pick(r, [HAIR.darkBrown, HAIR.brown, HAIR.midBrown, HAIR.auburn, HAIR.darkBlond, HAIR.blond, HAIR.lightBlond, HAIR.ginger, HAIR.lightGinger]);
}

/**
 * A curated avatar for one person. `g` is "m"/"f", `adult` switches to
 * staff/parent clothes, facial hair and the occasional grey.
 * `extra` overrides fields (e.g. a kippah or glasses chosen per person).
 */
function makeAvatar(key, g, adult, extra = {}) {
  const r = rng(hash(key));
  const skinIdx = Math.floor(r() * SKINS.length);
  let hairColor = hairColorFor(r, skinIdx);
  if (adult && r() < 0.18) hairColor = pick(r, [HAIR.gray, HAIR.lightGray]);
  const light = hairColor === HAIR.ginger || hairColor === HAIR.lightGinger || hairColor === HAIR.lightBlond;

  const hair = g === "m"
    ? pick(r, adult ? ["boy", "boy", "curly", "boy"] : ["boy", "curly", "mullet", "boy", "curly"])
    : pick(r, adult ? ["girl_long", "bun", "short_girl", "curly_long", "bun"] : ["girl_long", "ponytail", "curly_long", "bun", "short_girl", "ponytail"]);

  const outfit = adult
    ? pick(r, g === "m" ? ["formal", "polo", "sweater", "jacket", "plaid"] : ["formal", "sweater", "jacket", "dress", "polo"])
    : pick(r, g === "m" ? ["hoodie", "tshirt", "sport", "hoodie", "plaid", "polo"] : ["hoodie", "tshirt", "sweater", "dress", "hoodie", "sport"]);
  const outfitColor = pick(r, OUTFIT_COLORS);

  return {
    face_shape: "basic",
    eye_shape: "round",
    skin_color: SKINS[skinIdx],
    eye_color: light ? pick(r, ["blue", "green", "brown"]) : pick(r, ["brown", "brown", "brown", "green", "blue"]),
    hair_style: hair,
    hair_color: hairColor,
    facial_hair: adult && g === "m" ? pick(r, ["none", "none", "beard", "mustache", "goatee"]) : "none",
    outfit,
    outfit_color: outfitColor,
    accessory: r() < (adult ? 0.3 : 0.15) ? "glasses" : "none",
    expression: pick(r, ["happy", "happy", "excited", "calm", "cool", "focused"]),
    background: pick(r, BACKGROUNDS_FOR[outfitColor]),
    freckles: light && r() < 0.6 ? pick(r, ["light", "many"]) : "none",
    ...extra,
  };
}

// ---------- the school ----------

const GRADES = ["ז", "ח", "ט", "י", "יא", "יב"];
const CLASSES = GRADES.map((g) => `${g}-1`);
const MIDDLE = ["ז-1", "ח-1", "ט-1"];
const HIGH = ["י-1", "יא-1", "יב-1"];

// Weekly hours per class (6 lessons × Sunday–Thursday = 30).
const CURRICULUM = {
  middle: { "מתמטיקה": 5, "אנגלית": 4, "לשון": 3, "תנ\"ך": 3, "מדעים": 4, "היסטוריה": 3, "ספרות": 2, "חינוך גופני": 2, "גאוגרפיה": 2, "חינוך": 2 },
  high: { "מתמטיקה": 5, "אנגלית": 4, "לשון": 3, "תנ\"ך": 3, "ביולוגיה": 2, "פיזיקה": 2, "היסטוריה": 3, "ספרות": 2, "חינוך גופני": 2, "אזרחות": 2, "חינוך": 2 },
};
const curriculumOf = (cls) => (MIDDLE.includes(cls) ? CURRICULUM.middle : CURRICULUM.high);

const SUBJECT_COLORS = {
  "מתמטיקה": "#DBEAFE", "אנגלית": "#FCE7F3", "לשון": "#FEF3C7", "תנ\"ך": "#EDE9FE", "מדעים": "#DCFCE7",
  "ביולוגיה": "#DCFCE7", "פיזיקה": "#E0F7FA", "היסטוריה": "#FFEDD5", "ספרות": "#FAE8FF", "חינוך גופני": "#D1FAE5",
  "גאוגרפיה": "#ECFCCB", "אזרחות": "#E0E7FF", "חינוך": "#F1F5F9",
};

// `teaches` maps a subject to the classes this person teaches it in; `homeroom`
// marks the educator's class (they also teach חינוך there). `look` overrides avatar fields.
const STAFF = [
  { key: "principal", name: "ד\"ר אורית שגיא", g: "f", roles: [{ role: "management" }], look: { accessory: "glasses", outfit: "jacket" } },
  { key: "deputy", name: "אלון ברק", g: "m", roles: [{ role: "management" }] },
  { key: "secretary", name: "ליאת חזן", g: "f", roles: [{ role: "secretary" }] },
  { key: "counselor-middle", name: "שירן אלמוג", g: "f", roles: [{ role: "counselor", grade: "ז" }] },
  { key: "counselor-high", name: "יעל רוזן", g: "f", roles: [{ role: "counselor", grade: "י" }] },
  { key: "exam-coordinator", name: "משה דוד", g: "m", roles: [{ role: "exam_coordinator" }], teaches: { "ספרות": CLASSES }, look: { accessory: "kippah" } },
  { key: "council-advisor", name: "נוי שלום", g: "f", roles: [{ role: "council_advisor" }], teaches: { "חינוך גופני": CLASSES }, look: { outfit: "sport" } },
  { key: "coordinator-middle", name: "רמי אוחנה", g: "m", roles: [{ role: "grade_coordinator", grade: "ז" }], teaches: { "היסטוריה": MIDDLE } },
  { key: "coordinator-high", name: "סיגל בן חיים", g: "f", roles: [{ role: "grade_coordinator", grade: "י" }], teaches: { "אזרחות": HIGH } },
  { key: "educator-z", name: "הדס כרמי", g: "f", homeroom: "ז-1", roles: [{ role: "educator" }], teaches: { "אנגלית": MIDDLE } },
  { key: "educator-h", name: "עידו פלד", g: "m", homeroom: "ח-1", roles: [{ role: "educator" }], teaches: { "מדעים": MIDDLE } },
  { key: "educator-t", name: "רינת גולן", g: "f", homeroom: "ט-1", roles: [{ role: "educator" }], teaches: { "לשון": MIDDLE } },
  { key: "educator-y", name: "גיל אשכנזי", g: "m", homeroom: "י-1", roles: [{ role: "educator" }], teaches: { "מתמטיקה": HIGH } },
  { key: "educator-ya", name: "מורן טל", g: "f", homeroom: "יא-1", roles: [{ role: "educator" }], teaches: { "אנגלית": HIGH } },
  { key: "educator-yb", name: "אסף נחמיאס", g: "m", homeroom: "יב-1", roles: [{ role: "educator" }], teaches: { "תנ\"ך": HIGH } },
  { key: "math-coordinator", name: "מיכל ששון", g: "f", roles: [{ role: "subject_coordinator", subject: "מתמטיקה" }], teaches: { "מתמטיקה": MIDDLE } },
  { key: "english-coordinator", name: "קרן וייס", g: "f", roles: [{ role: "subject_coordinator", subject: "אנגלית" }], teaches: { "אנגלית": HIGH } },
  { key: "math-teacher", name: "אביטל נוי", g: "f", teaches: { "מתמטיקה": HIGH } },
  { key: "science-coordinator", name: "ד\"ר אבי מנור", g: "m", roles: [{ role: "subject_coordinator", subject: "מדעים" }], teaches: { "ביולוגיה": HIGH } },
  { key: "language-coordinator", name: "תמר יוסף", g: "f", roles: [{ role: "subject_coordinator", subject: "לשון" }], teaches: { "לשון": HIGH } },
  { key: "bible-teacher", name: "יהודה פרידמן", g: "m", teaches: { "תנ\"ך": MIDDLE }, look: { accessory: "kippah", facial_hair: "beard" } },
  { key: "history-teacher", name: "נעמה אדלר", g: "f", teaches: { "היסטוריה": HIGH } },
  { key: "geography-teacher", name: "ערן שמש", g: "m", teaches: { "גאוגרפיה": MIDDLE } },
  { key: "physics-teacher", name: "רועי קפלן", g: "m", teaches: { "פיזיקה": HIGH }, look: { accessory: "glasses" } },
  { key: "art-teacher", name: "אורנה ליבנה", g: "f", roles: [], teaches: {} },
];
// Every subject someone teaches is also a professional_teacher role; educators get חינוך too.
for (const s of STAFF) {
  s.roles ??= [];
  s.teaches ??= {};
  if (s.homeroom) {
    s.roles[0].homeroom = s.homeroom;
    s.teaches["חינוך"] = [s.homeroom];
  }
  for (const subject of Object.keys(s.teaches)) {
    if (subject !== "חינוך") s.roles.push({ role: "professional_teacher", subject });
  }
}
// The art teacher teaches enrichment (not on the timetable) but should still show up as a teacher.
STAFF.find((s) => s.key === "art-teacher").roles.push({ role: "professional_teacher", subject: "אמנות" });

// Study groups (הקבצות) in י–יב: math and English split into parallel groups
// taught at the same time. group_name doubles as the student_tracks.track_name,
// which is how the timetable matches a student to their group.
const GROUPS = {
  "מתמטיקה": [["מתמטיקה 5 יח״ל", "educator-y"], ["מתמטיקה 4 יח״ל", "math-teacher"]],
  "אנגלית": [["אנגלית 5 יח״ל", "educator-ya"], ["אנגלית 4 יח״ל", "english-coordinator"]],
};
const staffByKey = (key) => STAFF.find((s) => s.key === key);

/** Who teaches `subject` in `cls`: one { teacher, group } per parallel group, or a single whole-class entry. */
function teachersFor(cls, subject) {
  if (HIGH.includes(cls) && GROUPS[subject]) return GROUPS[subject].map(([group, key]) => ({ teacher: staffByKey(key), group }));
  return [{ teacher: STAFF.find((s) => s.teaches[subject]?.includes(cls)), group: null }];
}

// 50 students: [first name, last name, gender]. A few wear a kippah or glasses (set below).
const STUDENT_NAMES = {
  "ז-1": [["נועם", "כהן", "m"], ["אגם", "לוי", "f"], ["אריאל", "מזרחי", "m"], ["הלל", "פרץ", "f"], ["יהלי", "ביטון", "f"], ["רועי", "דהן", "m"], ["ליה", "אברהם", "f"], ["איתמר", "פרידמן", "m"], ["שירה", "אזולאי", "f"]],
  "ח-1": [["עומר", "אוחיון", "m"], ["מיקה", "גבאי", "f"], ["יואב", "שפירא", "m"], ["תמר", "חדד", "f"], ["דניאל", "גולדברג", "m"], ["נוגה", "עמר", "f"], ["אלה", "ברגר", "f"], ["אורי", "סויסה", "m"], ["רוני", "קליין", "f"]],
  "ט-1": [["איתי", "וקנין", "m"], ["מאיה", "רבינוביץ", "f"], ["יונתן", "אלמליח", "m"], ["עדי", "בוזגלו", "f"], ["אליה", "שטרן", "f"], ["בן", "יוסף", "m"], ["זוהר", "סעדה", "f"], ["גיא", "נגר", "m"]],
  "י-1": [["אביגיל", "הלוי", "f"], ["אוריה", "טל", "m"], ["נטע", "אפשטיין", "f"], ["עידו", "מלכה", "m"], ["שקד", "אלון", "f"], ["אלון", "בן דוד", "m"], ["הדר", "זילברמן", "f"], ["יהב", "עזרא", "m"]],
  "יא-1": [["רון", "כץ", "m"], ["יעל", "אוחנה", "f"], ["אדם", "חזן", "m"], ["ענבר", "סלע", "f"], ["תומר", "ויס", "m"], ["אופיר", "מימון", "f"], ["שחר", "לנדאו", "m"], ["מעיין", "דוד", "f"]],
  "יב-1": [["אלעד", "ששון", "m"], ["עלמה", "נחום", "f"], ["דור", "רוזנברג", "m"], ["ליבי", "ממן", "f"], ["נדב", "אשכנזי", "m"], ["רותם", "בירנבאום", "f"], ["אסף", "יעקב", "m"], ["ים", "גרוס", "f"]],
};
const STUDENT_LOOKS = { 6: { accessory: "kippah" }, 9: { accessory: "glasses" }, 14: { accessory: "cap" }, 21: { accessory: "kippah" }, 30: { accessory: "hearing_aid" }, 41: { accessory: "kippah" } };

const STUDENTS = [];
for (const cls of CLASSES) {
  for (const [first, last, g] of STUDENT_NAMES[cls]) {
    const n = STUDENTS.length + 1;
    STUDENTS.push({ key: `student${String(n).padStart(2, "0")}`, name: `${first} ${last}`, g, cls, look: STUDENT_LOOKS[n] });
  }
}

// One parent per grade, linked to the first student of each class.
const PARENTS = [
  { key: "parent-z", name: "רחל כהן", g: "f", cls: "ז-1" },
  { key: "parent-h", name: "שלומי אוחיון", g: "m", cls: "ח-1" },
  { key: "parent-t", name: "ענת וקנין", g: "f", cls: "ט-1" },
  { key: "parent-y", name: "דוד הלוי", g: "m", cls: "י-1", look: { accessory: "kippah" } },
  { key: "parent-ya", name: "אסנת כץ", g: "f", cls: "יא-1" },
  { key: "parent-yb", name: "חיים ששון", g: "m", cls: "יב-1" },
].map((p) => ({ ...p, child: STUDENTS.find((s) => s.cls === p.cls).key }));

// Each student has a steady level, so their report card looks like one person.
const LEVEL = Object.fromEntries(STUDENTS.map((s) => [s.key, 62 + rng(hash(s.key + "level"))() * 34]));
// High-school students at 78+ are in the 5-unit groups, the rest in 4 units.
function groupOf(student, subject) {
  const groups = GROUPS[subject];
  if (!groups || !HIGH.includes(student.cls)) return null;
  return groups[LEVEL[student.key] >= 78 ? 0 : 1][0];
}

// ---------- reset ----------

async function reset() {
  const school = await q(db.from("schools").select("id").eq("name", SCHOOL_NAME).maybeSingle(), "find school");
  const ours = (await listAllUsers()).filter((u) => u.email?.startsWith(EMAIL_PREFIX) && u.email.endsWith("@" + EMAIL_DOMAIN));

  if (school) await deleteActivity(school.id);
  for (const u of ours) {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) console.warn(`  could not delete ${u.email}: ${error.message}`);
  }
  if (school) {
    await q(db.from("classes").delete().eq("school_id", school.id), "delete classes");
    await q(db.from("schools").delete().eq("id", school.id), "delete school");
  }
  console.log(`Removed ${ours.length} users${school ? ` and ${SCHOOL_NAME}` : ""}.`);
}

async function deleteActivity(schoolId) {
  const lessons = await q(db.from("lessons").select("id").eq("school_id", schoolId), "list lessons");
  for (let i = 0; i < lessons.length; i += 200) {
    await q(db.from("attendance").delete().in("lesson_id", lessons.slice(i, i + 200).map((l) => l.id)), "delete attendance");
  }
  await q(db.from("lessons").delete().eq("school_id", schoolId), "delete lessons");

  const assignments = await q(db.from("assignments").select("id").eq("school_id", schoolId), "list assignments");
  for (let i = 0; i < assignments.length; i += 200) {
    await q(db.from("submissions").delete().in("assignment_id", assignments.slice(i, i + 200).map((a) => a.id)), "delete submissions");
  }
  // task_questions, interactive_tasks and their progress cascade with the assignments.
  await q(db.from("interactive_tasks").delete().eq("school_id", schoolId), "delete interactive tasks");
  await q(db.from("assignments").delete().eq("school_id", schoolId), "delete assignments");

  // Council: later-round candidates point back at the earlier ones, so unlink first.
  const elections = await q(db.from("council_elections").select("id").eq("school_id", schoolId), "list elections");
  if (elections.length) {
    const electionIds = elections.map((e) => e.id);
    await q(db.from("council_candidates").update({ advanced_from_candidate_id: null }).in("election_id", electionIds), "unlink candidates");
    await q(db.from("council_votes").delete().in("election_id", electionIds), "delete votes");
    await q(db.from("council_candidates").delete().in("election_id", electionIds), "delete candidates");
  }
  await q(db.from("council_elections").delete().eq("school_id", schoolId), "delete elections");
  await q(db.from("council_campaigns").delete().eq("school_id", schoolId), "delete campaigns");
  await q(db.from("council_members").delete().eq("school_id", schoolId), "delete council members");
  await q(db.from("newspaper_articles").delete().eq("school_id", schoolId), "delete articles");
  await q(db.from("student_tracks").delete().eq("school_id", schoolId), "delete student tracks");

  await q(db.from("grade_events").delete().eq("school_id", schoolId), "delete grade events");
  await q(db.from("school_events").delete().eq("school_id", schoolId), "delete school events");
  await q(db.from("timetable_slots").delete().eq("school_id", schoolId), "delete timetable");
  await q(db.from("bell_schedule").delete().eq("school_id", schoolId), "delete bell schedule");
  const classes = await q(db.from("classes").select("id").eq("school_id", schoolId), "list classes");
  if (classes.length) await q(db.from("student_seats").delete().in("class_id", classes.map((c) => c.id)), "delete seats");
}

// ---------- seed ----------

async function seed() {
  const password = loadOrCreatePassword();

  let school = await q(db.from("schools").select("id").eq("name", SCHOOL_NAME).maybeSingle(), "find school");
  if (!school) school = await q(db.from("schools").insert({ name: SCHOOL_NAME }).select("id").single(), "create school");
  const schoolId = school.id;
  // Keep it out of the public registration dropdown (column from migration
  // 20261018030000; ignore the error if it hasn't been applied yet).
  await db.from("schools").update({ open_for_registration: false }).eq("id", schoolId);

  const classIds = {};
  for (const cls of CLASSES) {
    const [grade, num] = cls.split("-");
    let row = await q(
      db.from("classes").select("id").eq("school_id", schoolId).eq("grade", grade).eq("class_number", Number(num)).maybeSingle(),
      "find class",
    );
    if (!row) row = await q(db.from("classes").insert({ school_id: schoolId, grade, class_number: Number(num) }).select("id").single(), "create class");
    classIds[cls] = row.id;
  }

  // Users
  const existing = new Map((await listAllUsers()).map((u) => [u.email, u]));
  const ids = {};
  let idSeq = 41000000;
  let skipFreckles = false;

  async function upsertUser(person, profileExtra, adult) {
    const mail = email(person.key);
    let user = existing.get(mail);
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({
        email: mail,
        password,
        email_confirm: true,
        user_metadata: { full_name: person.name },
      });
      if (error) throw new Error(`create ${mail}: ${error.message}`);
      user = data.user;
    } else {
      const { error } = await db.auth.admin.updateUserById(user.id, { password });
      if (error) throw new Error(`update ${mail}: ${error.message}`);
    }
    ids[person.key] = user.id;

    await q(
      db.from("profiles").update({
        full_name: person.name,
        school_id: schoolId,
        id_number: israeliId(idSeq++),
        is_approved: true,
        ...profileExtra,
      }).eq("id", user.id),
      `profile ${mail}`,
    );

    // Avatar. A database without the freckles migration gets everything else.
    const avatar = { user_id: user.id, ...makeAvatar(person.key, person.g, adult, person.look) };
    if (skipFreckles) delete avatar.freckles;
    let { error } = await db.from("avatars").upsert(avatar, { onConflict: "user_id" });
    if (error && /freckles/i.test(error.message)) {
      skipFreckles = true;
      delete avatar.freckles;
      ({ error } = await db.from("avatars").upsert(avatar, { onConflict: "user_id" }));
    }
    if (error) throw new Error(`avatar ${mail}: ${error.message}`);

    // Roles and teaching classes are rewritten from scratch on every run.
    await q(db.from("user_roles").delete().eq("user_id", user.id), "clear roles");
    await q(db.from("teacher_classes").delete().eq("user_id", user.id), "clear teacher classes");
    await q(db.from("approvals").delete().eq("user_id", user.id), "clear approvals");
    return user.id;
  }

  async function addRoles(userId, roles, requiredRole, notes) {
    if (roles.length) {
      await q(
        db.from("user_roles").insert(
          roles.map((r) => ({
            user_id: userId,
            role: r.role,
            subject: r.subject ?? null,
            grade: r.grade ?? null,
            homeroom_class_id: r.homeroom ? classIds[r.homeroom] : null,
          })),
        ),
        "insert roles",
      );
    }
    await q(
      db.from("approvals").insert({ user_id: userId, required_role: requiredRole, status: "approved", notes }),
      "insert approval",
    );
  }

  let n = 0;
  for (const s of STAFF) {
    const userId = await upsertUser(s, { phone: `050-${String(1000000 + n++).slice(1)}` }, true);
    await addRoles(userId, s.roles, s.roles.some((r) => r.role === "management") ? "system_admin" : "management", `${SCHOOL_NAME}: ${s.name}`);
    const teaching = [...new Set(Object.values(s.teaches).flat())];
    if (teaching.length) {
      await q(
        db.from("teacher_classes").insert(teaching.map((c) => ({ user_id: userId, class_id: classIds[c], is_homeroom: c === s.homeroom }))),
        "insert teacher classes",
      );
    }
  }
  console.log(`  ${STAFF.length} staff`);

  for (const st of STUDENTS) {
    const r = rng(hash(st.key + "dob"));
    const birthYear = 2026 - 13 - GRADES.indexOf(st.cls.split("-")[0]);
    const dob = `${birthYear}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 28)).padStart(2, "0")}`;
    const userId = await upsertUser(st, { class_id: classIds[st.cls], date_of_birth: dob }, false);
    await addRoles(userId, [{ role: "student" }], "educator", `${SCHOOL_NAME}: ${st.name}`);
  }
  console.log(`  ${STUDENTS.length} students`);

  for (const p of PARENTS) {
    const userId = await upsertUser(p, { phone: `052-${String(2000000 + n++).slice(1)}` }, true);
    await addRoles(userId, [{ role: "parent" }], "educator", `${SCHOOL_NAME}: ${p.name}`);
    await q(db.from("parent_student").delete().eq("parent_id", userId), "clear parent links");
    await q(db.from("parent_student").insert({ parent_id: userId, student_id: ids[p.child] }), "link parent");
  }
  console.log(`  ${PARENTS.length} parents`);

  await deleteActivity(schoolId);
  await seedActivity(schoolId, classIds, ids);

  // Credentials (local only, git-ignored)
  const accounts = [
    ...STAFF.map((u) => ({ email: email(u.key), name: u.name, roles: u.roles.map((r) => r.role).join(", ") || "teacher" })),
    ...STUDENTS.map((u) => ({ email: email(u.key), name: u.name, roles: `student ${u.cls}` })),
    ...PARENTS.map((u) => ({ email: email(u.key), name: u.name, roles: `parent of ${STUDENTS.find((s) => s.key === u.child).name}` })),
  ];
  writeFileSync(CREDENTIALS_FILE, JSON.stringify({ school: SCHOOL_NAME, password, accounts }, null, 2));

  console.log(`${SCHOOL_NAME} ready (${accounts.length} users).`);
  console.log(`Emails and password are in ${CREDENTIALS_FILE}.`);
}

// ---------- activity ----------

const DAYS = [0, 1, 2, 3, 4]; // Sunday–Thursday

// Bell schedule as BellScheduleSetup writes it: breaks take their own
// lesson_number, so lessons after a break are numbered past it, and
// timetable_slots / lessons refer to these numbers.
const BELL_ROWS = [
  { n: 1, label: "שיעור 1", start: "08:00", end: "08:45" },
  { n: 2, label: "שיעור 2", start: "08:50", end: "09:35" },
  { n: 3, label: "הפסקה", start: "09:35", end: "09:55", breakMinutes: 20 },
  { n: 4, label: "שיעור 3", start: "09:55", end: "10:40" },
  { n: 5, label: "שיעור 4", start: "10:45", end: "11:30" },
  { n: 6, label: "הפסקה גדולה", start: "11:30", end: "11:50", breakMinutes: 20 },
  { n: 7, label: "שיעור 5", start: "11:50", end: "12:35" },
  { n: 8, label: "שיעור 6", start: "12:40", end: "13:25" },
];
const PERIODS = BELL_ROWS.filter((b) => !b.breakMinutes).map((b) => b.n);
const BELL_START = Object.fromEntries(BELL_ROWS.map((b) => [b.n, b.start]));

const TOPICS = {
  "מתמטיקה": ["משוואות ממעלה ראשונה", "פונקציה קווית", "בעיות תנועה", "אחוזים", "גאומטריה — משולשים", "חזקות ושורשים"],
  "אנגלית": ["Reading comprehension", "Present perfect", "Vocabulary unit", "Writing a paragraph", "Listening practice"],
  "לשון": ["מבנה המשפט", "שורש ובניין", "סימני פיסוק", "כתיבת טיעון"],
  "תנ\"ך": ["ספר שמואל", "ספר בראשית — האבות", "נביאים ראשונים", "ספר רות"],
  "מדעים": ["התא החי", "אנרגיה ושימורה", "חומרים ותכונותיהם", "מערכת העיכול"],
  "ביולוגיה": ["תורשה", "מערכת החיסון", "אקולוגיה"],
  "פיזיקה": ["קינמטיקה", "חוקי ניוטון", "חשמל"],
  "היסטוריה": ["המהפכה הצרפתית", "התנועה הציונית", "מלחמת העולם הראשונה", "הקמת המדינה"],
  "ספרות": ["שירת רחל", "סיפור קצר — עגנון", "רומן — ניתוח דמויות"],
  "חינוך גופני": ["כדורעף", "כדורסל", "אתלטיקה", "כושר גופני"],
  "גאוגרפיה": ["מפות וקנה מידה", "אקלים ישראל", "אוכלוסייה ועיור"],
  "אזרחות": ["מגילת העצמאות", "זכויות אדם", "רשויות השלטון"],
  "חינוך": ["שיחת כיתה", "גיבוש כיתתי", "מעורבות חברתית"],
};

// Rooms are unique per hour (timetable_slots_room_slot_unique), so each lab
// and each second study group gets a room of its own.
function roomFor(cls, subject, groupIdx) {
  if (subject === "חינוך גופני") return "אולם ספורט";
  if (subject === "מדעים") return "מעבדה 1";
  if (subject === "ביולוגיה") return "מעבדה 2";
  if (subject === "פיזיקה") return "מעבדה 3";
  if (groupIdx > 0) return `חדר הקבצה — ${subject}`;
  return `חדר ${cls}`;
}

// Fills a week for every class so no teacher is in two rooms at once (a
// study-group hour needs all its teachers free). Greedy with random restarts.
function buildTimetable() {
  for (let attempt = 1; attempt <= 500; attempt++) {
    const r = rng(attempt);
    const busy = new Set();
    const slots = [];
    let ok = true;
    for (const cls of CLASSES) {
      const pool = Object.entries(curriculumOf(cls)).flatMap(([subject, hours]) => Array(hours).fill(subject));
      const perDay = {};
      for (const day of DAYS) {
        for (const lesson of PERIODS) {
          // Prefer subjects not yet taught today, then any that fit.
          const order = pool.map((s, i) => [s, i, r()]).sort((a, b) => a[2] - b[2]);
          const fits = ([s]) => teachersFor(cls, s).every(({ teacher }) => !busy.has(`${teacher.key}|${day}|${lesson}`));
          const choice = order.find((o) => fits(o) && !perDay[`${day}|${o[0]}`]) ?? order.find(fits);
          if (!choice) { ok = false; break; }
          const [subject, idx] = choice;
          pool.splice(idx, 1);
          perDay[`${day}|${subject}`] = true;
          teachersFor(cls, subject).forEach(({ teacher, group }, groupIdx) => {
            busy.add(`${teacher.key}|${day}|${lesson}`);
            slots.push({ cls, day, lesson, subject, teacher, group, room: roomFor(cls, subject, groupIdx) });
          });
        }
        if (!ok) break;
      }
      if (!ok) break;
    }
    if (ok) return slots;
  }
  throw new Error("could not build a conflict-free timetable");
}

const QUESTION_TYPES = { mc: "multiple_choice", tf: "true_false", fill: "fill_blank", open: "open" };
const bankFor = (cls, subject) => QUESTION_BANK[`${subject}|${MIDDLE.includes(cls) ? "middle" : "high"}`];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

async function seedActivity(schoolId, classIds, ids) {
  const now = new Date().toISOString();
  const studentsOf = (cls) => STUDENTS.filter((s) => s.cls === cls);
  const inGroup = (s, subject, group) => !group || groupOf(s, subject) === group;

  // ----- bell schedule, study groups, timetable -----
  await q(
    db.from("bell_schedule").insert(BELL_ROWS.map((b) => ({
      school_id: schoolId, lesson_number: b.n, label: b.label, start_time: b.start, end_time: b.end,
      is_break: !!b.breakMinutes, break_duration_minutes: b.breakMinutes ?? 0,
    }))),
    "insert bell schedule",
  );

  const trackRows = STUDENTS.flatMap((s) =>
    Object.keys(GROUPS).map((subject) => groupOf(s, subject)).filter(Boolean).map((group) => ({
      user_id: ids[s.key], school_id: schoolId, track_type: "hakbatza", track_name: group,
      level: group.includes("5") ? "5" : "4", approved: true, approved_by: ids["coordinator-high"],
    })),
  );
  await insertMany("student_tracks", trackRows, "insert student tracks");

  const week = buildTimetable();
  await insertMany("timetable_slots", week.map((w) => ({
    school_id: schoolId,
    class_id: classIds[w.cls],
    day_of_week: w.day,
    lesson_number: w.lesson,
    subject: w.subject,
    teacher_id: ids[w.teacher.key],
    teacher_name: w.teacher.name,
    room: w.room,
    group_name: w.group,
    color: SUBJECT_COLORS[w.subject],
  })), "insert timetable");
  console.log(`  timetable: ${week.length} weekly slots, ${trackRows.length} study-group placements`);

  // ----- lessons + attendance for the last 20 school days -----
  const days = recentSchoolDays(20);
  const topicCount = {};
  const lessonMeta = [];
  const lessonRows = days.flatMap((d) =>
    week.filter((w) => w.day === d.getDay()).map((w) => {
      const k = `${w.cls}|${w.subject}|${w.group}`;
      const i = (topicCount[k] = (topicCount[k] ?? 0) + 1);
      const topics = TOPICS[w.subject];
      lessonMeta.push(w);
      return {
        school_id: schoolId, class_id: classIds[w.cls], teacher_id: ids[w.teacher.key], subject: w.subject,
        lesson_date: isoDate(d), lesson_number: w.lesson,
        topic: `${topics[Math.floor((i - 1) / 3) % topics.length]} (${i})${w.group ? ` · ${w.group}` : ""}`,
      };
    }),
  );
  const lessons = await insertMany("lessons", lessonRows, "insert lessons", "id, lesson_date, lesson_number");
  const ar = rng(2026);
  // One student per class is often absent, so the 15% alert has something to show.
  const truant = new Set(CLASSES.map((c) => studentsOf(c)[3].key));
  const attendanceRows = lessons.flatMap((l, li) => {
    const w = lessonMeta[li];
    const [hh, mm] = BELL_START[l.lesson_number].split(":");
    return studentsOf(w.cls).filter((s) => inGroup(s, w.subject, w.group)).map((s) => {
      const x = ar();
      const absentRate = truant.has(s.key) ? 0.2 : 0.04;
      const status = x < absentRate ? "absent" : x < absentRate + 0.05 ? "late" : "present";
      return { lesson_id: l.id, student_id: ids[s.key], status, noted_at: `${l.lesson_date}T${hh}:${String(Number(mm) + 2).padStart(2, "0")}:00+03:00` };
    });
  });
  await insertMany("attendance", attendanceRows, "insert attendance");
  console.log(`  ${lessons.length} lessons, ${attendanceRows.length} attendance marks`);

  // ----- assignments with real questions -----
  // Per class and subject: a graded exam, graded homework and an upcoming one,
  // each on its own topic from the question bank. Classes start on different
  // topics so neighbouring grades don't get the same exam.
  const defs = [];
  for (const cls of CLASSES) {
    for (const subject of Object.keys(curriculumOf(cls))) {
      const bank = bankFor(cls, subject);
      if (!bank) continue; // חינוך, חינוך גופני
      const teacher = teachersFor(cls, subject)[0].teacher;
      const r = rng(hash(cls + subject));
      const off = CLASSES.indexOf(cls) % bank.length;
      const topic = (i) => bank[(off + i) % bank.length];
      const upcomingType = pick(r, [["quiz", "בוחן"], ["exercise", "תרגול"], ["project", "עבודה"]]);
      defs.push(
        { cls, subject, teacher, topic: topic(0), title: `מבחן — ${topic(0).topic}`, type: "exam", due: -(5 + Math.floor(r() * 14)), weight: 40 },
        { cls, subject, teacher, topic: topic(1), title: `שיעורי בית — ${topic(1).topic}`, type: "homework", due: -(1 + Math.floor(r() * 6)), weight: 10 },
        { cls, subject, teacher, topic: topic(2), title: `${upcomingType[1]} — ${topic(2).topic}`, type: upcomingType[0], due: 2 + Math.floor(r() * 12), weight: 20 },
      );
    }
  }
  const assignments = await insertMany("assignments", defs.map((a) => ({
    school_id: schoolId, class_id: classIds[a.cls], teacher_id: ids[a.teacher.key], subject: a.subject, title: a.title, type: a.type,
    description: `${a.topic.questions.length} שאלות בנושא ${a.topic.topic}. ענו על כל השאלות; בשאלות הפתוחות פרטו את דרך החשיבה.`,
    due_date: daysFromNow(a.due).toISOString(), max_grade: 100, weight_percent: a.weight, published: true,
  })), "insert assignments", "id");

  const questionRows = assignments.flatMap((a, ai) => {
    const { topic } = defs[ai];
    const points = Math.round(100 / topic.questions.length);
    return topic.questions.map((qq, i) => ({
      assignment_id: a.id,
      question_type: QUESTION_TYPES[qq.t],
      question_text: qq.q,
      options: qq.t === "mc" ? qq.o : qq.t === "tf" ? ["נכון", "לא נכון"] : [],
      correct_answer: qq.a,
      explanation: qq.e,
      points,
      order_num: i,
      difficulty: qq.d,
      tags: [topic.topic],
    }));
  });
  const questions = await insertMany("task_questions", questionRows, "insert questions", "id, assignment_id, order_num");
  const questionsOf = {};
  for (const row of questions) (questionsOf[row.assignment_id] ??= [])[row.order_num] = row.id;

  // Answers in the quiz_answers format the submissions view reads (src/lib/quizAnswers.ts),
  // with about `pct`% of them right.
  const quizContent = (assignmentId, topic, pct, r) => {
    const qs = topic.questions;
    const rightCount = Math.round((pct / 100) * qs.length);
    const right = new Set(qs.map((_, i) => i).sort(() => r() - 0.5).slice(0, rightCount));
    return JSON.stringify({
      kind: "quiz_answers",
      answers: qs.map((qq, i) => ({
        questionId: questionsOf[assignmentId][i],
        questionText: qq.q,
        answer: right.has(i) ? qq.a : wrongAnswerFor(qq, r),
        correctAnswer: qq.a,
        correct: right.has(i),
      })),
    });
  };

  const FEEDBACK = ["עבודה מצוינת!", "יפה מאוד, המשך כך", "שים לב לפירוט התשובות", "התקדמות יפה", "כדאי לחזור על החומר", "תשובות מנומקות היטב"];
  const submissionRows = [];
  assignments.forEach((a, ai) => {
    const def = defs[ai];
    const r = rng(hash(def.title + def.cls));
    for (const s of studentsOf(def.cls)) {
      const sid = ids[s.key];
      const grade = clamp(Math.round(LEVEL[s.key] + (r() - 0.5) * 24), 35, 100);
      if (def.due > 0) {
        // Upcoming: a third already handed it in, waiting for grading.
        if (r() < 0.33) {
          submissionRows.push({ assignment_id: a.id, student_id: sid, attempt_number: 1, status: "submitted", content: quizContent(a.id, def.topic, grade, r), submitted_at: daysFromNow(-1).toISOString() });
        }
        continue;
      }
      if (def.type === "homework" && r() < 0.1) continue; // some homework is never handed in
      submissionRows.push({
        assignment_id: a.id, student_id: sid, attempt_number: 1, status: "graded", content: quizContent(a.id, def.topic, grade, r),
        grade, feedback: pick(r, FEEDBACK), graded_by: ids[def.teacher.key], graded_at: now, submitted_at: daysFromNow(def.due).toISOString(),
      });
    }
  });
  await insertMany("submissions", submissionRows, "insert submissions");
  console.log(`  ${assignments.length} assignments, ${questions.length} questions, ${submissionRows.length} submissions`);

  // ----- interactive code tasks -----
  for (const task of INTERACTIVE_TASKS) {
    const teacher = teachersFor(task.cls, task.subject)[0].teacher;
    const [assignment] = await q(db.from("assignments").insert({
      school_id: schoolId, class_id: classIds[task.cls], teacher_id: ids[teacher.key], subject: task.subject,
      title: task.title, type: "exercise", description: task.description,
      due_date: daysFromNow(task.dueDays).toISOString(), max_grade: 100, weight_percent: 15, published: true,
    }).select("id"), "insert task assignment");
    const [row] = await q(db.from("interactive_tasks").insert({
      assignment_id: assignment.id, author_id: ids[teacher.key], school_id: schoolId,
      title: task.title, description: task.description, subject: task.subject, grade_level: task.cls.split("-")[0],
      language: "web", mode: "consume", html_code: task.html, css_code: task.css, js_code: task.js, libraries: [],
      grading_schema: task.grading,
    }).select("id"), "insert interactive task");

    // Most of the class finished it, a few are midway, one or two haven't opened it.
    const r = rng(hash(task.title));
    const max = task.grading.maxScore;
    const progress = [];
    const subs = [];
    for (const s of studentsOf(task.cls)) {
      const x = r();
      if (x < 0.1) continue;
      const pct = clamp(Math.round(LEVEL[s.key] + (r() - 0.5) * 30), 30, 100);
      const when = daysFromNow(task.dueDays - Math.floor(r() * 3)).toISOString();
      if (x < 0.28) {
        progress.push({ task_id: row.id, student_id: ids[s.key], status: "in_progress", time_spent_seconds: 60 + Math.floor(r() * 240), last_active_at: when });
        continue;
      }
      const score = Math.round((pct / 100) * max);
      progress.push({ task_id: row.id, student_id: ids[s.key], status: "submitted", score, total: max, time_spent_seconds: 180 + Math.floor(r() * 720), last_active_at: when, submitted_at: when });
      subs.push({ assignment_id: assignment.id, student_id: ids[s.key], attempt_number: 1, status: "submitted", grade: Math.round((score / max) * 100), submitted_at: when });
    }
    await insertMany("interactive_task_progress", progress, "insert task progress");
    await insertMany("submissions", subs, "insert task submissions");
  }
  console.log(`  ${INTERACTIVE_TASKS.length} interactive code tasks`);

  // ----- seating: 3 columns of desks per class -----
  await insertMany("student_seats", CLASSES.flatMap((cls) =>
    studentsOf(cls).map((s, i) => ({ class_id: classIds[cls], student_id: ids[s.key], row_index: Math.floor(i / 3), col_index: i % 3 })),
  ), "insert seats");

  await seedNewspaper(schoolId, ids);
  await seedCouncil(schoolId, ids);

  // ----- events -----
  const approved = { status: "approved", approved_by: ids.principal, approved_at: now };
  await q(db.from("grade_events").insert([
    { school_id: schoolId, grade: "ז", title: "מבחן מחצית במתמטיקה", subject: "מתמטיקה", event_type: "exam", event_date: isoDate(daysFromNow(9)), proposed_by: ids["math-coordinator"], ...approved },
    { school_id: schoolId, grade: "ט", title: "מבחן באנגלית", subject: "אנגלית", event_type: "exam", event_date: isoDate(daysFromNow(11)), status: "proposed", proposed_by: ids["coordinator-middle"] },
    { school_id: schoolId, grade: "ח", title: "טיול שנתי — הגליל", event_type: "trip", event_date: isoDate(daysFromNow(18)), requires_parent_approval: true, proposed_by: ids["coordinator-middle"], ...approved },
    { school_id: schoolId, grade: "י", title: "מבחן בגרות בתנ\"ך — מתכונת", subject: "תנ\"ך", event_type: "exam", event_date: isoDate(daysFromNow(14)), proposed_by: ids["exam-coordinator"], ...approved },
    { school_id: schoolId, grade: "יא", title: "סיור בכנסת", event_type: "trip", event_date: isoDate(daysFromNow(25)), requires_parent_approval: true, proposed_by: ids["coordinator-high"], ...approved },
    { school_id: schoolId, grade: "יב", title: "מתכונת במתמטיקה", subject: "מתמטיקה", event_type: "exam", event_date: isoDate(daysFromNow(7)), status: "proposed", proposed_by: ids["educator-y"] },
  ]), "insert grade events");

  await q(db.from("school_events").insert([
    { school_id: schoolId, title: "טקס יום הזיכרון לרבין", event_type: "ceremony", start_date: isoDate(daysFromNow(2)), end_date: isoDate(daysFromNow(2)), is_holiday: false },
    { school_id: schoolId, title: "אסיפת הורים", event_type: "meeting", start_date: isoDate(daysFromNow(16)), end_date: isoDate(daysFromNow(16)), is_holiday: false },
    { school_id: schoolId, title: "חופשת חנוכה", event_type: "holiday", start_date: isoDate(daysFromNow(60)), end_date: isoDate(daysFromNow(68)), is_holiday: true },
  ]), "insert school events");
}

// ---------- newspaper ----------

async function seedNewspaper(schoolId, ids) {
  const r = rng(77);
  const articles = await q(db.from("newspaper_articles").insert(ARTICLES.map((a) => {
    const at = daysFromNow(-a.daysAgo).toISOString();
    return {
      school_id: schoolId, author_id: ids[a.by], title: a.title, content: a.content, category: a.category,
      status: a.draft ? "draft" : "published", published_at: a.draft ? null : at, created_at: at, likes: 0,
    };
  })).select("id, status"), "insert articles");

  // Likes from a different slice of the school for each article; the counter column matches.
  for (const article of articles) {
    if (article.status !== "published") continue;
    const likers = STUDENTS.filter(() => r() < 0.15 + r() * 0.4);
    if (!likers.length) continue;
    await insertMany("newspaper_article_likes", likers.map((s) => ({ article_id: article.id, user_id: ids[s.key] })), "insert likes");
    await q(db.from("newspaper_articles").update({ likes: likers.length }).eq("id", article.id), "update like count");
  }
  console.log(`  ${articles.length} newspaper articles`);
}

// ---------- council ----------
// Last year: a plain election for head, closed, with that council still in
// office (head + newspaper editor). This year: a class → school tournament
// (src/components/council/CouncilTournament.tsx). The class round is closed and
// the final round is in a revote between two tied finalists — the state
// advance_council_round leaves behind after a tie under 'revote_tied'.

// This year's class-round winners, one per class.
const CLASS_WINNERS = ["student02", "student11", "student24", "student27", "student38", "student43"];
// The two finalists who tied in the first count of the school round.
const TIED = ["student27", "student43"];

async function seedCouncil(schoolId, ids) {
  const advisor = ids["council-advisor"];
  const yearAgo = daysFromNow(-365).toISOString();
  const studentByKey = (key) => STUDENTS.find((s) => s.key === key);
  const homeroomOf = (cls) => ids[STAFF.find((s) => s.homeroom === cls).key];

  // --- last year ---
  const [lastElection] = await q(db.from("council_elections").insert({
    school_id: schoolId, title: `בחירות לראשות מועצת התלמידים ${LAST_YEAR.term}`, description: "בחירה ישירה של ראש/ת המועצה",
    num_seats: 1, status: "closed", created_by: advisor, created_at: yearAgo,
  }).select("id"), "insert last election");
  const lastCandidates = await q(db.from("council_candidates").insert(LAST_YEAR.candidates.map((c) => ({
    election_id: lastElection.id, student_id: ids[c.key], statement: c.statement, status: "approved", reviewed_by: advisor, reviewed_at: yearAgo, created_at: yearAgo,
  }))).select("id, student_id"), "insert last candidates");
  // 45% / 35% / 20% of the older grades.
  const lastVoters = STUDENTS.filter((s) => !["ז-1", "ח-1"].includes(s.cls));
  const shares = [0.45, 0.35, 0.2];
  let v = 0;
  const lastVotes = [];
  lastCandidates.forEach((c, i) => {
    const n = i === lastCandidates.length - 1 ? lastVoters.length - v : Math.round(lastVoters.length * shares[i]);
    for (const s of lastVoters.slice(v, v + n)) lastVotes.push({ election_id: lastElection.id, candidate_id: c.id, voter_id: ids[s.key], created_at: yearAgo });
    v += n;
  });
  await insertMany("council_votes", lastVotes, "insert last votes");

  const lastTerm = [
    { key: LAST_YEAR.winner, role: "head", position: studentByKey(LAST_YEAR.winner).g === "f" ? "ראשת המועצה" : "ראש המועצה", active: true, appointment: "elected" },
    ...LAST_YEAR.members.map((m) => ({ ...m, appointment: m.role === "member" ? "elected" : "appointed" })),
  ];
  await q(db.from("council_members").insert(lastTerm.map((m) => ({
    school_id: schoolId, student_id: ids[m.key], role_type: m.role, position: m.position, term_label: LAST_YEAR.term,
    is_active: m.active, appointment_type: m.appointment, appointed_by: advisor, created_at: yearAgo,
  }))), "insert last council");

  // --- this year's tournament ---
  const title = "בחירות למועצת התלמידים תשפ\"ז";
  const [campaign] = await q(db.from("council_campaigns").insert({
    school_id: schoolId, title, description: "שלב כיתתי: נציג/ה אחד/ת מכל כיתה. שלב סופי: כל התלמידים בוחרים את ראש/ת המועצה.",
    created_by: advisor, votes_per_student: 1, candidates_per_class: 1, tie_break_mode: "revote_tied",
    has_grade_round: false, final_round_voters: "all_students", status: "school", created_at: daysFromNow(-21).toISOString(),
  }).select("id"), "insert campaign");

  const [classRound] = await q(db.from("council_elections").insert({
    school_id: schoolId, title: `${title} - שלב כיתתי`, num_seats: 1, status: "closed", created_by: advisor,
    campaign_id: campaign.id, round_scope: "class", created_at: daysFromNow(-21).toISOString(),
  }).select("id"), "insert class round");
  const classCandidates = await q(db.from("council_candidates").insert(Object.entries(CAMPAIGN_STATEMENTS).map(([key, statement]) => ({
    election_id: classRound.id, student_id: ids[key], statement, status: "approved",
    reviewed_by: homeroomOf(studentByKey(key).cls), reviewed_at: daysFromNow(-18).toISOString(),
    round_result: CLASS_WINNERS.includes(key) ? "advanced" : "eliminated", advancement_processed: true,
  }))).select("id, student_id"), "insert class candidates");
  const keyOfId = Object.fromEntries(STUDENTS.map((s) => [ids[s.key], s.key]));
  const classCandidateOf = Object.fromEntries(classCandidates.map((c) => [keyOfId[c.student_id], c.id]));

  // Class votes: everyone votes in their own class; the winner takes about 60%.
  const classVotes = [];
  for (const cls of CLASSES) {
    const running = Object.keys(CAMPAIGN_STATEMENTS).filter((k) => studentByKey(k).cls === cls);
    const winner = running.find((k) => CLASS_WINNERS.includes(k));
    const loser = running.find((k) => k !== winner);
    const voters = STUDENTS.filter((s) => s.cls === cls);
    const winnerVotes = Math.ceil(voters.length * 0.6);
    voters.forEach((s, i) => classVotes.push({
      election_id: classRound.id, candidate_id: classCandidateOf[i < winnerVotes ? winner : loser], voter_id: ids[s.key],
      created_at: daysFromNow(-15).toISOString(),
    }));
  }
  await insertMany("council_votes", classVotes, "insert class votes");

  // Class winners joined the council as members when the class round closed.
  await q(db.from("council_members").insert(CLASS_WINNERS.map((key) => ({
    school_id: schoolId, student_id: ids[key], role_type: "member", position: "חבר/ת מועצה", term_label: "תשפ\"ז",
    is_active: true, appointment_type: "elected", appointed_by: advisor, created_at: daysFromNow(-14).toISOString(),
  }))), "insert new council members");

  const [finalRound] = await q(db.from("council_elections").insert({
    school_id: schoolId, title: `${title} - שלב סופי`, num_seats: 1, status: "voting", created_by: advisor,
    campaign_id: campaign.id, round_scope: "school", created_at: daysFromNow(-14).toISOString(),
  }).select("id"), "insert final round");
  const finalists = await q(db.from("council_candidates").insert(CLASS_WINNERS.map((key) => ({
    election_id: finalRound.id, student_id: ids[key], statement: CAMPAIGN_STATEMENTS[key], status: "approved",
    round_result: TIED.includes(key) ? "tied" : "eliminated", advanced_from_candidate_id: classCandidateOf[key],
  }))).select("id, student_id"), "insert finalists");
  const finalistOf = Object.fromEntries(finalists.map((c) => [keyOfId[c.student_id], c.id]));

  // First count: 12–12 between the tied pair and 26 for the rest. The tied
  // pair's votes were deleted for the revote, so only the other 26 remain;
  // 17 of the 24 freed voters have voted again so far (9–8).
  const pool = [...STUDENTS].sort((a, b) => hash(a.key + "vote") - hash(b.key + "vote"));
  const others = CLASS_WINNERS.filter((k) => !TIED.includes(k));
  const otherCounts = [8, 7, 6, 5];
  const finalVotes = [];
  let p = 0;
  others.forEach((key, i) => {
    for (const s of pool.slice(p, p + otherCounts[i])) finalVotes.push({ election_id: finalRound.id, candidate_id: finalistOf[key], voter_id: ids[s.key] });
    p += otherCounts[i];
  });
  const freed = pool.slice(p);
  freed.slice(0, 9).forEach((s) => finalVotes.push({ election_id: finalRound.id, candidate_id: finalistOf[TIED[0]], voter_id: ids[s.key] }));
  freed.slice(9, 17).forEach((s) => finalVotes.push({ election_id: finalRound.id, candidate_id: finalistOf[TIED[1]], voter_id: ids[s.key] }));
  await insertMany("council_votes", finalVotes, "insert final votes");
  console.log(`  council: last year's election + this year's tournament (${classCandidates.length} candidates, ${classVotes.length + finalVotes.length} votes)`);
}

try {
  if (RESET) await reset();
  else await seed();
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
}
