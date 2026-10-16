import { useOutletContext } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Loader2, Sparkles, Cake, Sun, Moon } from "lucide-react";
import ClassMessenger from "@/components/dashboard/ClassMessenger";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/hooks/useAuth";
import { useStudentSubjects, filterEventsBySubjects, personalizeEventTitle } from "@/hooks/useStudentSubjects";
import { useGamification } from "@/hooks/useGamification";
import { useStudentDay } from "@/hooks/useStudentDay";
import { subjectColor } from "@/components/SubjectSticker";
import {
  HomeHeader, HeroCard, HomeSection, HomeColumns, LessonStrip, StatTiles, HomeRow, HomeEmpty, IconTile,
  greeting, longHebrewDate, firstName, type StripLesson, type Tone,
} from "@/components/home/HomeKit";


type GradeEvent = {
  id: string;
  event_date: string;
  title: string;
  event_type: string;
  subject: string | null;
  description: string | null;
  start_time: string | null;
};

type HolidayPeriod = {
  title: string;
  start: string;
  end: string;
  returnDate?: string;
};

type RecentGrade = {
  id: string;
  grade: number;
  graded_at: string | null;
  assignments: { title: string; subject: string | null; max_grade: number | null } | null;
};

const HOLIDAY_PERIODS: HolidayPeriod[] = [
  { title: "ראש השנה", start: "2025-09-22", end: "2025-09-25", returnDate: "2025-09-26" },
  { title: "יום כיפור", start: "2025-10-01", end: "2025-10-04", returnDate: "2025-10-05" },
  { title: "סוכות", start: "2025-10-06", end: "2025-10-18", returnDate: "2025-10-19" },
  { title: "חנוכה", start: "2025-12-16", end: "2025-12-24", returnDate: "2025-12-25" },
  { title: "פורים", start: "2026-03-01", end: "2026-03-03", returnDate: "2026-03-04" },
  { title: "פסח", start: "2026-03-24", end: "2026-04-08", returnDate: "2026-04-09" },
  { title: "יום העצמאות", start: "2026-04-22", end: "2026-04-22", returnDate: "2026-04-23" },
  { title: "ל״ג בעומר", start: "2026-05-05", end: "2026-05-05", returnDate: "2026-05-06" },
  { title: "שבועות", start: "2026-05-21", end: "2026-05-22", returnDate: "2026-05-24" },
  { title: "סיום שנה - על יסודי", start: "2026-06-19", end: "2026-06-19" },
];

const EVENT_TYPE_CONFIG: Record<string, { label: string; tone: Tone }> = {
  exam: { label: "מבחן", tone: "alert" },
  bagrut: { label: "בגרות", tone: "alert" },
  quiz: { label: "בוחן", tone: "alert" },
  deadline: { label: "הגשה", tone: "warning" },
  trip: { label: "טיול", tone: "info" },
  ceremony: { label: "טקס", tone: "neutral" },
  event: { label: "אירוע", tone: "info" },
  other: { label: "אחר", tone: "neutral" },
};

const parseDate = (iso: string) => new Date(`${iso}T12:00:00`);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayDiff = (from: Date, to: Date) => Math.ceil((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);

const examMoment = (event: GradeEvent) => new Date(`${event.event_date}T${event.start_time || "08:00"}`);

const formatCountdown = (from: Date, event: GradeEvent) => {
  const diffMs = examMoment(event).getTime() - from.getTime();
  if (diffMs <= 0) return "היום";
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  if (days >= 2) return `בעוד ${days} ימים`;
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days === 1) return `בעוד יום ו-${hours} שעות`;
  if (hours > 0) return `בעוד ${hours} שע' ו-${minutes} דק'`;
  return `בעוד ${minutes} דקות`;
};

const hebrewDayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const shortDateFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" });

// Hero color when the card isn't about a subject (holiday, day over, ...).
const INK_HERO = "#2B3350";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const StudentDashboard = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();

  const [now, setNow] = useState<Date>(new Date());
  const [gradeEvents, setGradeEvents] = useState<GradeEvent[]>([]);
  const [studentGrade, setStudentGrade] = useState<string | null>(null);
  const [myClassId, setMyClassId] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isBirthday, setIsBirthday] = useState(false);
  const [attendance, setAttendance] = useState<{ total: number; absent: number; late: number; pct: number } | null>(null);
  const [recentGrades, setRecentGrades] = useState<RecentGrade[]>([]);
  const [studyPlan, setStudyPlan] = useState<string | null>(null);
  const [studyPlanLoading, setStudyPlanLoading] = useState(false);
  const { subjects: mySubjects, trackNames, hasMegamaA, hasMegamaB } = useStudentSubjects(profile.id, profile.schoolId);
  const day = useStudentDay(profile.schoolId, profile.id);

  const { badges, streak, recordActivity } = useGamification(profile.id);

  const loadStudyPlan = async (exam: GradeEvent) => {
    setStudyPlanLoading(true);
    setStudyPlan(null);
    try {
      const daysLeft = Math.max(1, dayDiff(startOfDay(now), parseDate(exam.event_date)));
      const { data } = await supabase.functions.invoke("ai-tutor", {
        body: {
          context: "exam_prep",
          subject: exam.subject || exam.title,
          message: String(daysLeft),
          studentId: profile.id,
        },
      });
      setStudyPlan(data?.message || "לא ניתן ליצור תוכנית כרגע");
    } catch {
      setStudyPlan("שגיאה ביצירת תוכנית הלימודים, נסה שוב");
    } finally {
      setStudyPlanLoading(false);
    }
  };

  // Record activity on mount
  useEffect(() => {
    recordActivity();
  }, [recordActivity]);

  // Fetch Jerusalem time, then tick locally so the exam countdown stays live
  useEffect(() => {
    let driftMs = 0;
    const tick = () => setNow(new Date(Date.now() + driftMs));
    tick();
    (async () => {
      try {
        const res = await fetch("https://worldtimeapi.org/api/timezone/Asia/Jerusalem");
        const data = await res.json();
        if (data?.datetime) {
          driftMs = new Date(data.datetime).getTime() - Date.now();
          tick();
        }
      } catch { /* fallback to local */ }
    })();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check birthday
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles").select("*").eq("id", profile.id).single();
      if ((data as any)?.date_of_birth) {
        const dob = new Date((data as any).date_of_birth);
        const today = new Date(now);
        if (dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()) {
          setIsBirthday(true);
        }
      }
    })();
  }, [profile.id, now]);

  // Fetch grade events
  useEffect(() => {
    (async () => {
      if (!profile.schoolId) return;
      const { data: myProfile } = await supabase
        .from("profiles").select("class_id").eq("id", profile.id).single();
      if (!myProfile?.class_id) return;
      setMyClassId(myProfile.class_id);
      const { data: cls } = await supabase
        .from("classes").select("grade").eq("id", myProfile.class_id).single();
      if (!cls?.grade) return;
      setStudentGrade(cls.grade);

      const { data: events } = await supabase
        .from("grade_events")
        .select("id, event_date, title, event_type, subject, description, start_time")
        .eq("school_id", profile.schoolId)
        .eq("grade", cls.grade as any)
        .eq("status", "approved")
        .order("event_date", { ascending: true });
      setGradeEvents(filterEventsBySubjects(events || [], mySubjects, hasMegamaA, hasMegamaB));
    })();

    // Fetch attendance
    (async () => {
      const { data } = await supabase.from("attendance")
        .select("status")
        .eq("student_id", profile.id);
      if (data && data.length > 0) {
        const total = data.length;
        const absent = data.filter(r => r.status === "absent").length;
        const late = data.filter(r => r.status === "late").length;
        setAttendance({ total, absent, late, pct: Math.round((absent/total)*100) });
      }
    })();
  }, [profile.id, profile.schoolId, mySubjects, hasMegamaA, hasMegamaB]);

  // Latest graded submissions
  useEffect(() => {
    supabase
      .from("submissions")
      .select("id, grade, graded_at, assignments(title, subject, max_grade)")
      .eq("student_id", profile.id)
      .not("grade", "is", null)
      .order("graded_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setRecentGrades((data || []) as any));
  }, [profile.id]);

  const todayTs = useMemo(() => startOfDay(now).getTime(), [now]);
  const today = useMemo(() => new Date(todayTs), [todayTs]);

  const weekStart = useMemo(() => {
    const d = new Date(todayTs);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [todayTs]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const thisWeekEvents = useMemo(() => {
    return gradeEvents.filter(e => {
      const d = startOfDay(parseDate(e.event_date));
      return d >= weekStart && d <= weekEnd;
    });
  }, [gradeEvents, weekStart, weekEnd]);

  const activeHoliday = useMemo(() => {
    return HOLIDAY_PERIODS.find(h => {
      const s = startOfDay(parseDate(h.start));
      const e = startOfDay(parseDate(h.end));
      return today >= s && today <= e;
    });
  }, [today]);

  const holidayThisWeek = useMemo(() => {
    return HOLIDAY_PERIODS.find(h => {
      const s = startOfDay(parseDate(h.start));
      const e = startOfDay(parseDate(h.end));
      return (s >= weekStart && s <= weekEnd) || (e >= weekStart && e <= weekEnd) || (s <= weekStart && e >= weekEnd);
    });
  }, [weekStart, weekEnd]);

  const nextExam = useMemo(() => {
    return gradeEvents
      .filter(e => ["exam", "bagrut", "quiz"].includes(e.event_type) && startOfDay(parseDate(e.event_date)) > today)
      .sort((a, b) => parseDate(a.event_date).getTime() - parseDate(b.event_date).getTime())[0];
  }, [gradeEvents, today]);

  // AI Insight - use fetch directly for proper SSE handling
  useEffect(() => {
    if (thisWeekEvents.length === 0 && !activeHoliday && !holidayThisWeek) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    const controller = new AbortController();
    const generateInsight = async () => {
      setAiLoading(true);
      try {
        const eventsText = thisWeekEvents.map(e => {
          const d = parseDate(e.event_date);
          const dayName = hebrewDayNames[d.getDay()];
          return `יום ${dayName} (${shortDateFmt.format(d)}): ${e.title}${e.subject ? ` [${e.subject}]` : ""} (${EVENT_TYPE_CONFIG[e.event_type]?.label || e.event_type})`;
        }).join("\n");

        const holidayText = activeHoliday
          ? `כרגע חופשת ${activeHoliday.title}. חזרה ללימודים: ${activeHoliday.returnDate || "לא ידוע"}.`
          : holidayThisWeek
            ? `השבוע יש חופשת ${holidayThisWeek.title} (${holidayThisWeek.start} עד ${holidayThisWeek.end}).`
            : "";

        const nextExamText = nextExam
          ? `המבחן הקרוב ביותר: ${nextExam.title}${nextExam.subject ? ` ב${nextExam.subject}` : ""} בעוד ${dayDiff(today, parseDate(nextExam.event_date))} ימים.`
          : "";

        const birthdayText = isBirthday ? "היום יום ההולדת של התלמיד/ה! תברך אותו/ה." : "";

        const tracksText = trackNames.length > 0 ? `המגמות שלו/ה: ${trackNames.join(", ")}.` : "";

        const prompt = `אתה עוזר לימודי AI חכם בשם "מנטור". תן תובנה קצרה (2-3 משפטים) לתלמיד/ה בשכבת ${studentGrade || "יא"} על השבוע הקרוב שלו/ה.
${tracksText}

הנה מה שקורה השבוע:
${eventsText || "אין אירועים מתוכננים השבוע."}
${holidayText}
${nextExamText}
${birthdayText}

תן המלצה פרקטית אחת, ספציפית ורלוונטית. אל תפרט יותר מדי. תהיה חם ומעודד. ענה בעברית.`;

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-tutor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": SUPABASE_KEY,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            grade: studentGrade,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("AI error");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let content = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && !line.includes("[DONE]")) {
              try {
                const json = JSON.parse(line.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) content += delta;
              } catch { /* skip */ }
            }
          }
        }

        setAiInsight(content || "שבוע טוב! 📚 בדוק את לוח האירועים שלך לפרטים.");
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setAiInsight("");
        }
      } finally {
        setAiLoading(false);
      }
    };
    generateInsight();
    return () => controller.abort();
  }, [thisWeekEvents, activeHoliday, holidayThisWeek, nextExam, studentGrade, isBirthday, trackNames]);

  // Today's lessons as a strip, with free periods between the first and last lesson.
  const strip = useMemo<StripLesson[]>(() => {
    if (day.today.length === 0) return [];
    const first = day.today[0].lesson_number;
    const last = day.today[day.today.length - 1].lesson_number;
    const t = `${String(day.now.getHours()).padStart(2, "0")}:${String(day.now.getMinutes()).padStart(2, "0")}`;
    return day.bell
      .filter((b) => b.lesson_number >= first && b.lesson_number <= last)
      .map((b) => {
        const lesson = day.today.find((l) => l.lesson_number === b.lesson_number);
        const state = t >= b.end_time ? "past" : t >= b.start_time ? "now" : "upcoming";
        return { subject: lesson?.subject ?? null, time: b.start_time, state };
      });
  }, [day.today, day.bell, day.now]);

  const eventTitle = (e: GradeEvent) => personalizeEventTitle(e.title, e.subject, trackNames);
  const eventMeta = (e: GradeEvent) => {
    const d = parseDate(e.event_date);
    const when = dayDiff(today, d) === 0 ? "היום" : `${hebrewDayNames[d.getDay()]} ${shortDateFmt.format(d)}`;
    return [e.subject, when, e.start_time?.slice(0, 5)].filter(Boolean).join(" · ");
  };
  const eventTag = (e: GradeEvent) => EVENT_TYPE_CONFIG[e.event_type] || EVENT_TYPE_CONFIG.other;

  const todayEvents = thisWeekEvents.filter((e) => dayDiff(today, parseDate(e.event_date)) === 0);
  const laterThisWeek = thisWeekEvents.filter((e) => dayDiff(today, parseDate(e.event_date)) > 0 && e.id !== nextExam?.id);

  // What matters right now.
  const hero = (() => {
    const lessonMeta = (l: { teacher_name: string | null; room: string | null }) =>
      [l.teacher_name, l.room && `חדר ${l.room}`].filter(Boolean).join(" · ");
    const live = (subject: string) => () => navigate(`/dashboard/subjects/${encodeURIComponent(subject)}?tab=live`);

    if (activeHoliday) {
      return { color: "#F0A21A", icon: <IconTile icon={Sun} color="#F2A007" size={92} />, tag: "חופשה", title: `חופשת ${activeHoliday.title}`,
        meta: activeHoliday.returnDate ? `חוזרים ללימודים ב-${shortDateFmt.format(parseDate(activeHoliday.returnDate))}` : undefined };
    }
    if (day.phase === "lesson" && day.current) {
      const l = day.current;
      return { color: l.color || subjectColor(l.subject), subject: l.subject, tag: `עכשיו · שיעור ${l.lesson_number}`, title: l.subject,
        meta: [lessonMeta(l), `${day.minutesLeft} דק׳ נותרו`].filter(Boolean).join(" · "), onClick: live(l.subject) };
    }
    if (day.phase === "break" && day.next) {
      const l = day.next;
      return { color: l.color || subjectColor(l.subject), subject: l.subject, tag: "בהפסקה", title: `הבא: ${l.subject}`,
        meta: [`ב-${l.bellStart}`, lessonMeta(l)].filter(Boolean).join(" · "), onClick: live(l.subject) };
    }
    if (day.phase === "before" && day.next) {
      const l = day.next;
      return { color: l.color || subjectColor(l.subject), subject: l.subject, tag: `היום מתחיל ב-${l.bellStart}`, title: l.subject,
        meta: [`שיעור ${l.lesson_number}`, lessonMeta(l)].filter(Boolean).join(" · ") };
    }
    if (nextExam) {
      return { color: subjectColor(nextExam.subject || nextExam.title), subject: nextExam.subject || undefined, tag: "המבחן הקרוב",
        title: eventTitle(nextExam), meta: formatCountdown(now, nextExam) };
    }
    return { color: INK_HERO, icon: <IconTile icon={Moon} color="#8E9BD6" size={92} />, tag: day.phase === "after" ? "היום הסתיים" : "אין לימודים היום", title: "יום טוב!",
      meta: "אין מבחנים קרובים ביומן" };
  })();

  const presencePct = attendance ? Math.round(((attendance.total - attendance.absent) / attendance.total) * 100) : null;
  // attendance.pct is the absence rate; 15% is the Ministry's red line.
  const presenceTone: Tone = !attendance ? "neutral" : attendance.pct >= 15 ? "danger" : attendance.pct >= 10 ? "warning" : "success";

  const subtitle = [longHebrewDate(now), day.className].filter(Boolean).join(" · ");

  const main = (
    <>
      <HeroCard {...hero} />

      {(aiLoading || aiInsight) && (
        <HomeSection title="תובנת המנטור לשבוע">
          <HomeRow
            icon={<IconTile icon={Brain} color="#9257EC" />}
            title={aiLoading ? "המנטור חושב על השבוע שלך..." : "מה כדאי לעשות השבוע"}
            meta={aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : aiInsight}
          />
        </HomeSection>
      )}

      <HomeSection title="להיום">
        {todayEvents.length === 0 ? (
          <HomeEmpty>{activeHoliday ? "חופש! אין משימות להיום" : "אין הגשות או מבחנים היום. אפשר לנשום"}</HomeEmpty>
        ) : (
          todayEvents.map((e, i) => (
            <HomeRow key={e.id} index={i} subject={e.subject || undefined} title={eventTitle(e)} meta={eventMeta(e)} tag={eventTag(e)} />
          ))
        )}
      </HomeSection>

      {laterThisWeek.length > 0 && (
        <HomeSection title={holidayThisWeek && !activeHoliday ? `השבוע · חופשת ${holidayThisWeek.title}` : "בהמשך השבוע"}>
          {laterThisWeek.map((e, i) => (
            <HomeRow key={e.id} index={i} subject={e.subject || undefined} title={eventTitle(e)} meta={eventMeta(e)} tag={eventTag(e)} />
          ))}
        </HomeSection>
      )}

      <HomeSection title="ציונים אחרונים">
        {recentGrades.length === 0 ? (
          <HomeEmpty>עדיין אין ציונים. הם יופיעו כאן מיד אחרי הבדיקה</HomeEmpty>
        ) : (
          recentGrades.map((g, i) => {
            const max = g.assignments?.max_grade || 100;
            const good = (g.grade / max) * 100 >= 80;
            return (
              <HomeRow
                key={g.id}
                index={i}
                subject={g.assignments?.subject || undefined}
                title={g.assignments?.title || "מטלה"}
                meta={[g.assignments?.subject, g.graded_at && shortDateFmt.format(new Date(g.graded_at))].filter(Boolean).join(" · ")}
                tag={{ label: max === 100 ? String(g.grade) : `${g.grade}/${max}`, tone: good ? "success" : "warning" }}
                onClick={() => navigate("/dashboard/grades")}
              />
            );
          })
        )}
      </HomeSection>

      {myClassId && (
        <HomeSection title="הודעות מהכיתה">
          <ClassMessenger classId={myClassId} userId={profile.id} isTeacher={false} />
        </HomeSection>
      )}
    </>
  );

  const side = (
    <>
      {strip.length > 0 && (
        <HomeSection
          title="היום במערכת"
          action={<button type="button" onClick={() => navigate("/dashboard/timetable")} className="font-body text-[13px] font-extrabold text-link">מערכת מלאה ←</button>}
        >
          <LessonStrip lessons={strip} onClick={() => navigate("/dashboard/timetable")} />
        </HomeSection>
      )}

      <HomeSection title="המבחן הקרוב">
        {nextExam ? (
          <HomeRow
            subject={nextExam.subject || undefined}
            title={eventTitle(nextExam)}
            meta={[eventMeta(nextExam), formatCountdown(now, nextExam)].join(" · ")}
            tag={eventTag(nextExam)}
          >
            {!studyPlan ? (
              <button
                type="button"
                onClick={() => loadStudyPlan(nextExam)}
                disabled={studyPlanLoading}
                className="mt-1 flex items-center gap-1.5 self-start font-body text-[13px] font-extrabold text-link disabled:opacity-60"
              >
                {studyPlanLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                בנה/י לי תוכנית לימודים
              </button>
            ) : (
              <div className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-line rounded-row bg-soft p-3 font-body text-[13px] font-semibold text-text-secondary">
                {studyPlan}
              </div>
            )}
          </HomeRow>
        ) : (
          <HomeEmpty>אין מבחנים קרובים ביומן</HomeEmpty>
        )}
      </HomeSection>

      <HomeSection title="החודש שלי">
        <StatTiles
          size="sm"
          items={[
            { value: presencePct !== null ? `${presencePct}%` : "—", label: "נוכחות", tone: presenceTone },
            { value: streak?.current_streak ?? 0, label: "ימים ברצף", tone: "warning" },
            { value: badges.length, label: "תגים", tone: "info" },
          ]}
        />
      </HomeSection>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <HomeHeader title={`${greeting(now)}, ${firstName(profile.fullName)}`} subtitle={subtitle} />

      {isBirthday && (
        <div className="flex items-center gap-3 self-start rounded-[16px] border-[3px] border-white bg-warning-soft px-4 py-3 text-warning shadow-sticker -rotate-1 dark:border-card">
          <Cake className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-heading text-base font-black">יום הולדת שמח!</p>
            <p className="font-body text-[13px] font-bold">מאחלים לך שנה מלאה בהצלחות</p>
          </div>
        </div>
      )}

      <HomeColumns main={main} side={side} />
    </motion.div>
  );
};

export default StudentDashboard;
