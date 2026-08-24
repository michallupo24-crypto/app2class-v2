import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, Check, X, Clock, Send, Undo2, Cake, MoreHorizontal, LayoutGrid, List, Save, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import type { AvatarConfig } from "@/components/avatar/AvatarStudio";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSmartSeat } from "@/hooks/useSmartSeat";
import { ClassroomGrid } from "@/components/smartseat/ClassroomGrid";

interface StudentCard {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  status: "present" | "absent" | "late" | "excused" | null;
  notes: { category: string; note?: string }[];
  isBirthday: boolean;
}

const SWIPE_THRESHOLD = 60;
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

const STATUS_LABELS: Record<NonNullable<StudentCard["status"]>, string> = {
  present: "נוכח/ת", absent: "חיסור", late: "איחור", excused: "מוצדק",
};

const SwipeableStudentRow = ({
  student,
  isMobile,
  onSwipe,
  onLongPress,
}: {
  student: StudentCard;
  isMobile: boolean;
  onSwipe: (id: string, direction: "left" | "right" | "late") => void;
  onLongPress: (id: string) => void;
}) => {
  const x = useMotionValue(0);
  const leftBgOpacity = useTransform(x, [-150, -SWIPE_THRESHOLD, 0], [1, 0.6, 0]);
  const rightBgOpacity = useTransform(x, [0, SWIPE_THRESHOLD, 150], [0, 0.6, 1]);
  const leftScale = useTransform(x, [-150, -SWIPE_THRESHOLD, 0], [1.15, 0.9, 0.5]);
  const rightScale = useTransform(x, [0, SWIPE_THRESHOLD, 150], [0.5, 0.9, 1.15]);
  const cardScale = useTransform(x, [-150, 0, 150], [0.97, 1, 0.97]);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => {
    pressTimer.current = setTimeout(() => onLongPress(student.id), LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) onSwipe(student.id, "left");
    else if (info.offset.x > SWIPE_THRESHOLD) onSwipe(student.id, "right");
  };

  const statusConfig = student.status === "present"
    ? { bg: "bg-success/10 border-success/30", accent: "bg-success", text: "text-success", icon: Check }
    : student.status === "absent"
      ? { bg: "bg-destructive/10 border-destructive/30", accent: "bg-destructive", text: "text-destructive", icon: X }
      : student.status === "late"
        ? { bg: "bg-warning/10 border-warning/30", accent: "bg-warning", text: "text-warning-foreground", icon: Clock }
        : { bg: "bg-card border-border/60 hover:border-border", accent: "bg-muted-foreground/30", text: "text-muted-foreground", icon: null };

  const hasDisciplineNote = student.notes.some(n => NOTE_CATEGORIES.find(c => c.value === n.category)?.group === "discipline");
  const hasPositiveNote = student.notes.some(n => NOTE_CATEGORIES.find(c => c.value === n.category)?.group === "positive");

  return (
    <div className="relative overflow-hidden rounded-lg shadow-sm">
      <motion.div className="absolute inset-0 flex items-center justify-start pr-6 bg-success/30" style={{ opacity: leftBgOpacity }}>
        <motion.div style={{ scale: leftScale }} className="flex items-center gap-1.5 text-success font-heading font-bold">
          <Check className="h-5 w-5" /> נוכח
        </motion.div>
      </motion.div>
      <motion.div className="absolute inset-0 flex items-center justify-end pl-6 bg-destructive/30" style={{ opacity: rightBgOpacity }}>
        <motion.div style={{ scale: rightScale }} className="flex items-center gap-1.5 text-destructive font-heading font-bold">
          חסר <X className="h-5 w-5" />
        </motion.div>
      </motion.div>
      <motion.div
        drag={isMobile ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={cancelPress}
        onDragEnd={handleDragEnd}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
        style={{ x, scale: cardScale }}
        className={`relative z-10 flex items-center gap-3.5 p-3 pr-4 rounded-lg border select-none transition-colors duration-200 ${statusConfig.bg} ${!isMobile ? "hover:shadow-md" : ""}`}
      >
        {/* Status accent strip */}
        <div className={`absolute inset-y-2 right-0 w-1 rounded-full ${statusConfig.accent} opacity-70`} />

        <div className="relative shrink-0">
          <div className={`rounded-lg ring-2 ring-offset-2 ring-offset-background transition-all ${student.status ? statusConfig.accent.replace("bg-", "ring-") + "/40" : "ring-transparent"}`}>
            {student.avatar
              ? <AvatarPreview config={student.avatar} size={48} />
              : <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-lg">👤</div>}
          </div>
          {student.status && statusConfig.icon && (
            <div className={`absolute -bottom-1.5 -left-1.5 w-6 h-6 rounded-full ${statusConfig.accent} text-white flex items-center justify-center border-2 border-background shadow-sm`}>
              <statusConfig.icon className="h-3.5 w-3.5" strokeWidth={3} />
            </div>
          )}
          {student.isBirthday && (
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center border-2 border-background shadow-sm" title="יום הולדת שמח!">
              <Cake className="h-3.5 w-3.5" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 text-right">
          <p className="font-heading font-bold text-sm truncate">{student.name}</p>
          <div className="flex items-center justify-end gap-1.5 mt-0.5 min-h-[16px]">
            {student.status && (
              <span className={`text-[10px] font-bold ${statusConfig.text}`}>{STATUS_LABELS[student.status]}</span>
            )}
            {hasDisciplineNote && (
              <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                <MoreHorizontal className="h-2.5 w-2.5" /> הערה
              </span>
            )}
            {hasPositiveNote && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">חיובי</span>
            )}
          </div>
        </div>

        {!isMobile && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={() => onSwipe(student.id, "left")} className={`h-8 w-8 p-0 ${student.status === "present" ? "bg-success/20 border-success/40 text-success" : ""}`}><Check className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => onSwipe(student.id, "right")} className={`h-8 w-8 p-0 ${student.status === "absent" ? "bg-destructive/20 border-destructive/40 text-destructive" : ""}`}><X className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => onSwipe(student.id, "late")} className={`h-8 w-8 p-0 ${student.status === "late" ? "bg-warning/20 border-warning/40" : ""}`}><Clock className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => onLongPress(student.id)} className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const RollCallPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const location = useLocation();
  const navState = location.state as { classId?: string } | null;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [classes, setClasses] = useState<{ id: string; grade: string; number: number }[]>([]);
  const [topic, setTopic] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [noteStudentId, setNoteStudentId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{ id: string; name: string; prevStatus: StudentCard["status"]; label: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [counselorReason, setCounselorReason] = useState("");
  const [flaggingCounselor, setFlaggingCounselor] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadClasses = async () => {
      const { data } = await supabase.from("teacher_classes").select("class_id, classes(id, grade, class_number)").eq("user_id", profile.id);
      if (data) {
        const cls = data.map((d: any) => ({ id: d.classes.id, grade: d.classes.grade, number: d.classes.class_number }));
        setClasses(cls);
        const deepLinkClass = navState?.classId && cls.some(c => c.id === navState.classId) ? navState.classId : null;
        if (deepLinkClass) setSelectedClass(deepLinkClass);
        else if (cls.length > 0) setSelectedClass(cls[0].id);
      }
    };
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  useEffect(() => {
    if (!selectedClass) return;
    const loadStudents = async () => {
      setLoading(true);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, date_of_birth").eq("class_id", selectedClass).eq("is_approved", true);
      if (!profiles) { setStudents([]); setLoading(false); return; }
      const { data: avatars } = await supabase.from("avatars").select("*").in("user_id", profiles.map(p => p.id));
      const avatarMap = new Map((avatars || []).map(a => [a.user_id, {
        body_type: a.face_shape || "basic", eye_color: a.eye_color || "brown", skin: a.skin_color || "#FDDBB4", hair_style: a.hair_style || "boy", hair_color: a.hair_color || "#2C1A0E",
      }]));

      const today = new Date();
      setStudents(profiles.map(p => {
        const dob = (p as any).date_of_birth ? new Date((p as any).date_of_birth) : null;
        const isBirthday = !!dob && dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
        return { id: p.id, name: p.full_name, avatar: avatarMap.get(p.id) || null, status: null, notes: [], isBirthday };
      }));
      setLoading(false);
    };
    loadStudents();
  }, [selectedClass]);

  const ss = useSmartSeat(selectedClass);

  const handleSwipe = useCallback((id: string, direction: "left" | "right" | "late") => {
    const status = direction === "left" ? "present" : direction === "right" ? "absent" : "late";
    setStudents(prev => {
      const target = prev.find(s => s.id === id);
      if (!target) return prev;
      const newStatus = target.status === status ? null : status;
      const label = newStatus === "present" ? "נוכח" : newStatus === "absent" ? "חיסור" : newStatus === "late" ? "איחור" : "בוטל";
      setLastAction({ id, name: target.name, prevStatus: target.status, label });
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setLastAction(null), 5000);
      return prev.map(s => s.id === id ? { ...s, status: newStatus } : s);
    });
  }, []);

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

  const handleToggleNote = (studentId: string, category: string) => {
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
      const hasIt = s.notes.some(n => n.category === category);
      return { ...s, notes: hasIt ? s.notes.filter(n => n.category !== category) : [...s.notes, { category }] };
    }));
  };

  const performSave = async () => {
    if (!selectedClass) return;
    setIsSaving(true);
    try {
        // Create or find a lesson for today
        const today = new Date().toISOString().split('T')[0];
        let lessonId;

        const { data: lesson } = await supabase
            .from('lessons')
            .select('id')
            .eq('class_id', selectedClass)
            .eq('subject', topic || 'שיעור ללא נושא')
            .gte('created_at', today)
            .limit(1)
            .maybeSingle();

        if (lesson) {
            lessonId = lesson.id;
        } else {
            const { data: newLesson, error: lessonError } = await supabase
                .from('lessons')
                .insert({
                    class_id: selectedClass,
                    subject: topic || 'שיעור ללא נושא',
                    teacher_id: profile.id,
                    school_id: profile.schoolId
                })
                .select()
                .single();
            if (lessonError) throw lessonError;
            lessonId = newLesson.id;
        }

        // Upsert attendance
        const attendanceData = students
            .filter(s => s.status)
            .map(s => ({
                student_id: s.id,
                lesson_id: lessonId,
                status: s.status,
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
            })));

        if (notesData.length > 0) {
            const { error: notesError } = await supabase.from('lesson_notes').insert(notesData);
            if (notesError) throw notesError;
        }

        toast({ title: "הנוכחות נשמרה בהצלחה!", description: `נשמרו ${attendanceData.length} רשומות נוכחות ו-${notesData.length} הערות.` });
        setStudents(prev => prev.map(s => ({ ...s, notes: [] })));
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold leading-tight">הקראת שמות</h1>
            {!loading && students.length > 0 && (
              <p className="text-xs text-muted-foreground font-body">{students.length} תלמידים בכיתה</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
            <div className="flex bg-muted rounded-lg p-1">
                <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="h-8 shadow-none"><List className="h-4 w-4 mr-2" /> רשימה</Button>
                <Button variant={viewMode === "map" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("map")} className="h-8 shadow-none"><LayoutGrid className="h-4 w-4 mr-2" /> מפה</Button>
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-32 h-10"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.grade}'{c.number}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleMarkAllPresent} disabled={students.length === 0}>
              <Check className="h-4 w-4 mr-2" /> סמן הכל נוכח
            </Button>
        </div>
      </div>

      {!loading && students.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`flex items-center gap-1.5 text-xs font-heading font-bold px-3 py-1.5 rounded-full transition-colors ${unmarkedCount > 0 ? "bg-muted text-muted-foreground" : "bg-muted/50 text-muted-foreground/50"}`}>
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> {unmarkedCount} טרם סומנו
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-heading font-bold px-3 py-1.5 rounded-full transition-colors ${presentCount > 0 ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground/40"}`}>
            <Check className="h-3 w-3" /> {presentCount} נוכחים
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-heading font-bold px-3 py-1.5 rounded-full transition-colors ${absentCount > 0 ? "bg-destructive/10 text-destructive" : "bg-muted/30 text-muted-foreground/40"}`}>
            <X className="h-3 w-3" /> {absentCount} חיסורים
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-heading font-bold px-3 py-1.5 rounded-full transition-colors ${lateCount > 0 ? "bg-warning/10 text-warning-foreground" : "bg-muted/30 text-muted-foreground/40"}`}>
            <Clock className="h-3 w-3" /> {lateCount} איחורים
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 p-3 rounded-lg border border-border/50 bg-card animate-pulse">
              <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-2/3 mr-auto" />
                <div className="h-2 bg-muted rounded w-1/3 mr-auto" />
              </div>
            </div>
          ))}
        </div>
      ) :
      viewMode === "list" ? (
        students.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-heading font-medium">אין תלמידים משויכים לכיתה זו</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {students.map(s => <SwipeableStudentRow key={s.id} student={s} isMobile={isMobile} onSwipe={handleSwipe} onLongPress={setNoteStudentId} />)}
        </div>
        )
      ) : (
        <>
          {ss.unseatedStudents.length === students.length && students.length > 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <LayoutGrid className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="font-heading font-medium text-muted-foreground">לכיתה הזו עדיין אין סידור הושבה</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  אפשר לסמן נוכחות לתלמידים למטה, או להגדיר סידור הושבה כדי לראות אותם על גבי מפה
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/dashboard/seating"><LayoutGrid className="h-4 w-4 mr-2" />הגדר/י מפת הושבה</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
          <Card className="min-h-[500px]">
              <CardContent className="p-0">
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
              </CardContent>
          </Card>
          )}

          {ss.unseatedStudents.length > 0 && (
            <Card>
              <CardContent className="py-4">
                <p className="text-xs font-heading font-bold text-muted-foreground mb-3">
                  {ss.unseatedStudents.length === students.length ? "סימון נוכחות" : `ממתינים לשיבוץ במפה (${ss.unseatedStudents.length})`}
                </p>
                <div className="flex flex-wrap gap-3">
                  {ss.unseatedStudents.map(seatStudent => {
                    const s = students.find(st => st.id === seatStudent.id);
                    if (!s) return null;
                    const isPresent = s.status === "present";
                    const isAbsent = s.status === "absent";
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleSwipe(s.id, isPresent ? "right" : "left")}
                        onContextMenu={(e) => { e.preventDefault(); setNoteStudentId(s.id); }}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-colors w-20 ${
                          isPresent ? "bg-success/10 border-success/30" : isAbsent ? "bg-destructive/10 border-destructive/30" : "bg-card border-border/50 hover:border-primary/40"
                        }`}
                      >
                        {s.avatar ? <AvatarPreview config={s.avatar} size={40} /> : <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">👤</div>}
                        <span className="text-[10px] font-heading font-medium text-center leading-tight line-clamp-1 w-full">{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card className="sticky bottom-4 z-40">
        <CardContent className="py-3 flex items-center gap-3">
          <input placeholder="נושא השיעור..." value={topic} onChange={e => setTopic(e.target.value)} className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none" />
          <Button
            onClick={() => {
              const hasAny = students.some(s => s.status || s.notes.length > 0);
              if (!hasAny) {
                toast({ variant: "destructive", title: "לא סומנה נוכחות", description: "סמן/י לפחות תלמיד/ה אחד/ת לפני השמירה." });
                return;
              }
              setShowConfirm(true);
            }}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            שמור
          </Button>
        </CardContent>
      </Card>

      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background rounded-lg px-5 py-3 flex items-center gap-4 text-sm"
          >
            <span>סימנת {lastAction.label} ל{lastAction.name}.</span>
            <Button size="sm" variant="secondary" className="h-7 px-3" onClick={handleUndoLast}>
              <Undo2 className="h-3.5 w-3.5 mr-1" /> בטל
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>אישור שמירת נוכחות</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            סימנת {students.filter(s => s.status === "absent").length} חיסורים,{" "}
            {students.filter(s => s.status === "late").length} איחורים ו-
            {students.reduce((sum, s) => sum + s.notes.length, 0)} הערות. לאשר?
          </p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>חזור</Button>
            <Button
              onClick={async () => { setShowConfirm(false); await performSave(); }}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              אשר ושמור
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteStudentId} onOpenChange={(o) => !o && setNoteStudentId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הערה ל{noteStudent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">משמעת</p>
              <div className="flex flex-wrap gap-2">
                {NOTE_CATEGORIES.filter(c => c.group === "discipline").map(c => (
                  <Button
                    key={c.value}
                    size="sm"
                    variant={noteStudent?.notes.some(n => n.category === c.value) ? "destructive" : "outline"}
                    onClick={() => noteStudentId && handleToggleNote(noteStudentId, c.value)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2">חיובי</p>
              <div className="flex flex-wrap gap-2">
                {NOTE_CATEGORIES.filter(c => c.group === "positive").map(c => (
                  <Button
                    key={c.value}
                    size="sm"
                    variant="outline"
                    className={noteStudent?.notes.some(n => n.category === c.value) ? "bg-success text-white border-success" : ""}
                    onClick={() => noteStudentId && handleToggleNote(noteStudentId, c.value)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-bold text-muted-foreground">הפניה ליועצת</p>
              <input
                placeholder="סיבה קצרה (אופציונלי)..."
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
