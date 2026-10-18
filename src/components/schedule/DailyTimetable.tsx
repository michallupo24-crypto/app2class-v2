import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer as Sheet } from "vaul";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/hooks/useAuth";
import { HEBREW_DAYS } from "@/lib/constants";
import { useSchoolDays } from "@/hooks/useSchoolDays";
import { formatClassName } from "@/hooks/useStudentDay";
import { SubjectSticker, subjectColor, subjectStickerId } from "@/components/SubjectSticker";
import { PillSwitch } from "@/components/home/HomeKit";
import { cn } from "@/lib/utils";

interface TimetableSlot {
  id: string;
  day_of_week: number;
  lesson_number: number;
  subject: string;
  teacher_name: string | null;
  group_name: string | null;
  color: string;
  room: string | null;
  class_id?: string;
}

interface BellSlot {
  lesson_number: number;
  label: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  break_duration_minutes: number | null;
}

interface StudentTrack {
  track_type: string;
  track_name: string;
}

interface WeekEvent {
  id: string;
  event_date: string;
  title: string;
  event_type: string;
  subject: string | null;
  start_time: string | null;
}

interface DailyTimetableProps {
  profile: UserProfile;
  /** Controlled day/week view; when set, the page renders the switch in its own header. */
  view?: "day" | "week";
  onViewChange?: (v: "day" | "week") => void;
  /** Reports the header subtitle ("י׳-1 · 11–15 באוקטובר") so the page header can show it. */
  onSubtitle?: (subtitle: string) => void;
}

// Event stickers on a lesson: exams in orange, submissions in yellow.
const EVENT_STYLE: Record<string, { bg: string; ink: string; dot: string; kind: string }> = {
  exam: { bg: "#FFE1D6", ink: "#A8320F", dot: "#F0572A", kind: "מבחן" },
  bagrut: { bg: "#FFE1D6", ink: "#A8320F", dot: "#F0572A", kind: "בגרות" },
  quiz: { bg: "#FFE1D6", ink: "#A8320F", dot: "#F0572A", kind: "בוחן" },
  deadline: { bg: "#FFF0C2", ink: "#7A5200", dot: "#F2A007", kind: "הגשה" },
};
const isExamType = (t: string) => ["exam", "bagrut", "quiz"].includes(t);

const HEB_MONTHS = ["בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני", "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"];
const SHORT_DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const hx = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (a: number[]) => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const shade = (h: string, f: number) => (h?.startsWith("#") && h.length === 7 ? toHex(hx(h).map((v) => v * f)) : h);
const mix = (a: string, b: string, t: number) => { const x = hx(a), y = hx(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Hero art for moments that aren't a lesson (break, free period, day over), from the mockup. */
function MomentSticker({ kind }: { kind: "apple" | "cloud" | "moon" }) {
  const art = {
    apple: { c: "#F25A4A", sil: <><path d="M50 32 C40 22 14 24 14 52 C14 76 34 94 50 87 C66 94 86 76 86 52 C86 24 60 22 50 32Z" fill="#F25A4A" /><rect x={46} y={12} width={7} height={20} rx={3.5} fill="#7A4A22" /><path d="M54 22 C60 8 76 8 80 14 C74 24 62 26 54 22Z" fill="#27B06B" /></>, det: <ellipse cx={32} cy={46} rx={6} ry={10} fill={mix("#F25A4A", "#FFFFFF", 0.5)} transform="rotate(20 32 46)" /> },
    cloud: { c: "#A9B6D3", sil: <path d="M26 80 A18 18 0 0 1 22 45 A22 22 0 0 1 62 32 A20 20 0 0 1 84 58 A12 12 0 0 1 80 80Z" fill="#A9B6D3" />, det: <text x={54} y={70} textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight={900} fontSize={24} fill="#fff">zz</text> },
    moon: { c: "#8E9BD6", sil: <><path d="M64 10 A40 40 0 1 0 90 66 A32 32 0 0 1 64 10Z" fill="#8E9BD6" /><polygon points="78,16 81,24 89,25 83,30 85,38 78,34 71,38 73,30 67,25 75,24" fill="#FBBE24" /></>, det: <><circle cx={34} cy={46} r={6} fill={mix("#8E9BD6", "#FFFFFF", 0.5)} /><circle cx={48} cy={70} r={4} fill={mix("#8E9BD6", "#FFFFFF", 0.5)} /></> },
  }[kind];
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 2.5px 2.5px rgba(40,30,15,.22))" }}>
      <g stroke="#fff" strokeWidth={14} strokeLinejoin="round" fill="#fff">{art.sil}</g>
      <g>{art.sil}</g>
      <g>{art.det}</g>
    </svg>
  );
}

// Lesson icon as in the Timetable v2 mockup: the subject's free-form sticker
// (a letter badge in the subject color when there is no artwork).
function LessonIcon({ subject, size, flat, tilt, className }: { subject: string; size: number; flat?: boolean; tilt?: boolean; className?: string }) {
  return <SubjectSticker subject={subject} size={size} flat={flat} tilt={tilt} className={className} />;
}

const DailyTimetable = ({ profile, view: viewProp, onViewChange, onSubtitle }: DailyTimetableProps) => {
  const navigate = useNavigate();
  const SCHOOL_DAYS = useSchoolDays(profile.schoolId);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [bell, setBell] = useState<BellSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"my" | "class">("my");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; grade: string; number: number }[]>([]);
  const [studentTracks, setStudentTracks] = useState<StudentTrack[]>([]);
  const [studentClass, setStudentClass] = useState<{ id: string; grade: string; number: number } | null>(null);
  const [events, setEvents] = useState<WeekEvent[]>([]);
  const [ownView, setOwnView] = useState<"day" | "week">("day");
  const view = viewProp ?? ownView;
  const setView = (v: "day" | "week") => (onViewChange ? onViewChange(v) : setOwnView(v));
  const [selected, setSelected] = useState<{ day: number; lesson: number } | null>(null);
  const [now, setNow] = useState(new Date());
  const [currentDay, setCurrentDay] = useState(() => {
    const d = new Date().getDay();
    return d >= 0 && d <= 4 ? d : 0;
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!SCHOOL_DAYS.includes(currentDay)) setCurrentDay(SCHOOL_DAYS[0] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SCHOOL_DAYS.join(",")]);

  const isStudent = profile.roles.includes("student");
  const isParent = profile.roles.includes("parent");
  const isTeacher = profile.roles.some(r => ["educator", "professional_teacher", "subject_coordinator"].includes(r));
  const isCoordinator = profile.roles.includes("grade_coordinator");
  const isAdmin = profile.roles.some(r => ["management", "system_admin"].includes(r));
  const teacherOwnView = isTeacher && viewMode === "my";

  // Load bell schedule (including breaks)
  useEffect(() => {
    if (!profile.schoolId) return;
    supabase.from("bell_schedule")
      .select("*")
      .eq("school_id", profile.schoolId)
      .order("lesson_number", { ascending: true })
      .then(({ data }) => {
        if (data) setBell(data.map((b: any) => ({
          lesson_number: b.lesson_number,
          label: b.label,
          start_time: b.start_time?.slice(0, 5),
          end_time: b.end_time?.slice(0, 5),
          is_break: b.is_break,
          break_duration_minutes: b.break_duration_minutes,
        })));
      });
  }, [profile.schoolId]);

  useEffect(() => {
    if (!isStudent && !isParent) return;
    const load = async () => {
      let studentId = profile.id;
      if (isParent) {
        const { data: links } = await supabase.from("parent_student").select("student_id").eq("parent_id", profile.id).limit(1);
        if (links?.[0]) studentId = links[0].student_id;
      }
      const { data } = await supabase.from("student_tracks").select("track_type, track_name").eq("user_id", studentId);
      if (data) setStudentTracks(data as StudentTrack[]);
    };
    load();
  }, [profile.id, isStudent, isParent]);

  useEffect(() => {
    if (!profile.schoolId || (!isCoordinator && !isAdmin && !isTeacher)) return;
    const load = async () => {
      if (isTeacher && !isCoordinator && !isAdmin) {
        const { data } = await supabase.from("teacher_classes")
          .select("class_id, classes(id, grade, class_number)")
          .eq("user_id", profile.id);
        if (data) setClasses(data.map((d: any) => ({ id: d.classes.id, grade: d.classes.grade, number: d.classes.class_number })));
      } else {
        const { data } = await supabase.from("classes")
          .select("id, grade, class_number")
          .eq("school_id", profile.schoolId!)
          .order("grade").order("class_number");
        if (data) setClasses(data.map((d: any) => ({ id: d.id, grade: d.grade, number: d.class_number })));
      }
    };
    load();
  }, [profile.schoolId, profile.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let classId: string | null = null;

      if (viewMode === "class" && selectedClassId) {
        classId = selectedClassId;
      } else if (isStudent || isParent) {
        let studentId = profile.id;
        if (isParent) {
          const { data: links } = await supabase.from("parent_student").select("student_id").eq("parent_id", profile.id).limit(1);
          if (links?.[0]) studentId = links[0].student_id;
        }
        const { data: p } = await supabase.from("profiles").select("class_id, classes(id, grade, class_number)").eq("id", studentId).single();
        classId = p?.class_id || null;
        const cls = (p as any)?.classes;
        if (cls) setStudentClass({ id: cls.id, grade: cls.grade, number: cls.class_number });
      } else if (isTeacher && viewMode === "my") {
        const { data: byTeacherId } = await supabase.from("timetable_slots")
          .select("*")
          .eq("school_id", profile.schoolId!)
          .eq("teacher_id", profile.id)
          .order("day_of_week").order("lesson_number");

        if (byTeacherId && byTeacherId.length > 0) {
          setSlots(byTeacherId);
          setLoading(false);
          return;
        }

        const { data: tc } = await supabase.from("teacher_classes")
          .select("class_id")
          .eq("user_id", profile.id);
        if (tc && tc.length > 0) {
          const classIds = tc.map((t: any) => t.class_id);
          const { data: roleData } = await supabase.from("user_roles")
            .select("subject")
            .eq("user_id", profile.id)
            .not("subject", "is", null)
            .limit(1);
          const teacherSubject = roleData?.[0]?.subject;

          let query = supabase.from("timetable_slots")
            .select("*")
            .eq("school_id", profile.schoolId!)
            .in("class_id", classIds)
            .order("day_of_week").order("lesson_number");
          if (teacherSubject) {
            query = query.eq("subject", teacherSubject);
          }
          const { data: byClass } = await query;
          setSlots(byClass || []);
        } else {
          setSlots([]);
        }
        setLoading(false);
        return;
      }

      if (!classId && !selectedClassId) {
        setSlots([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase.from("timetable_slots")
        .select("*")
        .eq("school_id", profile.schoolId!)
        .eq("class_id", classId || selectedClassId!)
        .order("day_of_week").order("lesson_number");
      setSlots(data || []);
      setLoading(false);
    };
    load();
  }, [profile.id, profile.schoolId, viewMode, selectedClassId]);

  // This week's dates (Sunday-based).
  const weekStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [now.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps
  const dateOf = useCallback((dow: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dow);
    return d;
  }, [weekStart]);

  // Approved exams / submissions this week for the shown class's grade.
  const eventClass = viewMode === "class" && selectedClassId ? classes.find((c) => c.id === selectedClassId) : studentClass;
  useEffect(() => {
    if (!profile.schoolId || !eventClass?.grade) { setEvents([]); return; }
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    supabase.from("grade_events")
      .select("id, event_date, title, event_type, subject, start_time")
      .eq("school_id", profile.schoolId)
      .eq("grade", eventClass.grade as any)
      .eq("status", "approved")
      .gte("event_date", isoDate(weekStart))
      .lte("event_date", isoDate(end))
      .then(({ data }) => setEvents((data || []).filter((e: any) => EVENT_STYLE[e.event_type]) as WeekEvent[]));
  }, [profile.schoolId, eventClass?.grade, weekStart]);

  const pickSlot = useCallback((candidates: TimetableSlot[]): TimetableSlot | undefined => {
    if (candidates.length === 0) return undefined;
    // A track/מגמה or הקבצה block has multiple rows at this slot (one per
    // option/level), distinguished by group_name = the option's subject
    // name (see tryPlaceTrackBlock in timetableGenerator.ts, which sets
    // group_name to that same string regardless of track_type). Match on
    // track_name alone rather than also requiring a specific track_type -
    // track_type varies ('megama', 'megama_a', 'megama_b', 'hakbatza') but
    // track_name is always the compound subject/level string that equals
    // group_name, so filtering on an exact type here only ever excluded
    // real matches instead of narrowing anything.
    if (studentTracks.length > 0) {
      const match = candidates.find(slot =>
        slot.group_name && studentTracks.some(t => t.track_name === slot.group_name)
      );
      if (match) return match;
    }
    const ungrouped = candidates.find(s => !s.group_name);
    if (ungrouped) return ungrouped;
    if ((isAdmin || isCoordinator || isTeacher) && candidates.length > 0) {
      return { ...candidates[0], subject: "מגמה/בחירה", teacher_name: null, room: null };
    }
    return undefined;
  }, [studentTracks, isAdmin, isCoordinator, isTeacher]);

  const lessonBells = useMemo(() => bell.filter((b) => !b.is_break).sort((a, b) => a.start_time.localeCompare(b.start_time)), [bell]);
  const breakBells = useMemo(() => bell.filter((b) => b.is_break), [bell]);
  // Week grid columns: one per lesson, plus a thin gap wherever a break follows (as in the mockup).
  const weekCols = useMemo(() => {
    const sorted = [...bell].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const cols: { kind: "lesson" | "gap"; key: string; bell?: BellSlot }[] = [];
    sorted.forEach((b, i) => {
      if (b.is_break) return;
      cols.push({ kind: "lesson", key: `l${b.lesson_number}`, bell: b });
      const next = sorted[i + 1];
      if (next?.is_break && sorted.slice(i + 2).some((x) => !x.is_break)) cols.push({ kind: "gap", key: `g${b.lesson_number}` });
    });
    return cols;
  }, [bell]);

  const getSlot = useCallback(
    (day: number, lessonNum: number) => pickSlot(slots.filter((s) => s.day_of_week === day && s.lesson_number === lessonNum)),
    [slots, pickSlot]
  );

  // An event belongs to a lesson that day by start time, else by subject.
  const eventFor = useCallback((day: number, lessonNum: number) => {
    const date = isoDate(dateOf(day));
    const b = lessonBells.find((x) => x.lesson_number === lessonNum);
    const slot = getSlot(day, lessonNum);
    const sameDay = events.filter((e) => e.event_date === date);
    return (
      sameDay.find((e) => b && e.start_time?.slice(0, 5) === b.start_time) ||
      sameDay.find((e) => slot && e.subject && slot.subject.startsWith(e.subject) &&
        lessonBells.find((x) => getSlot(day, x.lesson_number)?.subject.startsWith(e.subject!))?.lesson_number === lessonNum)
    );
  }, [events, dateOf, lessonBells, getSlot]);

  const classLabel = (slot: TimetableSlot) => {
    const c = classes.find((x) => x.id === slot.class_id);
    return c ? formatClassName(c.grade, c.number) : null;
  };
  const slotMeta = (slot: TimetableSlot) =>
    [teacherOwnView ? classLabel(slot) : slot.teacher_name, slot.room && (/^\d/.test(slot.room) ? `חדר ${slot.room}` : slot.room), slot.group_name]
      .filter(Boolean).join(" · ");
  // Known subjects always use their palette color (as in the mockup): the timetable
  // builder stores a generic gray in slot.color, which turned the hero card gray.
  const colorOf = (slot: TimetableSlot) => (subjectStickerId(slot.subject) ? subjectColor(slot.subject) : slot.color || subjectColor(slot.subject));

  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nowMin = timeToMinutes(nowTime);
  const todayDow = now.getDay();
  const isSchoolDay = SCHOOL_DAYS.includes(todayDow);

  const lessonsOn = useCallback(
    (day: number) => lessonBells.filter((b) => getSlot(day, b.lesson_number)),
    [lessonBells, getSlot]
  );

  const stateOf = (day: number, b: BellSlot): "past" | "now" | "future" => {
    if (day !== todayDow) return day < todayDow && isSchoolDay ? "past" : "future";
    return nowTime >= b.end_time ? "past" : nowTime >= b.start_time ? "now" : "future";
  };
  const progress = (b: BellSlot) => `${Math.round(((nowMin - timeToMinutes(b.start_time)) / (timeToMinutes(b.end_time) - timeToMinutes(b.start_time))) * 100)}%`;

  // ── The "now" hero (today only) ────────────────────────────────────────────
  const hero = (() => {
    if (!isSchoolDay || loading) return null;
    const today = lessonsOn(todayDow);
    if (today.length === 0) return null;
    const first = today[0], last = today[today.length - 1];
    const lessonName = (b: BellSlot) => getSlot(todayDow, b.lesson_number)!;
    const nextAfter = (b?: BellSlot) => today.find((x) => !b || x.start_time > b.start_time);
    const nextText = (b: BellSlot) => {
      const n = nextAfter(b);
      if (!n) return "זה השיעור האחרון להיום.";
      const s = lessonName(n), ev = eventFor(todayDow, n.lesson_number);
      const brk = breakBells.find((x) => x.start_time >= b.end_time && x.end_time <= n.start_time);
      return `אחר כך: ${brk ? `${brk.label || "הפסקה"}, ואז ` : ""}${s.subject}${s.room ? ` ב${/^\d/.test(s.room) ? `חדר ${s.room}` : s.room}` : ""} ב-${n.start_time}${ev ? ` · ${ev.title}` : ""}.`;
    };

    if (nowTime < first.start_time) {
      const s = lessonName(first);
      const exams = today.map((b) => eventFor(todayDow, b.lesson_number)).filter((e): e is WeekEvent => !!e && isExamType(e.event_type));
      return { bg: shade(colorOf(s), 0.84), icon: <LessonIcon subject={s.subject} size={76} className="h-full w-full" />, tag: "בוקר טוב", title: s.subject,
        meta: ["השיעור הראשון", slotMeta(s)].filter(Boolean).join(" · "), big: timeToMinutes(first.start_time) - nowMin, bigLabel: "דק׳ להתחלה", prog: null,
        next: `היום ${today.length} שיעורים, עד ${last.end_time}${exams.length ? `. ${exams.map((e) => e.title).join(", ")}` : ""}.` };
    }
    if (nowTime >= last.end_time) {
      const tomorrow = SCHOOL_DAYS.find((d) => d > todayDow);
      const tb = tomorrow !== undefined ? lessonsOn(tomorrow)[0] : undefined;
      const ts = tb && tomorrow !== undefined ? getSlot(tomorrow, tb.lesson_number) : undefined;
      return { bg: "#2B3350", icon: <MomentSticker kind="moon" />, tag: `סוף היום · ${last.end_time}`, title: "היום הסתיים",
        meta: tb && ts ? `מחר מתחילים ב-${tb.start_time} ב${ts.subject}${ts.room ? `, ${/^\d/.test(ts.room) ? `חדר ${ts.room}` : ts.room}` : ""}.` : "נתראה ביום הלימודים הבא.",
        big: null, bigLabel: "", prog: null, next: null };
    }
    const cur = today.find((b) => nowTime >= b.start_time && nowTime < b.end_time);
    if (cur) {
      const s = lessonName(cur);
      return { bg: shade(colorOf(s), 0.84), icon: <LessonIcon subject={s.subject} size={76} className="h-full w-full" />, tag: `עכשיו · שיעור ${cur.lesson_number}`,
        title: s.subject, meta: slotMeta(s), big: timeToMinutes(cur.end_time) - nowMin, bigLabel: "דק׳ נותרו", prog: progress(cur), next: nextText(cur),
        onClick: () => navigate(`/dashboard/subjects/${encodeURIComponent(s.subject)}?tab=live`) };
    }
    // Between lessons: a bell slot without a lesson is a free period, otherwise a break.
    const n = nextAfter(today.filter((b) => b.end_time <= nowTime).pop());
    if (!n) return null;
    const prevEnd = today.filter((b) => b.end_time <= nowTime).pop()?.end_time ?? nowTime;
    const freeBell = lessonBells.find((b) => nowTime >= b.start_time && nowTime < b.end_time);
    const brk = breakBells.find((b) => nowTime >= b.start_time && nowTime < b.end_time);
    const s = lessonName(n), ev = eventFor(todayDow, n.lesson_number);
    const span = timeToMinutes(n.start_time) - timeToMinutes(prevEnd);
    return { bg: freeBell ? "#5D6B8A" : "#D2582A", icon: <MomentSticker kind={freeBell ? "cloud" : "apple"} />,
      tag: freeBell ? `חלון · שיעור ${freeBell.lesson_number}` : "עכשיו", title: freeBell ? "שעה פנויה" : brk?.label || "הפסקה", meta: `עד ${n.start_time}`,
      big: timeToMinutes(n.start_time) - nowMin, bigLabel: "דק׳ נותרו",
      prog: span > 0 ? `${Math.round(((nowMin - timeToMinutes(prevEnd)) / span) * 100)}%` : null,
      next: `הבא: ${[s.subject, slotMeta(s), ev?.title].filter(Boolean).join(" · ")}` };
  })();

  // ── Day rows: lessons, free periods and breaks between the first and last lesson ──
  const dayRows = useMemo(() => {
    const lessons = lessonsOn(currentDay);
    if (lessons.length === 0) return [];
    const first = lessons[0].start_time, last = lessons[lessons.length - 1].end_time;
    return bell
      .filter((b) => b.start_time >= first && b.end_time <= last)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((b) => ({ bell: b, slot: b.is_break ? undefined : getSlot(currentDay, b.lesson_number) }));
  }, [bell, currentDay, lessonsOn, getSlot]);

  const dayLessons = lessonsOn(currentDay);
  const subtitle = [
    teacherOwnView ? "המערכת שלי" : eventClass ? formatClassName(eventClass.grade, eventClass.number) : null,
    `${dateOf(SCHOOL_DAYS[0] ?? 0).getDate()}–${dateOf(SCHOOL_DAYS[SCHOOL_DAYS.length - 1] ?? 4).getDate()} ${HEB_MONTHS[dateOf(SCHOOL_DAYS[SCHOOL_DAYS.length - 1] ?? 4).getMonth()]}`,
  ].filter(Boolean).join(" · ");
  useEffect(() => { onSubtitle?.(subtitle); }, [subtitle, onSubtitle]);

  const sel = selected ? { ...selected, slot: getSlot(selected.day, selected.lesson), bell: lessonBells.find((b) => b.lesson_number === selected.lesson), ev: eventFor(selected.day, selected.lesson) } : null;

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Header: week range + day/week switch (unless the page shows them), and the staff view controls */}
      {(!viewProp || isTeacher || isCoordinator || isAdmin) && (
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        {!viewProp && <div className="font-body text-[13px] font-semibold text-muted-foreground">{subtitle}</div>}
        <div className="flex flex-wrap items-center gap-2">
          {(isTeacher || isCoordinator || isAdmin) && (
            <>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isTeacher && <SelectItem value="my">שלי</SelectItem>}
                  <SelectItem value="class">כיתה</SelectItem>
                </SelectContent>
              </Select>
              {viewMode === "class" && classes.length > 0 && (
                <Select value={selectedClassId || ""} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="w-28"><SelectValue placeholder="בחר/י כיתה" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{formatClassName(c.grade, c.number)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
          {!viewProp && <PillSwitch options={[{ value: "day", label: "יום" }, { value: "week", label: "שבוע" }]} value={view} onChange={setView} />}
        </div>
      </div>
      )}

      {hero && (
        <div
          onClick={hero.onClick}
          role={hero.onClick ? "button" : undefined}
          className={cn("relative mx-1 mb-1 mt-3.5 flex max-w-2xl flex-col gap-3.5 rounded-[26px] border-[5px] border-white px-5 pb-[18px] pt-5 text-white -rotate-[1.2deg] dark:border-card", hero.onClick && "cursor-pointer")}
          style={{ background: hero.bg, boxShadow: `0 14px 26px -14px ${hero.bg}, 0 2px 0 rgba(27,35,51,.06)` }}
        >
          <div className="absolute -top-[30px] left-3.5 h-[76px] w-[76px]">{hero.icon}</div>
          <div className="flex flex-col gap-[7px] pl-[76px]">
            <span className="self-start rounded-full bg-white/20 px-2.5 py-[5px] font-body text-xs font-extrabold">{hero.tag}</span>
            <div className="font-heading text-[30px] font-black leading-[1.05]">{hero.title}</div>
            {hero.meta && <div className="font-body text-sm font-semibold leading-snug text-white/90">{hero.meta}</div>}
          </div>
          {hero.big !== null && (
            <div className="flex items-center gap-3">
              <div className="flex shrink-0 rotate-2 items-baseline gap-[5px] rounded-[14px] bg-white px-[13px] py-2 shadow-[0_3px_8px_-3px_rgba(0,0,0,0.25)]" style={{ color: hero.bg }}>
                <span className="font-heading text-[22px] font-black leading-none">{hero.big}</span>
                <span className="font-body text-xs font-extrabold leading-none">{hero.bigLabel}</span>
              </div>
              {hero.prog && (
                <div className="h-2 flex-1 overflow-hidden rounded bg-white/30">
                  <div className="h-full rounded bg-white" style={{ width: hero.prog }} />
                </div>
              )}
            </div>
          )}
          {hero.next && (
            <div className="border-t-[1.5px] border-dashed border-white/40 pt-3 font-body text-sm font-bold leading-relaxed">{hero.next}</div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : view === "day" ? (
        <>
          {/* Day cards */}
          <div className="grid max-w-2xl gap-[7px] px-0.5" style={{ gridTemplateColumns: `repeat(${SCHOOL_DAYS.length || 5}, minmax(0, 1fr))` }}>
            {SCHOOL_DAYS.map((d) => {
              const on = d === currentDay;
              const hasExam = events.some((e) => e.event_date === isoDate(dateOf(d)) && isExamType(e.event_type));
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setCurrentDay(d)}
                  aria-pressed={on}
                  className={cn(
                    "flex flex-col items-center gap-[5px] rounded-[18px] border-[3px] border-white pb-2 pt-2.5 transition-transform dark:border-card",
                    on ? "-translate-y-0.5 -rotate-[4deg] bg-primary shadow-[0_8px_14px_-6px_rgba(27,35,51,0.55)]" : "bg-card shadow-[0_4px_10px_-7px_rgba(40,30,15,0.35)]"
                  )}
                >
                  <span className={cn("font-body text-xs font-bold leading-none", on ? "text-[#C9CFDC]" : "text-hint")}>{SHORT_DAYS[d]}</span>
                  <span className={cn("font-heading text-xl font-black leading-none", on ? "text-primary-foreground" : "text-foreground")}>{dateOf(d).getDate()}</span>
                  <span className="flex h-1.5 gap-[3px]">
                    {d === todayDow && <span className="h-1.5 w-1.5 rounded-full bg-[#FBBE24]" />}
                    {hasExam && <span className="h-1.5 w-1.5 rounded-full bg-[#F0572A]" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex max-w-2xl items-baseline justify-between px-1.5">
            <div className="font-heading text-[17px] font-black leading-none text-foreground">{currentDay === todayDow ? "היום, " : ""}יום {HEBREW_DAYS[currentDay]}</div>
            {dayLessons.length > 0 && (
              <div className="font-body text-[13px] font-semibold text-muted-foreground">
                {dayLessons.length} שיעורים · {dayLessons[0].start_time}–{dayLessons[dayLessons.length - 1].end_time}
              </div>
            )}
          </div>

          {dayRows.length === 0 ? (
            <div className="max-w-2xl rounded-[20px] border-[1.5px] border-dashed border-input px-4 py-10 text-center font-body text-sm font-bold text-muted-foreground">
              אין שיעורים ביום {HEBREW_DAYS[currentDay]}
            </div>
          ) : (
            <div className="flex max-w-2xl flex-col gap-2.5">
              {dayRows.map(({ bell: b, slot }) => {
                const st = stateOf(currentDay, b);
                if (b.is_break) {
                  const live = st === "now";
                  const dur = b.break_duration_minutes || timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
                  return (
                    <div key={`b${b.start_time}`} className={cn("flex items-center gap-2.5", st === "past" && "opacity-50")}>
                      <div className="w-[42px] shrink-0 text-center font-body text-[11px] font-bold text-hint" dir="ltr">{b.start_time}</div>
                      <div
                        className="flex h-[34px] flex-1 items-center gap-2 rounded-xl border-[1.5px] px-3"
                        style={{
                          background: live ? "repeating-linear-gradient(-45deg,#FFE7BF 0 8px,#FFF1D6 8px 16px)" : "repeating-linear-gradient(-45deg,#F3EDE2 0 8px,#FAF6EF 8px 16px)",
                          borderColor: live ? "#F5C77E" : "#EAE2D3",
                        }}
                      >
                        <span className="font-body text-[12.5px] font-extrabold" style={{ color: live ? "#7A3A12" : "#5B5548" }}>{live ? "עכשיו · " : ""}{b.label || "הפסקה"}</span>
                        <span className="flex-1" />
                        <span className="font-body text-xs font-bold" style={{ color: live ? "#7A3A12" : "#9A9285" }}>{dur} דק׳</span>
                      </div>
                    </div>
                  );
                }
                const ev = slot ? eventFor(currentDay, b.lesson_number) : undefined;
                const es = ev && EVENT_STYLE[ev.event_type];
                const c = slot ? colorOf(slot) : "#8A93A5";
                return (
                  <div key={`l${b.lesson_number}`} className={cn("flex items-stretch gap-2.5", st === "past" && "opacity-50")}>
                    <div className="flex w-[42px] shrink-0 flex-col items-center justify-center gap-[3px]">
                      <span className="font-body text-[11px] font-bold leading-none text-hint" dir="ltr">{b.start_time}</span>
                      <span className="font-heading text-[17px] font-black leading-none text-foreground">{b.lesson_number}</span>
                      <span className="font-body text-[11px] font-bold leading-none text-hint" dir="ltr">{b.end_time}</span>
                    </div>
                    {slot ? (
                      <button
                        type="button"
                        onClick={() => setSelected({ day: currentDay, lesson: b.lesson_number })}
                        className="relative flex min-h-[66px] min-w-0 flex-1 items-center gap-3 rounded-[20px] bg-card px-3.5 py-3 text-right"
                        style={{ boxShadow: st === "now" ? `0 0 0 3px ${c}, 0 12px 22px -12px ${c}` : "0 6px 16px -10px rgba(40,30,15,.28)" }}
                      >
                        {/* Each subject keeps its own tilt, as in the mockup */}
                        <LessonIcon subject={slot.subject} size={44} tilt />
                        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                          <div className="flex items-center gap-2">
                            <span className="font-heading text-base font-extrabold leading-tight text-foreground">{slot.subject}</span>
                            {st === "now" && <span className="rounded-full px-2 py-1 font-body text-[11px] font-extrabold leading-none text-white" style={{ background: shade(c, 0.8) }}>עכשיו</span>}
                          </div>
                          {slotMeta(slot) && <span className="font-body text-[12.5px] font-semibold leading-snug text-text-secondary">{slotMeta(slot)}</span>}
                          {st === "now" && (
                            <div className="mt-0.5 h-[5px] overflow-hidden rounded-[3px]" style={{ background: `${c}26` }}>
                              <div className="h-full rounded-[3px]" style={{ width: progress(b), background: shade(c, 0.8) }} />
                            </div>
                          )}
                        </div>
                        {ev && es && (
                          <span
                            className="absolute -top-[9px] left-3 rotate-[4deg] rounded-[9px] border-[2.5px] border-white px-[9px] py-[5px] font-body text-[11.5px] font-extrabold leading-none shadow-[0_3px_6px_-3px_rgba(27,35,51,0.35)] dark:border-card"
                            style={{ background: es.bg, color: es.ink }}
                          >
                            {ev.title}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div
                        className="flex min-h-[66px] flex-1 items-center gap-3 rounded-[20px] border-2 border-dashed border-[#D6CDBD] px-3.5"
                        style={{ boxShadow: st === "now" ? "0 0 0 3px #8A93A5" : undefined }}
                      >
                        <div className="h-[38px] w-[38px] shrink-0 -rotate-6"><MomentSticker kind="cloud" /></div>
                        <div className="flex flex-col gap-[3px]">
                          <span className="font-heading text-[15px] font-extrabold leading-none text-text-secondary">חלון</span>
                          <span className="font-body text-[12.5px] font-semibold leading-none text-hint">שעה פנויה</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        // ── Week view: a row of subject tiles per day ──
        <div className="flex max-w-3xl flex-col gap-2.5">
          <div className="flex items-center gap-2.5 px-3">
            <div className="w-10 shrink-0" />
            <div className="flex flex-1 gap-1">
              {weekCols.map((c) => c.kind === "gap" ? (
                <div key={c.key} className="w-1 shrink-0" />
              ) : (
                <div key={c.key} className="flex-1 text-center font-heading text-[11px] font-extrabold text-hint">{c.bell!.lesson_number}</div>
              ))}
            </div>
          </div>
          {SCHOOL_DAYS.map((d) => {
            const isToday = d === todayDow;
            return (
              <button
                key={d}
                type="button"
                onClick={() => { setCurrentDay(d); setView("day"); }}
                className={cn("flex items-center gap-2.5 rounded-[20px] border-[3px] px-3 py-2.5 text-right", isToday ? "-rotate-1 border-[#FBD36B] bg-[#FFF8E6] shadow-[0_10px_20px_-12px_rgba(160,110,10,0.55)] dark:bg-warning-soft" : "border-white bg-card shadow-[0_6px_16px_-11px_rgba(40,30,15,0.3)] dark:border-card")}
              >
                <div className="flex w-10 shrink-0 flex-col items-center gap-[3px]">
                  <span className={cn("font-body text-[11px] font-bold leading-none", isToday ? "text-warning" : "text-hint")}>{SHORT_DAYS[d]}</span>
                  <span className="font-heading text-lg font-black leading-none text-foreground">{dateOf(d).getDate()}</span>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  {weekCols.map((c) => {
                    if (c.kind === "gap") return <div key={c.key} className="w-1 shrink-0" />;
                    const b = c.bell!;
                    const slot = getSlot(d, b.lesson_number);
                    const ev = slot ? eventFor(d, b.lesson_number) : undefined;
                    const st = stateOf(d, b);
                    return (
                      <div key={b.lesson_number} className="flex flex-1">
                        <div
                          className={cn("relative aspect-square flex-1 rounded-[10px]", !slot && "border-[1.5px] border-dashed border-[#DCD3C3]", st === "past" && "opacity-40")}
                          style={{ boxShadow: st === "now" && slot ? "0 0 0 2.5px hsl(var(--foreground))" : undefined }}
                          title={slot?.subject}
                        >
                          {slot && <div className="absolute -inset-0.5"><LessonIcon subject={slot.subject} flat size={40} className="h-full w-full" /></div>}
                          {ev && <span className="absolute -left-1 -top-1 h-[9px] w-[9px] rounded-full border-2 border-white" style={{ background: EVENT_STYLE[ev.event_type].dot }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
          <div className="flex justify-center gap-4 font-body text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F0572A]" />מבחן</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F2A007]" />הגשה</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-dashed border-[#D6CDBD]" />חלון</span>
          </div>
          <div className="text-center font-body text-xs font-semibold text-hint">לחיצה על יום פותחת אותו</div>
        </div>
      )}

      {/* Lesson details: a bottom sheet with a drag handle, as in the mockup */}
      <Sheet.Root open={!!sel?.slot} onOpenChange={(o) => !o && setSelected(null)}>
        <Sheet.Portal>
        <Sheet.Overlay className="fixed inset-0 z-50 bg-[rgba(27,24,18,0.42)]" />
        <Sheet.Content dir="rtl" aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg flex-col gap-4 rounded-t-[30px] bg-background px-[22px] pb-[30px] pt-3 outline-none">
          <div className="h-[5px] w-10 self-center rounded-[3px] bg-[#DCD3C3] dark:bg-border" />
          {sel?.slot && sel.bell && (
            <>
              <div className="flex items-center gap-3.5">
                <div className="-rotate-[7deg]"><LessonIcon subject={sel.slot.subject} size={66} /></div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Sheet.Title className="font-heading text-[25px] font-black leading-[1.05] text-foreground">{sel.slot.subject}</Sheet.Title>
                  <div className="font-body text-sm font-semibold text-muted-foreground">
                    יום {HEBREW_DAYS[sel.day]}, {dateOf(sel.day).getDate()} {HEB_MONTHS[dateOf(sel.day).getMonth()]} · שיעור {sel.bell.lesson_number}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { k: "שעה", v: `${sel.bell.start_time}–${sel.bell.end_time}` },
                  { k: "מקום", v: sel.slot.room ? (/^\d/.test(sel.slot.room) ? `חדר ${sel.slot.room}` : sel.slot.room) : "—" },
                  teacherOwnView ? { k: "כיתה", v: classLabel(sel.slot) || "—" } : { k: "מורה", v: sel.slot.teacher_name || "—" },
                  { k: "קבוצה", v: sel.slot.group_name || "כל הכיתה" },
                ].map((f) => (
                  <div key={f.k} className="flex flex-col gap-1.5 rounded-[16px] bg-card px-3.5 py-3 shadow-[0_4px_12px_-8px_rgba(27,35,51,0.3)]">
                    <span className="font-body text-xs font-bold text-hint">{f.k}</span>
                    <span className="font-heading text-[15px] font-extrabold text-foreground">{f.v}</span>
                  </div>
                ))}
              </div>
              {sel.ev && EVENT_STYLE[sel.ev.event_type] && (
                <div className="flex -rotate-[1.5deg] flex-col gap-1.5 self-start rounded-[14px] border-[3px] border-white px-3.5 py-2.5 shadow-[0_4px_10px_-5px_rgba(27,35,51,0.3)] dark:border-card" style={{ background: EVENT_STYLE[sel.ev.event_type].bg }}>
                  <span className="font-body text-xs font-extrabold" style={{ color: EVENT_STYLE[sel.ev.event_type].ink }}>{EVENT_STYLE[sel.ev.event_type].kind}</span>
                  <span className="font-heading text-base font-extrabold text-foreground">{sel.ev.title}</span>
                </div>
              )}
              {stateOf(sel.day, sel.bell) === "now" && !teacherOwnView && (
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/subjects/${encodeURIComponent(sel.slot!.subject)}?tab=live`)}
                  className="rounded-[16px] border-[3px] border-white p-4 text-center font-body text-base font-extrabold text-white dark:border-card"
                  style={{ background: shade(colorOf(sel.slot), 0.84), boxShadow: `0 8px 16px -8px ${shade(colorOf(sel.slot), 0.84)}` }}
                >
                  כניסה לשיעור החי
                </button>
              )}
              <button type="button" onClick={() => setSelected(null)} className="rounded-[16px] bg-muted p-[15px] text-center font-body text-[15px] font-extrabold text-foreground">
                סגירה
              </button>
            </>
          )}
        </Sheet.Content>
        </Sheet.Portal>
      </Sheet.Root>
    </div>
  );
};

export default DailyTimetable;
