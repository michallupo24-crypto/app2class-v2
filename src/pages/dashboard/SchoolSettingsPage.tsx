import { useCallback, useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { FileSpreadsheet, Loader2, Save, Upload, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ConstraintsEditor, GradesEditor, GuidelinesEditor, Hint, RoomsEditor, RolesEditor, SubjectsEditor, TeachersEditor,
} from "@/components/school-setup/SetupSections";
import {
  ALL_GRADES, DEFAULT_GUIDELINES, ROLE_AREAS, SUBJECT_CATALOG, scopeGrades, withGuidelineDefaults,
  type CustomRoleDraft, type Guidelines, type RoomDraft, type SubjectDraft, type TeacherDraft,
} from "@/lib/schoolSetup";
import { AttendanceEventsEditor } from "@/components/school-setup/AttendanceEventsEditor";
import { DEFAULT_ATTENDANCE_EVENTS, type AttendanceEventType } from "@/hooks/useAttendanceEventTypes";
import { parseHistoryFile } from "@/lib/historyImport";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invalidateSchoolGuidelines } from "@/hooks/useSchoolGuidelines";
import type { UserProfile } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/displayName";
import DisplayNamesManager from "@/components/display-name/DisplayNamesManager";

/* The principal's control room: everything set at registration (guidelines,
   grades, subjects, rooms, staff, roles, constraints, history imports) can
   be changed here at any time. */

const TABS = [
  { id: "guidelines", label: "הנחיות" },
  { id: "grades", label: "שכבות וכיתות" },
  { id: "subjects", label: "מקצועות" },
  { id: "staff", label: "חדרים ומורים" },
  { id: "roles", label: "תפקידים" },
  { id: "constraints", label: "אילוצי מערכת" },
  { id: "attendance", label: "אירועי נוכחות" },
  { id: "imports", label: "ייבוא נתונים" },
  { id: "names", label: "שמות תצוגה" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const CATALOG_NAMES = new Set(SUBJECT_CATALOG.flatMap((g) => g.names));
const db = supabase as any; // the onboarding tables are newer than the generated types

const SchoolSettingsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "guidelines";
  const schoolId = profile.schoolId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [guidelines, setGuidelines] = useState<Guidelines>(DEFAULT_GUIDELINES);
  const [enabledRoles, setEnabledRoles] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<{ text: string }[]>([]);
  const [grades, setGrades] = useState<string[]>([...ALL_GRADES]);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [existingCounts, setExistingCounts] = useState<Record<string, number>>({});
  const [subjects, setSubjects] = useState<SubjectDraft[]>([]);
  const [rooms, setRooms] = useState<RoomDraft[]>([]);
  const [teachers, setTeachers] = useState<TeacherDraft[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleDraft[]>([]);
  // null = the attendance_event_types table isn't available (migration not applied).
  const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEventType[] | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [setRes, clsRes, subRes, roomRes, rosterRes, rolesRes, eventsRes] = await Promise.all([
      db.from("school_settings").select("*").eq("school_id", schoolId).maybeSingle(),
      supabase.from("classes").select("grade, class_number").eq("school_id", schoolId),
      db.from("school_subjects").select("*").eq("school_id", schoolId).order("sort_order"),
      db.from("school_rooms").select("*").eq("school_id", schoolId).order("name"),
      db.from("school_staff_roster").select("*").eq("school_id", schoolId).order("full_name"),
      db.from("school_custom_roles").select("*").eq("school_id", schoolId).order("created_at"),
      db.from("attendance_event_types").select("id, label, kind, category").eq("school_id", schoolId).order("sort_order"),
    ]);
    const s = setRes.data;
    setGuidelines(withGuidelineDefaults(s?.guidelines));
    setEnabledRoles(s?.enabled_roles || ["grade_coordinator", "subject_coordinator", "counselor", "secretary", "council_advisor", "exam_coordinator"]);
    setConstraints(s?.timetable_constraints || []);
    const counts: Record<string, number> = {};
    for (const c of clsRes.data || []) counts[c.grade] = Math.max(counts[c.grade] || 0, c.class_number);
    setExistingCounts(counts);
    setClassCounts({ ...Object.fromEntries(ALL_GRADES.map((g) => [g, 1])), ...counts });
    setGrades(s?.grades || ALL_GRADES.filter((g) => counts[g]));
    setSubjects((subRes.data || []).map((r: any) => ({
      name: r.name, sticker: r.sticker_subject, logoMode: r.logo_mode, logoUrl: r.logo_url,
      custom: !CATALOG_NAMES.has(r.name), scope: r.scope, grades: r.grades || [], kind: r.kind,
      levels: r.options?.levels, tracks: r.options?.tracks,
    })));
    setRooms((roomRes.data || []).map((r: any) => ({ name: r.name, kind: r.kind || "", capacity: r.capacity ? String(r.capacity) : "" })));
    setTeachers((rosterRes.data || []).map((r: any) => ({ id: r.id, linked: !!r.user_id, fullName: r.full_name, email: r.email || "", subjects: r.subjects || [], role: r.role || "" })));
    setCustomRoles((rolesRes.data || []).map((r: any) => ({ id: r.id, name: r.name, areas: r.areas || [] })));
    setAttendanceEvents(eventsRes.error ? null : eventsRes.data?.length ? eventsRes.data : DEFAULT_ATTENDANCE_EVENTS);
    setDirty(false);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  const save = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const fail = (r: { error: any }) => { if (r.error) throw r.error; };

      fail(await db.from("school_settings").upsert({
        school_id: schoolId, guidelines, enabled_roles: enabledRoles, timetable_constraints: constraints, grades,
        updated_by: profile.id, updated_at: new Date().toISOString(),
      }));

      // New classes only; existing classes hold students and are never removed here.
      const newClasses = grades.flatMap((g) =>
        Array.from({ length: Math.max(0, (classCounts[g] || 1) - (existingCounts[g] || 0)) }, (_, i) => ({
          school_id: schoolId, grade: g, class_number: (existingCounts[g] || 0) + i + 1,
        })));
      if (newClasses.length) fail(await supabase.from("classes").insert(newClasses as any));

      const names = subjects.map((s) => s.name);
      const { data: oldSubs } = await db.from("school_subjects").select("name").eq("school_id", schoolId);
      const removed = (oldSubs || []).map((r: any) => r.name).filter((n: string) => !names.includes(n));
      if (removed.length) fail(await db.from("school_subjects").delete().eq("school_id", schoolId).in("name", removed));
      if (subjects.length) {
        fail(await db.from("school_subjects").upsert(subjects.map((s, i) => ({
          school_id: schoolId, name: s.name, sticker_subject: s.sticker, logo_url: s.logoUrl || null, logo_mode: s.logoMode,
          scope: s.scope, grades: scopeGrades(s.scope, s.grades, grades), kind: s.kind,
          options: { ...(s.levels ? { levels: s.levels } : {}), ...(s.tracks ? { tracks: s.tracks } : {}) }, sort_order: i,
        })), { onConflict: "school_id,name" }));
      }

      fail(await db.from("school_rooms").delete().eq("school_id", schoolId));
      const roomRows = rooms.filter((r) => r.name.trim()).map((r) => ({ school_id: schoolId, name: r.name.trim(), kind: r.kind || null, capacity: r.capacity ? Number(r.capacity) : null }));
      if (roomRows.length) fail(await db.from("school_rooms").insert(roomRows));

      const keepIds = teachers.filter((t) => t.id).map((t) => t.id);
      const { data: oldRoster } = await db.from("school_staff_roster").select("id").eq("school_id", schoolId);
      const gone = (oldRoster || []).map((r: any) => r.id).filter((id: string) => !keepIds.includes(id));
      if (gone.length) fail(await db.from("school_staff_roster").delete().in("id", gone));
      for (const t of teachers.filter((t) => t.fullName.trim())) {
        const row = { school_id: schoolId, full_name: t.fullName.trim(), email: t.email.trim().toLowerCase() || null, subjects: t.subjects, role: t.role || null };
        fail(t.id ? await db.from("school_staff_roster").update(row).eq("id", t.id) : await db.from("school_staff_roster").insert(row));
      }

      const keepRoles = customRoles.filter((r) => r.id).map((r) => r.id);
      const { data: oldRoles } = await db.from("school_custom_roles").select("id").eq("school_id", schoolId);
      const goneRoles = (oldRoles || []).map((r: any) => r.id).filter((id: string) => !keepRoles.includes(id));
      if (goneRoles.length) fail(await db.from("school_custom_roles").delete().in("id", goneRoles));
      for (const r of customRoles.filter((r) => r.name.trim())) {
        const row = { school_id: schoolId, name: r.name.trim(), areas: r.areas };
        fail(r.id ? await db.from("school_custom_roles").update(row).eq("id", r.id) : await db.from("school_custom_roles").insert(row));
      }

      if (attendanceEvents) {
        const keepEvents = attendanceEvents.filter((e) => e.id).map((e) => e.id);
        const { data: oldEvents } = await db.from("attendance_event_types").select("id").eq("school_id", schoolId);
        const goneEvents = (oldEvents || []).map((r: any) => r.id).filter((id: string) => !keepEvents.includes(id));
        if (goneEvents.length) fail(await db.from("attendance_event_types").delete().in("id", goneEvents));
        for (const [i, e] of attendanceEvents.filter((e) => e.label.trim()).entries()) {
          const row = { school_id: schoolId, label: e.label.trim(), kind: e.kind, category: e.category, sort_order: i };
          fail(e.id ? await db.from("attendance_event_types").update(row).eq("id", e.id) : await db.from("attendance_event_types").insert(row));
        }
      }

      invalidateSchoolGuidelines(schoolId);
      toast({ title: "ההגדרות נשמרו" });
      await load();
    } catch (e: any) {
      toast({ title: "השמירה נכשלה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!schoolId) return <div className="py-20 text-center font-body text-muted-foreground">החשבון לא משויך לבית ספר.</div>;
  if (loading) return <div className="py-20 text-center font-body text-muted-foreground">טוען את הגדרות בית הספר…</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 pb-24">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h1 className="font-heading text-[27px] font-black leading-[1.05]">הגדרות בית הספר</h1>
          <p className="mt-[5px] font-body text-[13px] font-semibold text-muted-foreground">כל מה שהוגדר ברישום, ואפשר לשנות בכל רגע</p>
        </div>
        {tab !== "imports" && tab !== "names" && (
          <Button onClick={save} disabled={saving || !dirty} className="gap-1.5 rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "שומר…" : dirty ? "שמירה" : "נשמר"}
          </Button>
        )}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => { const p = new URLSearchParams(params); p.set("tab", t.id); setParams(p, { replace: true }); }}
            className={cn("shrink-0 rounded-full border-[2.5px] border-white px-[14px] py-[8px] font-body text-[13px] font-extrabold leading-none dark:border-card",
              tab === t.id ? "bg-primary text-primary-foreground shadow-[0_5px_10px_-5px_rgba(27,35,51,0.5)]" : "bg-card text-text-secondary")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-card bg-card p-4 shadow-card md:p-5">
        {tab === "guidelines" && <GuidelinesEditor value={guidelines} onChange={touch(setGuidelines)} />}
        {tab === "grades" && (
          <div className="space-y-2">
            <GradesEditor grades={grades} classesPerGrade={classCounts}
              onChange={(g, c) => {
                // Classes that exist can't be removed from here.
                const fixed = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(v, existingCounts[k] || 0)]));
                setGrades(g); setClassCounts(fixed); setDirty(true);
              }} />
            <Hint>הוספת כיתות יוצרת אותן מיד בשמירה. כיתות קיימות לא נמחקות מכאן כי משויכים אליהן תלמידים.</Hint>
          </div>
        )}
        {tab === "subjects" && <SubjectsEditor value={subjects} onChange={touch(setSubjects)} schoolGrades={grades} uploaderId={profile.id} />}
        {tab === "staff" && (
          <div className="space-y-6">
            <section className="space-y-2"><h3 className="font-heading text-[16px] font-black">חדרים</h3><RoomsEditor value={rooms} onChange={touch(setRooms)} /></section>
            <section className="space-y-2">
              <h3 className="font-heading text-[16px] font-black">מורים</h3>
              <TeachersEditor value={teachers} onChange={touch(setTeachers)} subjects={subjects.map((s) => s.name)} />
              {teachers.some((t) => t.linked) && <Hint>{teachers.filter((t) => t.linked).length} מהמורים כבר נרשמו למערכת.</Hint>}
            </section>
          </div>
        )}
        {tab === "roles" && (
          <div className="space-y-6">
            <RolesEditor builtin={enabledRoles} custom={customRoles} onChange={(b, c) => { setEnabledRoles(b); setCustomRoles(c); setDirty(true); }} />
            <CustomRoleMembers schoolId={schoolId} roles={customRoles.filter((r) => r.id)} dirty={dirty} />
          </div>
        )}
        {tab === "constraints" && <ConstraintsEditor value={constraints} onChange={touch(setConstraints)} />}
        {tab === "attendance" && (attendanceEvents
          ? <AttendanceEventsEditor value={attendanceEvents} onChange={touch(setAttendanceEvents)} />
          : <Hint>רשימת אירועי הנוכחות עדיין לא זמינה בבית הספר הזה.</Hint>)}
        {tab === "imports" && <ImportsTab schoolId={schoolId} userId={profile.id} />}
        {tab === "names" && <DisplayNamesManager profile={profile} />}
      </div>
    </motion.div>
  );
};

/* ── Assign custom roles to staff ─────────────────────── */
function CustomRoleMembers({ schoolId, roles, dirty }: { schoolId: string; roles: CustomRoleDraft[]; dirty: boolean }) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([]);
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [pick, setPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data: profs } = await supabase.from("profiles").select("id, full_name, display_name").eq("school_id", schoolId).eq("is_approved", true);
    const ids = (profs || []).map((p) => p.id);
    const { data: roleRows } = ids.length ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids) : { data: [] as any[] };
    const staffIds = new Set((roleRows || []).filter((r: any) => r.role !== "student" && r.role !== "parent").map((r: any) => r.user_id));
    setStaff((profs || []).filter((p) => staffIds.has(p.id)).sort((a, b) => (displayName(a) || "").localeCompare(displayName(b) || "", "he")));
    if (roles.length) {
      const { data: m } = await db.from("school_custom_role_members").select("role_id, user_id").in("role_id", roles.map((r) => r.id));
      const map: Record<string, string[]> = {};
      for (const row of m || []) (map[row.role_id] ||= []).push(row.user_id);
      setMembers(map);
    }
  }, [schoolId, roles.map((r) => r.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const setMember = async (roleId: string, userId: string, assign: boolean) => {
    const { error } = await supabase.rpc("set_custom_role_member" as any, { p_role_id: roleId, p_user_id: userId, p_assign: assign });
    if (error) { toast({ title: "השיבוץ נכשל", description: error.message, variant: "destructive" }); return; }
    setMembers((m) => ({ ...m, [roleId]: assign ? [...(m[roleId] || []), userId] : (m[roleId] || []).filter((x) => x !== userId) }));
  };

  if (!roles.length) return null;
  const nameOf = (id: string) => displayName(staff.find((s) => s.id === id), "…");
  return (
    <section className="space-y-3 border-t border-border/60 pt-4">
      <h3 className="font-heading text-[16px] font-black">שיבוץ לתפקידים</h3>
      {dirty && <Hint>שמרו קודם את השינויים בתפקידים, ואז שבצו.</Hint>}
      {roles.map((r) => (
        <div key={r.id} className="space-y-2 rounded-[16px] border border-border/70 p-3">
          <p className="font-heading text-[14px] font-bold">{r.name}</p>
          <p className="font-body text-[11.5px] text-muted-foreground">{r.areas.map((a) => ROLE_AREAS.find((x) => x.value === a)?.label || a).join(" · ") || "ללא הרשאות"}</p>
          <div className="flex flex-wrap gap-1.5">
            {(members[r.id!] || []).map((uid) => (
              <span key={uid} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-body text-[12px] font-bold">
                {nameOf(uid)}
                <button type="button" onClick={() => setMember(r.id!, uid, false)} aria-label="הסרה מהתפקיד"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={pick[r.id!] || ""} onValueChange={(v) => setPick((p) => ({ ...p, [r.id!]: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="בחירת איש/ת צוות" /></SelectTrigger>
              <SelectContent>
                {staff.filter((s) => !(members[r.id!] || []).includes(s.id)).map((s) => <SelectItem key={s.id} value={s.id}>{displayName(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9 gap-1" disabled={!pick[r.id!] || dirty} onClick={() => { setMember(r.id!, pick[r.id!], true); setPick((p) => ({ ...p, [r.id!]: "" })); }}>
              <UserPlus className="h-4 w-4" />שיבוץ
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ── History imports ──────────────────────────────────── */
function ImportsTab({ schoolId, userId }: { schoolId: string; userId: string }) {
  const { toast } = useToast();
  const [files, setFiles] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; linked: number; grades: number; behavior: number } | null>(null);
  const [kind, setKind] = useState<"grades" | "behavior">("grades");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await db.from("school_imports").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
    setFiles(data || []);
    const count = (q: any) => q.then((r: any) => r.count || 0);
    const base = () => db.from("student_history_records").select("id", { count: "exact", head: true }).eq("school_id", schoolId);
    const [total, linked, grades, behavior] = await Promise.all([
      count(base()), count(base().not("student_id", "is", null)), count(base().eq("record_type", "grade")), count(base().eq("record_type", "behavior")),
    ]);
    setStats({ total, linked, grades, behavior });
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setBusy("upload");
    try {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await supabase.storage.from("school-imports").upload(path, file);
      if (up.error) throw up.error;
      const { data, error } = await db.from("school_imports").insert({ school_id: schoolId, kind, file_path: path, file_name: file.name }).select("*").single();
      if (error) throw error;
      await process(data);
    } catch (e: any) {
      toast({ title: "ההעלאה נכשלה", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const process = async (f: any) => {
    if (f.kind !== "grades" && f.kind !== "behavior") {
      toast({ title: "הקובץ נשמר", description: "רק קבצי ציונים והתנהגות נקלטים אוטומטית." });
      load();
      return;
    }
    setBusy(f.id);
    try {
      const dl = await supabase.storage.from("school-imports").download(f.file_path);
      if (dl.error) throw dl.error;
      const { rows, warnings } = await parseHistoryFile(dl.data, f.file_name, f.kind);
      if (!rows.length) throw new Error(warnings.join(" · ") || "לא נמצאו שורות");
      // Re-processing a file replaces its earlier rows.
      await db.from("student_history_records").delete().eq("import_id", f.id);
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await db.from("student_history_records").insert(rows.slice(i, i + 500).map((r) => ({ ...r, school_id: schoolId, import_id: f.id })));
        if (error) throw error;
      }
      const { data: linked } = await supabase.rpc("link_student_history" as any, { p_school_id: schoolId });
      await db.from("school_imports").update({ status: "processed", row_count: rows.length, processed_at: new Date().toISOString(), error: null }).eq("id", f.id);
      toast({ title: `נקלטו ${rows.length} שורות`, description: `${linked ?? 0} שויכו לתלמידים רשומים${warnings.length ? ` · ${warnings.join(" · ")}` : ""}` });
    } catch (e: any) {
      await db.from("school_imports").update({ status: "failed", error: e.message }).eq("id", f.id);
      toast({ title: "הקליטה נכשלה", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
      load();
    }
  };

  const relink = async () => {
    setBusy("link");
    const { data, error } = await supabase.rpc("link_student_history" as any, { p_school_id: schoolId });
    setBusy(null);
    if (error) toast({ title: "השיוך נכשל", description: error.message, variant: "destructive" });
    else toast({ title: `${data ?? 0} שורות שויכו לתלמידים` });
    load();
  };

  return (
    <div className="space-y-4">
      <Hint>
        ייבוא ציונים משנים קודמות ורקורד התנהגות (Excel או CSV). כל שורה משויכת לתלמיד/ה לפי ת״ז, או לפי שם מלא כשאין ת״ז.
        תלמידים שיירשמו בהמשך ישויכו בלחיצה על ״שיוך מחדש״. ההיסטוריה מופיעה בדוח התלמיד/ה.
      </Hint>
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["רשומות", stats.total], ["משויכות", stats.linked], ["ציונים", stats.grades], ["התנהגות", stats.behavior]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="font-heading text-[22px] font-black leading-none">{v}</p>
              <p className="mt-1 font-body text-[11px] font-bold text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {([["grades", "ציונים"], ["behavior", "התנהגות"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={cn("rounded-full border-2 px-3 py-1.5 font-body text-[12.5px] font-bold", kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
            {l}
          </button>
        ))}
        <label className={cn("flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-body text-[13px] font-bold text-primary-foreground", busy && "pointer-events-none opacity-60")}>
          {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}העלאה וקליטה
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </label>
        <Button size="sm" variant="outline" className="rounded-full" disabled={!!busy || !stats?.total} onClick={relink}>שיוך מחדש</Button>
      </div>
      <p className="font-body text-[11.5px] text-muted-foreground">
        עמודות שמזוהות: ת״ז, שם (או שם פרטי + משפחה), שכבה/כיתה, שנה, מקצוע, ציון, הערה, תאריך. גיליון עם עמודה לכל מקצוע נקלט גם הוא.
      </p>
      {files.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-[16px] border border-border/70">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileSpreadsheet className={cn("h-5 w-5 shrink-0", f.status === "processed" ? "text-success" : f.status === "failed" ? "text-destructive" : "text-muted-foreground")} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[13.5px] font-bold">{f.file_name}</p>
                <p className="truncate font-body text-[11.5px] text-muted-foreground">
                  {f.kind === "grades" ? "ציונים" : f.kind === "behavior" ? "התנהגות" : f.kind} ·{" "}
                  {f.status === "processed" ? `נקלטו ${f.row_count} שורות` : f.status === "failed" ? `נכשל: ${f.error}` : "ממתין לקליטה"}
                </p>
              </div>
              <Button size="sm" variant={f.status === "processed" ? "ghost" : "default"} disabled={!!busy} onClick={() => process(f)}>
                {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : f.status === "processed" ? "קליטה מחדש" : "קליטה"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SchoolSettingsPage;
