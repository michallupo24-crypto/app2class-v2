import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext, useLocation, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Undo2, Cake, Loader2 } from "lucide-react";
import { SUBJECTS } from "@/lib/constants";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import type { AvatarConfig } from "@/components/avatar/AvatarStudio";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSmartSeat } from "@/hooks/useSmartSeat";
import { ClassroomGrid } from "@/components/smartseat/ClassroomGrid";
import { avatarFromRow } from "@/components/avatar/avatarModel";
import { ToolSticker } from "@/components/ToolSticker";
import { HEBREW_DAYS } from "@/lib/constants";
import { localIsoDate } from "@/lib/lessonReports";
import { displayName, legalNameHint } from "@/lib/displayName";
import { SwipeStudentRow } from "@/components/attendance/SwipeStudentRow";
import { useAttendanceEventTypes, eventKey, type AttendanceEventType } from "@/hooks/useAttendanceEventTypes";
import { applySwipe, type SwipeAction } from "@/lib/attendanceSwipe";

interface StudentCard {
  id: string;
  name: string;
  /** Legal name, shown as a tooltip when a display name replaces it. */
  legalName?: string;
  avatar: AvatarConfig | null;
  status: "present" | "absent" | "late" | "excused" | null;
  // key: category for built-in notes, the event type id for a school's own events.
  notes: { key: string; category: string; label: string; eventTypeId?: string | null; note?: string }[];
  isBirthday: boolean;
}

const LONG_PRESS_MS = 550;

const NOTE_CATEGORIES: { value: string; label: string; group: "discipline" | "positive" }[] = [
  { value: "disruption", label: "הפרעה", group: "discipline" },
  { value: "phone", label: "טלפון", group: "discipline" },
  { value: "disrespect", label: "חוצפה", group: "discipline" },
  { value: "no_equipment", label: "לא הביא ציוד", group: "discipline" },
  { value: "no_homework", label: "לא הכין שיעורים", group: "discipline" },
  { value: "positive_participation", label: "השתתפות יפה", group: "positive" },
  { value: "helped_peer", label: "עזרה לחבר", group: "positive" },
  { value: "excellence", label: "הצטיינות", group: "positive" },
];

// Per the "Attendance" design: status tag colors and the ring on a marked card.
const TILE_STATUS: Record<NonNullable<StudentCard["status"]>, { label: string; cls: string; ring: string }> = {
  present: { label: "נוכח/ת", cls: "bg-success-soft text-success", ring: "#23B26D" },
  late: { label: "איחור", cls: "bg-warning-soft text-warning", ring: "#F0A21A" },
  absent: { label: "חסר/ה", cls: "bg-destructive-soft text-destructive", ring: "#E5484D" },
  excused: { label: "מוצדק", cls: "bg-info-soft text-info", ring: "#2F5FB8" },
};

const EVENT_ICON = { late: "clock", negative: "alert", positive: "star" } as const;

const StudentTile = ({ student, selected, onTap, onNotes }: {
  student: StudentCard;
  selected: boolean;
  onTap: () => void;
  onNotes: () => void;
}) => {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const st = student.status ? TILE_STATUS[student.status] : null;
  const first = student.name.trim().split(/\s+/)[0];

  const startPress = () => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => { longPressed.current = true; onNotes(); }, LONG_PRESS_MS);
  };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  return (
    <button
      type="button"
      onClick={() => { if (!longPressed.current) onTap(); }}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(e) => { e.preventDefault(); onNotes(); }}
      aria-label={`${student.name}: ${st ? st.label : "לא סומן"}`}
      title={student.legalName}
      className={`relative flex flex-col items-center gap-[7px] md:gap-2 px-1 md:px-1.5 pt-3 md:pt-3.5 pb-2.5 md:pb-3 rounded-[20px] bg-card select-none ${selected ? "outline outline-2 outline-offset-2 outline-foreground/30" : ""}`}
      style={{ boxShadow: st ? `0 0 0 2.5px ${st.ring}, 0 10px 18px -12px rgba(27,35,51,.5)` : "0 8px 16px -12px rgba(40,30,15,.4)" }}
    >
      {student.isBirthday && <Cake className="absolute top-2 left-2 h-4 w-4 text-accent" aria-label="יום הולדת" />}
      {student.notes.length > 0 && (
        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground font-heading font-black text-[10px] leading-[18px]" aria-label={`${student.notes.length} הערות`}>
          {student.notes.length}
        </span>
      )}
      <span className="w-[52px] h-[52px] md:w-[58px] md:h-[58px] rounded-full overflow-hidden border-[3px] border-white dark:border-card shadow-[0_2px_6px_rgba(40,30,15,.25)] bg-soft flex items-center justify-center"
        style={{ opacity: student.status === "absent" ? 0.45 : 1 }}>
        {student.avatar ? <AvatarPreview config={student.avatar} size={52} /> : <span className="font-heading font-black text-lg text-muted-foreground">{first.charAt(0)}</span>}
      </span>
      <span className="font-heading font-extrabold text-[13px] md:text-[13.5px] leading-tight text-center w-full truncate px-1">
        <span className="md:hidden">{first}</span><span className="max-md:hidden">{student.name}</span>
      </span>
      <span className={`px-2 py-1 md:px-[9px] md:py-[5px] rounded-lg font-body font-extrabold text-[11.5px] md:text-xs leading-none ${st ? st.cls : "bg-muted text-muted-foreground"}`}>
        {st ? st.label : "לא סומן"}
      </span>
    </button>
  );
};

const RollCallPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const location = useLocation();
  const navState = location.state as { classId?: string } | null;
  // A specific lesson, from the timetable or a lesson block on the home page.
  const [searchParams] = useSearchParams();
  const linkClass = searchParams.get("class") || navState?.classId || null;
  const linkLesson = searchParams.get("lesson") ? Number(searchParams.get("lesson")) : null;
  const linkSubject = searchParams.get("subject");
  const linkUsed = useRef(false);
  const chosenFor = useRef<string | null>(null);
  const { toast } = useToast();
  const todayIso = localIsoDate();
  const [lessonDate, setLessonDate] = useState(() => {
    const d = searchParams.get("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= todayIso ? d : todayIso;
  });
  const [lessonNumber, setLessonNumber] = useState<number | null>(null);
  const [bellLessons, setBellLessons] = useState<{ lesson_number: number; start_time: string; end_time: string }[]>([]);
  const [mySlots, setMySlots] = useState<{ class_id: string; subject: string; lesson_number: number; day_of_week: number }[]>([]);
  const [existingLessonId, setExistingLessonId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [classes, setClasses] = useState<{ id: string; grade: string; number: number }[]>([]);
  const [subject, setSubject] = useState("");
  const [syllabusTopics, setSyllabusTopics] = useState<{ id: string; topic: string }[]>([]);
  const [topicChoice, setTopicChoice] = useState<string>(""); // syllabus topic id, "other", or ""
  const [otherTopicText, setOtherTopicText] = useState("");
  const [markTopicCompleted, setMarkTopicCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [noteStudentId, setNoteStudentId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{ id: string; name: string; prevStatus: StudentCard["status"]; label: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [counselorReason, setCounselorReason] = useState("");
  const [flaggingCounselor, setFlaggingCounselor] = useState(false);
  const [markRestPresent, setMarkRestPresent] = useState(true);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { events } = useAttendanceEventTypes(profile.schoolId);

  useEffect(() => {
    const loadClasses = async () => {
      const { data } = await supabase.from("teacher_classes").select("class_id, classes(id, grade, class_number)").eq("user_id", profile.id);
      if (data) {
        const cls = data.map((d: any) => ({ id: d.classes.id, grade: d.classes.grade, number: d.classes.class_number }));
        setClasses(cls);
        const deepLinkClass = linkClass && cls.some(c => c.id === linkClass) ? linkClass : null;
        if (deepLinkClass) setSelectedClass(deepLinkClass);
        else if (cls.length > 0) setSelectedClass(cls[0].id);
      }
    };
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // The bell schedule and this teacher's own timetable slots - to offer the
  // lessons of the chosen day and to tell which one is on now.
  useEffect(() => {
    if (!profile.schoolId) return;
    Promise.all([
      supabase.from("bell_schedule").select("lesson_number, start_time, end_time, is_break")
        .eq("school_id", profile.schoolId).order("lesson_number"),
      supabase.from("timetable_slots").select("class_id, subject, lesson_number, day_of_week")
        .eq("school_id", profile.schoolId).eq("teacher_id", profile.id),
    ]).then(([{ data: bell }, { data: slots }]) => {
      setBellLessons((bell || []).filter((b: any) => !b.is_break)
        .map((b: any) => ({ lesson_number: b.lesson_number, start_time: b.start_time?.slice(0, 5), end_time: b.end_time?.slice(0, 5) })));
      setMySlots((slots || []).filter((s: any) => s.class_id) as any);
    });
  }, [profile.schoolId, profile.id]);

  const dayOfLesson = new Date(`${lessonDate}T12:00:00`).getDay();
  const classSlotsThatDay = mySlots
    .filter(s => s.class_id === selectedClass && s.day_of_week === dayOfLesson)
    .sort((a, b) => a.lesson_number - b.lesson_number);
  const slotKey = classSlotsThatDay.map(s => `${s.lesson_number}:${s.subject}`).join(",");

  // Pick the lesson: the one in the link, else the one on now (today), else the
  // first lesson this teacher has with the class that day. The teacher can
  // always change it - e.g. to enter attendance for an earlier lesson later.
  useEffect(() => {
    if (!selectedClass) return;
    if (!linkUsed.current && linkLesson && selectedClass === linkClass) {
      linkUsed.current = true;
      chosenFor.current = `${selectedClass}|${lessonDate}`;
      setLessonNumber(linkLesson);
      setSubject(linkSubject || "");
    }
    // A lesson picked by hand (or from the link) stays picked for this class and day.
    if (chosenFor.current === `${selectedClass}|${lessonDate}`) {
      const slot = classSlotsThatDay.find(s => s.lesson_number === lessonNumber);
      if (slot) setSubject(s => s || slot.subject);
      return;
    }
    let pick = classSlotsThatDay[0];
    if (lessonDate === todayIso) {
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const current = bellLessons.find(b => t >= b.start_time && t <= b.end_time);
      const startedSlots = classSlotsThatDay.filter(s => (bellLessons.find(b => b.lesson_number === s.lesson_number)?.start_time ?? "") <= t);
      pick = classSlotsThatDay.find(s => s.lesson_number === current?.lesson_number) || startedSlots[startedSlots.length - 1] || pick;
    }
    setLessonNumber(pick ? pick.lesson_number : bellLessons.length ? null : 1);
    setSubject(pick?.subject || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, lessonDate, slotKey, bellLessons.length]);

  // Students of the class, with whatever was already entered for this lesson
  // (so attendance can be completed or corrected later).
  useEffect(() => {
    if (!selectedClass) return;
    let cancelled = false;
    const loadStudents = async () => {
      setLoading(true);
      setTopicChoice("");
      setOtherTopicText("");
      setMarkTopicCompleted(false);
      setExistingLessonId(null);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, display_name, date_of_birth").eq("class_id", selectedClass).eq("is_approved", true);
      if (cancelled) return;
      if (!profiles) { setStudents([]); setLoading(false); return; }
      const [{ data: avatars }, { data: lesson }] = await Promise.all([
        supabase.from("avatars").select("*").in("user_id", profiles.map(p => p.id)),
        lessonNumber
          ? supabase.from("lessons").select("id, subject, topic")
            .eq("class_id", selectedClass).eq("teacher_id", profile.id)
            .eq("lesson_date", lessonDate).eq("lesson_number", lessonNumber)
            .order("created_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const avatarMap = new Map((avatars || []).map(a => [a.user_id, avatarFromRow(a)!]));
      let prev = new Map<string, StudentCard["status"]>();
      if (lesson) {
        const { data: att } = await supabase.from("attendance").select("student_id, status").eq("lesson_id", lesson.id);
        prev = new Map((att || []).map((a: any) => [a.student_id, a.status]));
      }
      if (cancelled) return;
      if (lesson) {
        setExistingLessonId(lesson.id);
        setSubject(lesson.subject);
        if (lesson.topic) { setTopicChoice("other"); setOtherTopicText(lesson.topic); }
      }

      const today = new Date();
      setStudents(profiles.map(p => {
        const dob = (p as any).date_of_birth ? new Date((p as any).date_of_birth) : null;
        const isBirthday = !!dob && dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
        return { id: p.id, name: displayName(p), legalName: legalNameHint(p), avatar: avatarMap.get(p.id) || null, status: prev.get(p.id) ?? null, notes: [], isBirthday };
      }).sort((a, b) => a.name.localeCompare(b.name, "he")));
      setLoading(false);
    };
    loadStudents();
    return () => { cancelled = true; };
  }, [selectedClass, lessonDate, lessonNumber, profile.id]);

  // Load syllabus topics for this class's grade + the selected subject, so
  // the teacher can tie today's lesson to real curriculum progress instead of
  // always typing a free-text topic.
  useEffect(() => {
    if (!selectedClass || !subject || !profile.schoolId) { setSyllabusTopics([]); return; }
    const cls = classes.find(c => c.id === selectedClass);
    if (!cls) { setSyllabusTopics([]); return; }
    supabase.from("syllabi").select("id, topic")
      .eq("school_id", profile.schoolId).eq("subject", subject).eq("grade", cls.grade as any)
      .order("order_index")
      .then(({ data }) => {
        setSyllabusTopics(data || []);
        // A saved topic that is a syllabus topic shows as that topic, not as free text.
        setOtherTopicText(text => {
          const match = (data || []).find(t => t.topic === text.trim());
          if (match) setTopicChoice(choice => (choice === "other" ? match.id : choice));
          return match ? "" : text;
        });
      });
  }, [selectedClass, subject, profile.schoolId, classes]);

  const ss = useSmartSeat(selectedClass);

  // Every status change goes through here so it gets the undo toast.
  const updateStatus = useCallback((id: string, next: (cur: StudentCard["status"]) => StudentCard["status"]) => {
    setStudents(prev => {
      const target = prev.find(s => s.id === id);
      if (!target) return prev;
      const newStatus = next(target.status);
      const label = newStatus === "present" ? "נוכח" : newStatus === "absent" ? "חיסור" : newStatus === "late" ? "איחור" : "ביטול סימון";
      setLastAction({ id, name: target.name, prevStatus: target.status, label });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setLastAction(null), 4000);
      return prev.map(s => s.id === id ? { ...s, status: newStatus } : s);
    });
  }, []);

  const handleSwipe = useCallback((id: string, direction: "left" | "right" | "late") => {
    const status = direction === "left" ? "present" : direction === "right" ? "absent" : "late";
    updateStatus(id, cur => cur === status ? null : status);
  }, [updateStatus]);

  const handleRowSwipe = (id: string, action: SwipeAction) => updateStatus(id, cur => applySwipe(cur, action));

  const handleUndoLast = () => {
    if (!lastAction) return;
    setStudents(prev => prev.map(s => s.id === lastAction.id ? { ...s, status: lastAction.prevStatus } : s));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setLastAction(null);
  };

  const handleMarkAllPresent = () => {
    setStudents(prev => prev.map(s => s.status ? s : { ...s, status: "present" }));
    toast({ title: "כולם סומנו נוכחים", description: "סמן/י רק את החריגים (חיסור/איחור)." });
  };

  const noteStudent = students.find(s => s.id === noteStudentId);

  const handleFlagForCounselor = async () => {
    if (!noteStudentId) return;
    setFlaggingCounselor(true);
    try {
      const { data, error } = await supabase.rpc("flag_student_for_counselor", {
        p_student_id: noteStudentId,
        p_reason: counselorReason.trim() || undefined,
      });
      if (error) throw error;
      toast(
        data === 0
          ? { title: "כבר קיימת הפניה פתוחה", description: "התלמיד/ה כבר מסומן/ת אצל היועצת." }
          : { title: "הופנה ליועצת", description: "היועצת קיבלה התראה על ההפניה." }
      );
      setCounselorReason("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "שגיאה בהפניה ליועצת", description: e.message });
    } finally {
      setFlaggingCounselor(false);
    }
  };

  const handleToggleNote = (studentId: string, note: Omit<StudentCard["notes"][number], "label"> & { label?: string }) => {
    const target = students.find(s => s.id === studentId);
    if (target?.status === "absent") {
      toast({
        variant: "destructive",
        title: "לא ניתן לשים הערה לתלמיד שאינו נוכח",
        description: "האם התלמיד הגיע באיחור?",
      });
      return;
    }
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const hasIt = s.notes.some(n => n.key === note.key);
      const label = note.label || NOTE_CATEGORIES.find(c => c.value === note.category)?.label || note.category;
      return { ...s, notes: hasIt ? s.notes.filter(n => n.key !== note.key) : [...s.notes, { ...note, label }] };
    }));
  };

  const toggleCategory = (studentId: string, category: string) => handleToggleNote(studentId, { key: category, category });

  // An item from the school's event menu: איחור sets the status, the rest are notes.
  const handleEvent = (studentId: string, ev: AttendanceEventType) => {
    if (ev.kind === "late") { updateStatus(studentId, cur => cur === "late" ? null : "late"); return; }
    const custom = ev.category!.startsWith("custom_");
    handleToggleNote(studentId, { key: eventKey(ev), category: ev.category!, label: ev.label, eventTypeId: ev.id, note: custom ? ev.label : undefined });
  };

  const performSave = async () => {
    if (!selectedClass || !subject || !lessonNumber) return;
    setIsSaving(true);
    try {
        const isOtherTopic = topicChoice === "other";
        const chosenSyllabusTopic = !isOtherTopic ? syllabusTopics.find(t => t.id === topicChoice) : undefined;
        const topicText = isOtherTopic ? otherTopicText.trim() : (chosenSyllabusTopic?.topic || "");

        // Find or create this lesson: class + teacher + local (Israel) date +
        // lesson number. One row per lesson, so two lessons of the same subject
        // on one day each keep their own attendance.
        let lessonId;

        const { data: lesson } = await supabase
            .from('lessons')
            .select('id')
            .eq('class_id', selectedClass)
            .eq('teacher_id', profile.id)
            .eq('lesson_date', lessonDate)
            .eq('lesson_number', lessonNumber!)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lesson) {
            lessonId = lesson.id;
            // Re-saving the roll call may add or change the subject and topic.
            const { error: topicError } = await supabase.from('lessons')
                .update(topicText ? { subject, topic: topicText } : { subject })
                .eq('id', lesson.id);
            if (topicError) throw topicError;
        } else {
            const { data: newLesson, error: lessonError } = await supabase
                .from('lessons')
                .insert({
                    class_id: selectedClass,
                    subject,
                    topic: topicText || null,
                    teacher_id: profile.id,
                    school_id: profile.schoolId,
                    lesson_date: lessonDate,
                    lesson_number: lessonNumber!,
                })
                .select()
                .single();
            if (lessonError) throw lessonError;
            lessonId = newLesson.id;
        }

        // A syllabus topic (not free-text "other") was picked - reflect it as
        // real curriculum progress for this class, not just a lesson label.
        if (chosenSyllabusTopic) {
            const { error: progressError } = await supabase.from('class_syllabus_progress').upsert({
                class_id: selectedClass,
                syllabus_id: chosenSyllabusTopic.id,
                status: markTopicCompleted ? 'completed' : 'in_progress',
                completed_at: markTopicCompleted ? new Date().toISOString() : null,
            }, { onConflict: 'class_id,syllabus_id' });
            if (progressError) throw progressError;
        }

        // Upsert attendance
        // Fast flow: mark only the exceptions, everyone left is present.
        const finalStatus = (s: StudentCard) => s.status || (markRestPresent ? "present" : null);
        const attendanceData = students
            .filter(s => finalStatus(s))
            .map(s => ({
                student_id: s.id,
                lesson_id: lessonId,
                status: finalStatus(s)!,
                noted_at: new Date().toISOString()
            }));

        if (attendanceData.length > 0) {
            const { error: attError } = await supabase
                .from('attendance')
                .upsert(attendanceData, { onConflict: 'student_id,lesson_id' });
            if (attError) throw attError;
        }

        // Save behavior/discipline notes taken during roll call
        const notesData = students
            .filter(s => s.notes.length > 0)
            .flatMap(s => s.notes.map(n => ({
                student_id: s.id,
                lesson_id: lessonId,
                category: n.category as any,
                ...(n.note ? { note: n.note } : {}),
                ...(n.eventTypeId ? { event_type_id: n.eventTypeId } : {}),
            })));

        if (notesData.length > 0) {
            const { error: notesError } = await supabase.from('lesson_notes').insert(notesData);
            if (notesError) throw notesError;
        }

        toast({
          title: "הנוכחות נשמרה בהצלחה!",
          description: `שיעור ${lessonNumber}: ${attendanceData.length} רשומות נוכחות ו-${notesData.length} הערות.${topicText ? "" : " אפשר להוסיף את נושא השיעור גם אחר כך."}`,
        });
        setExistingLessonId(lessonId);
        setStudents(prev => prev.map(s => ({ ...s, status: finalStatus(s), notes: [] })));
        setMarkTopicCompleted(false);
    } catch (err: any) {
        console.error("Save error:", err);
        toast({ variant: "destructive", title: "שגיאה בשמירה", description: err.message });
    } finally {
        setIsSaving(false);
    }
  };

  const presentCount = students.filter(s => s.status === "present").length;
  const absentCount = students.filter(s => s.status === "absent").length;
  const lateCount = students.filter(s => s.status === "late").length;
  const unmarkedCount = students.length - presentCount - absentCount - lateCount;
  const selectedStudent = students.find(s => s.id === selectedId);
  const cls = classes.find(c => c.id === selectedClass);
  const lessonBell = bellLessons.find(b => b.lesson_number === lessonNumber);
  const dateLabel = lessonDate === todayIso ? "היום" : `יום ${HEBREW_DAYS[dayOfLesson]} ${lessonDate.slice(8)}/${lessonDate.slice(5, 7)}`;
  // The day's lessons with this class first, then the rest of the bell schedule
  // (a swapped or extra lesson).
  const lessonOptions = [
    ...classSlotsThatDay.map(s => ({ n: s.lesson_number, subject: s.subject })),
    ...bellLessons.filter(b => !classSlotsThatDay.some(s => s.lesson_number === b.lesson_number)).map(b => ({ n: b.lesson_number, subject: null })),
  ];
  if (lessonNumber && !lessonOptions.some(o => o.n === lessonNumber)) lessonOptions.push({ n: lessonNumber, subject: null });
  const subjectOptions = subject && !SUBJECTS.includes(subject as any) ? [subject, ...SUBJECTS] : [...SUBJECTS];

  const summary = [
    { label: "נוכחים", v: presentCount, cls: "bg-success-soft text-success" },
    { label: "איחורים", v: lateCount, cls: "bg-warning-soft text-warning" },
    { label: "חסרים", v: absentCount, cls: "bg-destructive-soft text-destructive" },
  ];

  const requestSave = () => {
    const hasAny = students.some(s => s.status || s.notes.length > 0);
    if (!hasAny) {
      toast({ variant: "destructive", title: "לא סומנה נוכחות", description: "סמן/י לפחות תלמיד/ה אחד/ת לפני השמירה." });
      return;
    }
    if (!lessonNumber) {
      toast({ variant: "destructive", title: "בחר/י שיעור", description: "יש לבחור לאיזה שיעור במערכת שייכת הנוכחות." });
      return;
    }
    if (!subject) {
      toast({ variant: "destructive", title: "בחר/י מקצוע", description: "יש לבחור את המקצוע שנלמד בשיעור זה." });
      return;
    }
    setMarkRestPresent(true);
    setShowConfirm(true);
  };

  const tapStudent = (id: string) => {
    setSelectedId(id);
    const s = students.find(st => st.id === id);
    handleSwipe(id, s?.status === "present" ? "late" : s?.status === "late" ? "right" : "left");
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-[18px]">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <ToolSticker id="attendance" size={52} className="max-md:w-10 max-md:h-10" />
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading font-black text-2xl md:text-[30px] leading-none">הקראת שמות</h1>
            <p className="font-body font-semibold text-[13px] md:text-sm leading-none text-muted-foreground">
              {[cls && `${cls.grade}'-${cls.number}`, lessonNumber && `שיעור ${lessonNumber}`, dateLabel, subject, !loading && students.length > 0 && `${students.length} תלמידים`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex bg-muted rounded-xl p-1" role="tablist" aria-label="תצוגה">
            <button type="button" role="tab" aria-selected={viewMode === "list"} onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-[9px] font-body font-extrabold text-[13px] ${viewMode === "list" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>רשימה</button>
            <button type="button" role="tab" aria-selected={viewMode === "map"} onClick={() => setViewMode("map")}
              className={`px-3 py-1.5 rounded-[9px] font-body font-extrabold text-[13px] ${viewMode === "map" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>מפה</button>
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-28 h-10 rounded-xl bg-card"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.grade}'{c.number}</SelectItem>)}</SelectContent>
          </Select>
          <button type="button" onClick={handleMarkAllPresent} disabled={students.length === 0}
            className="px-4 py-3 rounded-xl bg-card border-[1.5px] border-input font-body font-extrabold text-sm leading-none disabled:opacity-50">
            כולם נוכחים
          </button>
          <button type="button" onClick={requestSave} disabled={isSaving}
            className="max-md:hidden flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-body font-extrabold text-sm leading-none disabled:opacity-60">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            שמור נוכחות
          </button>
        </div>
      </div>

      {/* The lesson this attendance belongs to, and its details */}
      <div className="flex flex-col gap-2.5 p-3 rounded-[18px] bg-card shadow-card">
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" aria-label="תאריך השיעור" value={lessonDate} max={todayIso}
            onChange={e => { if (e.target.value && e.target.value <= todayIso) { chosenFor.current = null; setLessonDate(e.target.value); } }}
            className="h-10 bg-soft rounded-xl px-3 text-sm font-body font-bold outline-none" />
          <Select value={lessonNumber ? String(lessonNumber) : ""}
            onValueChange={v => {
              const n = Number(v);
              chosenFor.current = `${selectedClass}|${lessonDate}`;
              setLessonNumber(n);
              const slot = classSlotsThatDay.find(s => s.lesson_number === n);
              if (slot) setSubject(slot.subject);
            }}>
            <SelectTrigger className="w-56 h-10 text-sm bg-soft border-0 rounded-xl" aria-label="שיעור"><SelectValue placeholder="בחר/י שיעור..." /></SelectTrigger>
            <SelectContent>
              {lessonOptions.map(o => {
                const b = bellLessons.find(x => x.lesson_number === o.n);
                return (
                  <SelectItem key={o.n} value={String(o.n)}>
                    {[`שיעור ${o.n}`, b && b.start_time, o.subject ?? "לא במערכת"].filter(Boolean).join(" · ")}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {lessonNumber && (
            <span className={`px-2.5 py-1.5 rounded-lg font-body font-extrabold text-xs leading-none ${existingLessonId ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
              {existingLessonId ? "נוכחות הוזנה - אפשר לעדכן" : lessonBell ? `${lessonBell.start_time}–${lessonBell.end_time} · טרם הוזנה` : "טרם הוזנה"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={subject} onValueChange={v => { setSubject(v); setTopicChoice(""); setOtherTopicText(""); setMarkTopicCompleted(false); }}>
            <SelectTrigger className="w-36 h-10 text-sm bg-soft border-0 rounded-xl"><SelectValue placeholder="מקצוע..." /></SelectTrigger>
            <SelectContent>{subjectOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={topicChoice} onValueChange={setTopicChoice} disabled={!subject}>
            <SelectTrigger className="flex-1 min-w-[160px] h-10 text-sm bg-soft border-0 rounded-xl"><SelectValue placeholder="נושא השיעור..." /></SelectTrigger>
            <SelectContent>
              {syllabusTopics.map(t => <SelectItem key={t.id} value={t.id}>{t.topic}</SelectItem>)}
              <SelectItem value="other">אחר...</SelectItem>
            </SelectContent>
          </Select>
          {topicChoice === "other" && (
            <input placeholder="נושא חופשי..." aria-label="נושא חופשי" value={otherTopicText} onChange={e => setOtherTopicText(e.target.value)} className="flex-1 min-w-[140px] h-10 bg-soft rounded-xl px-3 text-sm outline-none" />
          )}
        </div>
        {topicChoice && topicChoice !== "other" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
            <Checkbox checked={markTopicCompleted} onCheckedChange={v => setMarkTopicCompleted(!!v)} />
            סמן נושא זה כהושלם בסילבוס
          </label>
        )}
      </div>

      {/* Phone: summary chips */}
      {!loading && students.length > 0 && (
        <div className="flex gap-1.5 lg:hidden">
          {summary.map(s => (
            <div key={s.label} className={`flex-1 flex items-center justify-center gap-1.5 px-1.5 py-2.5 rounded-[14px] font-body font-extrabold text-[13px] leading-none ${s.cls}`}>
              <span className="font-heading font-black text-[17px]">{s.v}</span>{s.label}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_270px] gap-[18px] items-start">
        <div className="flex flex-col gap-3 min-w-0">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2.5 md:gap-3">
              {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-[132px] rounded-[20px] bg-card animate-pulse" />)}
            </div>
          ) : viewMode === "list" ? (
            students.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground rounded-[20px] border-2 border-dashed border-input">
                <p className="font-heading font-bold">אין תלמידים משויכים לכיתה זו</p>
              </div>
            ) : (
              <>
                <p className="font-body font-semibold text-[12.5px] md:text-[13px] leading-snug text-muted-foreground px-1">
                  <span className="md:hidden">החליקו ימינה לחיסור, שמאלה לנוכח/ת. לחיצה ארוכה או ⋯ לאיחור והערות.</span>
                  <span className="max-md:hidden">סמנו רק את החסרים בלחיצה על ״חיסור״; ⋯ לאיחור והערות.</span>
                  {" "}בשמירה כל מי שלא סומן/ה נרשם/ת כנוכח/ת.
                  {unmarkedCount > 0 && ` ${unmarkedCount} טרם סומנו.`}
                </p>
                <div className="flex flex-col gap-2">
                  {students.map(s => (
                    <SwipeStudentRow key={s.id} student={s} events={events} selected={s.id === selectedId}
                      onSelect={() => setSelectedId(s.id)}
                      onSwipe={action => handleRowSwipe(s.id, action)}
                      onToggleAbsent={() => handleRowSwipe(s.id, "absent")}
                      onEvent={ev => handleEvent(s.id, ev)}
                      onMoreNotes={() => { setSelectedId(s.id); setNoteStudentId(s.id); }} />
                  ))}
                </div>
              </>
            )
          ) : (
            <>
              {ss.unseatedStudents.length === students.length && students.length > 0 ? (
                <div className="py-10 px-4 text-center space-y-3 rounded-[22px] bg-card shadow-card">
                  <ToolSticker id="seats" size={44} className="mx-auto" />
                  <p className="font-heading font-bold text-muted-foreground">לכיתה הזו עדיין אין סידור הושבה</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">אפשר לסמן נוכחות בתצוגת הכרטיסים, או להגדיר סידור הושבה כדי לראות את התלמידים על גבי מפה</p>
                  <Button variant="outline" size="sm" asChild><a href="/dashboard/seating">הגדר/י מפת הושבה</a></Button>
                </div>
              ) : (
                <div className="min-h-[500px] rounded-[22px] bg-card shadow-card overflow-hidden">
                  <ClassroomGrid
                    config={ss.config}
                    students={students.map(s => {
                      const seated = ss.students.find(st => st.id === s.id);
                      return { ...s, attendance: s.status || 'none', seatRow: seated?.seatRow, seatCol: seated?.seatCol } as any;
                    })}
                    mode="lesson"
                    highlightedId={null}
                    getStudentAt={(r, c) => {
                      const seated = ss.students.find(st => st.seatRow === r && st.seatCol === c);
                      if (!seated) return undefined;
                      const s = students.find(st => st.id === seated.id);
                      return s ? ({ ...s, attendance: s.status || 'none', seatRow: r, seatCol: c } as any) : undefined;
                    }}
                    onCellClick={(r, c, student) => student && handleSwipe(student.id, student.attendance === 'present' ? 'right' : 'left')}
                    onDrop={() => {}}
                  />
                </div>
              )}

              {ss.unseatedStudents.length > 0 && ss.unseatedStudents.length < students.length && (
                <div className="flex flex-col gap-3 p-4 rounded-[22px] bg-card shadow-card">
                  <p className="font-heading font-black text-sm">ממתינים לשיבוץ במפה ({ss.unseatedStudents.length})</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {ss.unseatedStudents.map(seatStudent => {
                      const s = students.find(st => st.id === seatStudent.id);
                      return s ? <StudentTile key={s.id} student={s} selected={s.id === selectedId} onTap={() => tapStudent(s.id)} onNotes={() => setNoteStudentId(s.id)} /> : null;
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Phone: save */}
          <button type="button" onClick={requestSave} disabled={isSaving}
            className="md:hidden sticky bottom-3 z-30 flex items-center justify-center gap-2 px-4 py-3.5 rounded-[14px] bg-primary text-primary-foreground font-body font-extrabold text-[15px] leading-none shadow-raised disabled:opacity-60">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            שמור נוכחות
          </button>
        </div>

        {/* Side panel */}
        <aside className="flex flex-col gap-3 max-lg:order-first max-lg:hidden">
          <div className="flex flex-col gap-2.5 p-4 rounded-[22px] bg-card shadow-card">
            <h2 className="font-heading font-black text-base leading-none">סיכום</h2>
            {summary.map(s => (
              <div key={s.label} className={`flex items-center justify-between px-3 py-2.5 rounded-[13px] font-body font-extrabold text-sm leading-none ${s.cls}`}>
                <span>{s.label}</span><span className="font-heading font-black text-lg">{s.v}</span>
              </div>
            ))}
            {unmarkedCount > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-[13px] bg-muted text-muted-foreground font-body font-extrabold text-sm leading-none">
                <span>טרם סומנו</span><span className="font-heading font-black text-lg">{unmarkedCount}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2.5 p-4 rounded-[22px] bg-card shadow-card">
            <h2 className="font-heading font-black text-base leading-none">הערה לשיעור</h2>
            <p className="font-body font-semibold text-[12.5px] leading-snug text-muted-foreground">
              {selectedStudent ? `הערה ל${selectedStudent.name}:` : "בחר/י תלמיד/ה ואז סוג הערה"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {events.map(ev => {
                const on = ev.kind === "late" ? selectedStudent?.status === "late" : !!selectedStudent?.notes.some(x => x.key === eventKey(ev));
                return (
                  <button key={eventKey(ev)} type="button" disabled={!selectedStudent} aria-pressed={on}
                    onClick={() => selectedStudent && handleEvent(selectedStudent.id, ev)}
                    className={`flex items-center gap-2 px-2.5 py-[9px] rounded-[13px] text-right disabled:opacity-50 ${on ? "bg-primary text-primary-foreground" : "bg-soft"}`}>
                    <ToolSticker id={EVENT_ICON[ev.kind]} size={26} />
                    <span className="font-body font-extrabold text-[12.5px] leading-tight">{ev.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedStudent && (
              <button type="button" onClick={() => setNoteStudentId(selectedStudent.id)} className="font-body font-bold text-[12.5px] text-link text-right">
                כל ההערות והפניה ליועצת
              </button>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background rounded-[14px] px-5 py-3 flex items-center gap-4 text-sm"
          >
            <span>סימנת {lastAction.label} ל{lastAction.name}.</span>
            <Button size="sm" variant="secondary" className="h-7 px-3" onClick={handleUndoLast}>
              <Undo2 className="h-3.5 w-3.5 mr-1" /> בטל
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm rounded-[22px]">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">אישור שמירת נוכחות</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {[cls && `${cls.grade}'-${cls.number}`, `שיעור ${lessonNumber}`, dateLabel, subject].filter(Boolean).join(" · ")}:{" "}
            סימנת {absentCount} חיסורים, {lateCount} איחורים ו-
            {students.reduce((sum, s) => sum + s.notes.length, 0)} הערות. לאשר?
          </p>
          {unmarkedCount > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
              <Checkbox checked={markRestPresent} onCheckedChange={v => setMarkRestPresent(!!v)} />
              לסמן את {unmarkedCount} שלא סומנו כנוכחים
            </label>
          )}
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>חזור</Button>
            <Button onClick={async () => { setShowConfirm(false); await performSave(); }} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              אשר ושמור
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteStudentId} onOpenChange={(o) => !o && setNoteStudentId(null)}>
        <DialogContent className="max-w-sm rounded-[22px]">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">הערה ל{noteStudent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(["discipline", "positive"] as const).map(group => (
              <div key={group}>
                <p className="text-xs font-bold text-muted-foreground mb-2">{group === "discipline" ? "משמעת" : "חיובי"}</p>
                <div className="flex flex-wrap gap-2">
                  {NOTE_CATEGORIES.filter(c => c.group === group).map(c => {
                    const on = !!noteStudent?.notes.some(n => n.key === c.value);
                    return (
                      <button key={c.value} type="button" aria-pressed={on}
                        onClick={() => noteStudentId && toggleCategory(noteStudentId, c.value)}
                        className={`px-3 py-2 rounded-full font-body font-extrabold text-[13px] leading-none shadow-[0_3px_8px_-5px_rgba(40,30,15,.35)] ${
                          on ? (group === "discipline" ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground") : "bg-soft"}`}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-bold text-muted-foreground">הפניה ליועצת</p>
              <input
                placeholder="סיבה קצרה (אופציונלי)..."
                aria-label="סיבת ההפניה ליועצת"
                value={counselorReason}
                onChange={e => setCounselorReason(e.target.value)}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none"
              />
              <Button size="sm" variant="outline" className="w-full" onClick={handleFlagForCounselor} disabled={flaggingCounselor}>
                {flaggingCounselor ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                סמן/י כזקוק/ה לתשומת לב רגשית ליועצת
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RollCallPage;
