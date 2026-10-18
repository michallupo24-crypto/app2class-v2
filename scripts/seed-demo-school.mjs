// Seeds a mock school ("בית ספר הדגמה") with one approved user per role and
// some sample data (lessons, attendance, assignments, grades, events), so every
// dashboard can be exercised end to end.
//
// Usage (from the repo root):
//   npm run seed:demo          # create or refresh the demo school
//   npm run seed:demo:reset    # delete everything it created
//
// Needs SUPABASE_SERVICE_ROLE_KEY, either as an env var or as a line in .env.local.
// The URL is read from SUPABASE_URL or VITE_SUPABASE_URL in .env.local.
// The password for all demo users comes from DEMO_PASSWORD, or is generated once
// and written to demo-school.credentials.local.json (git-ignored) with the emails.
// Safe to re-run: users are reused by email and sample data is replaced.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SCHOOL_NAME = "בית ספר הדגמה";
const EMAIL_PREFIX = "demo.";
const EMAIL_DOMAIN = "demo.il";
const CREDENTIALS_FILE = "demo-school.credentials.local.json";

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
  return "Demo-" + randomBytes(6).toString("base64url");
}

// ---------- the demo school ----------

// Classes: grade + class number.
const CLASSES = [
  ["י", 1],
  ["י", 2],
  ["ז", 1],
];

// One entry per demo user. `classes` are teaching classes ("י-1"); `homeroom` marks the educator's class.
const STAFF = [
  { key: "principal", name: "רונית מנהלת", roles: [{ role: "management" }] },
  { key: "grade-coordinator", name: "אבי רכז-שכבה", roles: [{ role: "grade_coordinator", grade: "י" }], classes: ["י-2"] },
  {
    key: "subject-coordinator",
    name: "מיכל רכזת-מתמטיקה",
    roles: [{ role: "subject_coordinator", subject: "מתמטיקה" }, { role: "professional_teacher", subject: "מתמטיקה" }],
    classes: ["י-2"],
  },
  {
    key: "educator",
    name: "דנה מחנכת",
    roles: [{ role: "educator", homeroom: "י-1" }, { role: "professional_teacher", subject: "אנגלית" }],
    classes: ["י-1", "י-2"],
  },
  { key: "teacher", name: "יוסי מורה-מתמטיקה", roles: [{ role: "professional_teacher", subject: "מתמטיקה" }], classes: ["י-1", "ז-1"] },
  { key: "counselor", name: "שירה יועצת", roles: [{ role: "counselor", grade: "י" }] },
];

const STUDENTS = [
  { key: "student", name: "נועה תלמידה", cls: "י-1" },
  { key: "student2", name: "איתי כהן", cls: "י-1" },
  { key: "student3", name: "מאיה לוי", cls: "י-1" },
  { key: "student4", name: "עומר מזרחי", cls: "י-1" },
  { key: "student5", name: "תמר אברהם", cls: "י-1" },
  { key: "student6", name: "יונתן פרץ", cls: "י-2" },
  { key: "student7", name: "שקד ביטון", cls: "י-2" },
  { key: "student8", name: "אורי דהן", cls: "ז-1" },
];

const PARENTS = [{ key: "parent", name: "גלית הורה", child: "student" }];

// ---------- reset ----------

async function reset() {
  const school = await q(db.from("schools").select("id").eq("name", SCHOOL_NAME).maybeSingle(), "find school");
  const demoUsers = (await listAllUsers()).filter((u) => u.email?.startsWith(EMAIL_PREFIX) && u.email.endsWith("@" + EMAIL_DOMAIN));

  if (school) await deleteSampleData(school.id);
  for (const u of demoUsers) {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) console.warn(`  could not delete ${u.email}: ${error.message}`);
  }
  if (school) {
    await q(db.from("classes").delete().eq("school_id", school.id), "delete classes");
    await q(db.from("schools").delete().eq("id", school.id), "delete school");
  }
  console.log(`Removed ${demoUsers.length} demo users${school ? " and the demo school" : ""}.`);
}

async function deleteSampleData(schoolId) {
  const lessons = await q(db.from("lessons").select("id").eq("school_id", schoolId), "list lessons");
  if (lessons.length) await q(db.from("attendance").delete().in("lesson_id", lessons.map((l) => l.id)), "delete attendance");
  await q(db.from("lessons").delete().eq("school_id", schoolId), "delete lessons");

  const assignments = await q(db.from("assignments").select("id").eq("school_id", schoolId), "list assignments");
  if (assignments.length) await q(db.from("submissions").delete().in("assignment_id", assignments.map((a) => a.id)), "delete submissions");
  await q(db.from("assignments").delete().eq("school_id", schoolId), "delete assignments");

  await q(db.from("grade_events").delete().eq("school_id", schoolId), "delete grade events");
  await q(db.from("school_events").delete().eq("school_id", schoolId), "delete school events");
}

// ---------- seed ----------

async function seed() {
  const password = loadOrCreatePassword();

  // School + classes
  let school = await q(db.from("schools").select("id").eq("name", SCHOOL_NAME).maybeSingle(), "find school");
  if (!school) school = await q(db.from("schools").insert({ name: SCHOOL_NAME }).select("id").single(), "create school");
  const schoolId = school.id;
  // Keep the demo school out of the public registration dropdown (column from
  // migration 20261018030000; ignore the error if it hasn't been applied yet).
  await db.from("schools").update({ open_for_registration: false }).eq("id", schoolId);

  const classIds = {};
  for (const [grade, num] of CLASSES) {
    let cls = await q(
      db.from("classes").select("id").eq("school_id", schoolId).eq("grade", grade).eq("class_number", num).maybeSingle(),
      "find class",
    );
    if (!cls) cls = await q(db.from("classes").insert({ school_id: schoolId, grade, class_number: num }).select("id").single(), "create class");
    classIds[`${grade}-${num}`] = cls.id;
  }

  // Users
  const existing = new Map((await listAllUsers()).map((u) => [u.email, u]));
  const ids = {};
  let idSeq = 31000000;

  async function upsertUser(key, fullName, profileExtra) {
    const mail = email(key);
    let user = existing.get(mail);
    if (!user) {
      const { data, error } = await db.auth.admin.createUser({
        email: mail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error) throw new Error(`create ${mail}: ${error.message}`);
      user = data.user;
    } else {
      const { error } = await db.auth.admin.updateUserById(user.id, { password });
      if (error) throw new Error(`update ${mail}: ${error.message}`);
    }
    ids[key] = user.id;

    await q(
      db.from("profiles").update({
        full_name: fullName,
        school_id: schoolId,
        id_number: israeliId(idSeq++),
        is_approved: true,
        ...profileExtra,
      }).eq("id", user.id),
      `profile ${mail}`,
    );
    // Roles and teaching classes are rewritten from scratch on every run.
    await q(db.from("user_roles").delete().eq("user_id", user.id), "clear roles");
    await q(db.from("teacher_classes").delete().eq("user_id", user.id), "clear teacher classes");
    await q(db.from("approvals").delete().eq("user_id", user.id), "clear approvals");
    return user.id;
  }

  async function addRoles(userId, roles, requiredRole, notes) {
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
    await q(
      db.from("approvals").insert({ user_id: userId, required_role: requiredRole, status: "approved", notes }),
      "insert approval",
    );
  }

  for (const s of STAFF) {
    const userId = await upsertUser(s.key, s.name, { phone: "050-0000000" });
    await addRoles(userId, s.roles, s.roles.some((r) => r.role === "management") ? "system_admin" : "management", `דמו: ${s.name}`);
    const homeroom = s.roles.find((r) => r.homeroom)?.homeroom;
    const teaching = [...new Set([...(s.classes ?? []), ...(homeroom ? [homeroom] : [])])];
    if (teaching.length) {
      await q(
        db.from("teacher_classes").insert(
          teaching.map((c) => ({ user_id: userId, class_id: classIds[c], is_homeroom: c === homeroom })),
        ),
        "insert teacher classes",
      );
    }
  }

  for (const st of STUDENTS) {
    const userId = await upsertUser(st.key, st.name, { class_id: classIds[st.cls], date_of_birth: "2010-03-15" });
    await addRoles(userId, [{ role: "student" }], "educator", `דמו: ${st.name}`);
  }

  for (const p of PARENTS) {
    const userId = await upsertUser(p.key, p.name, { phone: "052-0000000" });
    await addRoles(userId, [{ role: "parent" }], "educator", `דמו: ${p.name}`);
    await q(db.from("parent_student").delete().eq("parent_id", userId), "clear parent links");
    await q(db.from("parent_student").insert({ parent_id: userId, student_id: ids[p.child] }), "link parent");
  }

  // Sample data
  await deleteSampleData(schoolId);
  await seedSampleData(schoolId, classIds, ids);

  // Credentials (local only, git-ignored)
  const accounts = [...STAFF, ...STUDENTS, ...PARENTS].map((u) => ({ email: email(u.key), name: u.name }));
  writeFileSync(CREDENTIALS_FILE, JSON.stringify({ school: SCHOOL_NAME, password, accounts }, null, 2));

  console.log(`Demo school ready: ${SCHOOL_NAME} (${accounts.length} users).`);
  console.log(`Emails and password are in ${CREDENTIALS_FILE}.`);
}

async function seedSampleData(schoolId, classIds, ids) {
  const studentsOf = (cls) => STUDENTS.filter((s) => s.cls === cls).map((s) => ids[s.key]);

  // Lessons + attendance for the last 10 school days in י-1 (math and English).
  const statuses = ["present", "present", "present", "present", "present", "present", "late", "absent"];
  const days = recentSchoolDays(10);
  const lessonRows = days.flatMap((d, i) => [
    { school_id: schoolId, class_id: classIds["י-1"], teacher_id: ids.teacher, subject: "מתמטיקה", lesson_date: isoDate(d), lesson_number: 1, topic: `פונקציות — שיעור ${i + 1}` },
    { school_id: schoolId, class_id: classIds["י-1"], teacher_id: ids.educator, subject: "אנגלית", lesson_date: isoDate(d), lesson_number: 2, topic: `Reading comprehension ${i + 1}` },
  ]);
  const lessons = await q(db.from("lessons").insert(lessonRows).select("id, lesson_date"), "insert lessons");
  const attendanceRows = lessons.flatMap((l, li) =>
    studentsOf("י-1").map((sid, si) => ({
      lesson_id: l.id,
      student_id: sid,
      // Stamp with the lesson's day, not "now", or every record counts as today's attendance.
      noted_at: `${l.lesson_date}T08:${String(li % 60).padStart(2, "0")}:00+03:00`,
      // student2 is often absent so the 15% red-line alert has something to show.
      status: si === 1 && li % 3 === 0 ? "absent" : statuses[(li + si * 3) % statuses.length],
    })),
  );
  await q(db.from("attendance").insert(attendanceRows), "insert attendance");

  // Assignments + submissions
  const assignmentRows = [
    { title: "מבחן — פונקציה קווית", type: "exam", subject: "מתמטיקה", teacher_id: ids.teacher, cls: "י-1", due: -7, weight: 30 },
    { title: "שיעורי בית — משוואות", type: "homework", subject: "מתמטיקה", teacher_id: ids.teacher, cls: "י-1", due: 3, weight: 10 },
    { title: "Essay: My summer", type: "project", subject: "אנגלית", teacher_id: ids.educator, cls: "י-1", due: -3, weight: 20 },
    { title: "בוחן — בעיות תנועה", type: "quiz", subject: "מתמטיקה", teacher_id: ids["subject-coordinator"], cls: "י-2", due: 5, weight: 15 },
  ];
  const assignments = await q(
    db.from("assignments").insert(
      assignmentRows.map((a) => ({
        school_id: schoolId,
        class_id: classIds[a.cls],
        teacher_id: a.teacher_id,
        subject: a.subject,
        title: a.title,
        type: a.type,
        description: "משימת דמו",
        due_date: daysFromNow(a.due).toISOString(),
        max_grade: 100,
        weight_percent: a.weight,
        published: true,
      })),
    ).select("id, class_id, teacher_id"),
    "insert assignments",
  );

  const grades = [92, 78, 85, 64, 97];
  const submissionRows = [];
  assignments.forEach((a, ai) => {
    const def = assignmentRows[ai];
    if (def.due > 0) return; // future assignments stay open
    studentsOf(def.cls).forEach((sid, si) => {
      submissionRows.push({
        assignment_id: a.id,
        student_id: sid,
        attempt_number: 1,
        status: "graded",
        content: "הגשת דמו",
        grade: grades[(si + ai) % grades.length],
        feedback: si % 2 ? "עבודה טובה" : "שים לב לסימני פיסוק",
        graded_by: a.teacher_id,
        graded_at: new Date().toISOString(),
        submitted_at: daysFromNow(def.due).toISOString(),
      });
    });
  });
  await q(db.from("submissions").insert(submissionRows), "insert submissions");

  // Grade-wide events: one approved exam, one pending proposal, one trip needing parent approval.
  await q(
    db.from("grade_events").insert([
      { school_id: schoolId, grade: "י", title: "מבחן מחצית במתמטיקה", subject: "מתמטיקה", event_type: "exam", event_date: isoDate(daysFromNow(9)), status: "approved", proposed_by: ids["subject-coordinator"], approved_by: ids.principal, approved_at: new Date().toISOString() },
      { school_id: schoolId, grade: "י", title: "מבחן באנגלית", subject: "אנגלית", event_type: "exam", event_date: isoDate(daysFromNow(10)), status: "proposed", proposed_by: ids["grade-coordinator"] },
      { school_id: schoolId, grade: "י", title: "טיול שנתי", event_type: "trip", event_date: isoDate(daysFromNow(20)), status: "approved", requires_parent_approval: true, proposed_by: ids["grade-coordinator"], approved_by: ids.principal, approved_at: new Date().toISOString() },
    ]),
    "insert grade events",
  );

  await q(
    db.from("school_events").insert([
      { school_id: schoolId, title: "טקס יום הזיכרון לרבין", event_type: "ceremony", start_date: isoDate(daysFromNow(2)), end_date: isoDate(daysFromNow(2)), is_holiday: false },
      { school_id: schoolId, title: "חופשת חנוכה", event_type: "holiday", start_date: isoDate(daysFromNow(60)), end_date: isoDate(daysFromNow(68)), is_holiday: true },
    ]),
    "insert school events",
  );
}

try {
  if (RESET) await reset();
  else await seed();
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
}
