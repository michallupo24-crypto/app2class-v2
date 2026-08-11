import { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
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
  const leftScale = useTransform(x, [-150, -SWIPE_THRESHOLD, 0], [1.1, 0.9, 0.5]);
  const rightScale = useTransform(x, [0, SWIPE_THRESHOLD, 150], [0.5, 0.9, 1.1]);
  const cardScale = useTransform(x, [-150, 0, 150], [0.98, 1, 0.98]);

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
    ? { bg: "bg-success/8 border-success/25", ring: "ring-success/20", icon: "✓" }
    : student.status === "absent"
      ? { bg: "bg-destructive/8 border-destructive/25", ring: "ring-destructive/20", icon: "✗" }
      : student.status === "late"
        ? { bg: "bg-warning/8 border-warning/25", ring: "ring-warning/20", icon: "◷" }
        : { bg: "bg-card border-border/50", ring: "", icon: "" };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <motion.div className="absolute inset-0 flex items-center justify-start pr-5 bg-gradient-to-l from-transparent to-success/30" style={{ opacity: leftBgOpacity }}>
        <motion.div style={{ scale: leftScale }} className="text-success font-bold">נוכח</motion.div>
      </motion.div>
      <motion.div className="absolute inset-0 flex items-center justify-end pl-5 bg-gradient-to-r from-transparent to-destructive/30" style={{ opacity: rightBgOpacity }}>
        <motion.div style={{ scale: rightScale }} className="text-destructive font-bold">חסר</motion.div>
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
        className={`relative z-10 flex items-center gap-3 p-3 rounded-2xl border-2 backdrop-blur-sm select-none ${statusConfig.bg}`}
      >
        <div className="relative shrink-0">
          {student.avatar ? <AvatarPreview config={student.avatar} size={44} /> : <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center">👤</div>}
          {student.status && <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center border-2 border-background">{statusConfig.icon}</div>}
          {student.notes.length > 0 && (
            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
              student.notes.some(n => NOTE_CATEGORIES.find(c => c.value === n.category)?.group === "discipline") ? "bg-destructive" : "bg-success"
            }`} />
          )}
        </div>
        <p className="flex-1 font-heading font-bold text-sm text-right">{student.name}</p>
        {!isMobile && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => onSwipe(student.id, "left")} className={student.status === "present" ? "bg-success/20" : ""}>✓</Button>
            <Button size="sm" variant="outline" onClick={() => onSwipe(student.id, "right")} className={student.status === "absent" ? "bg-destructive/20" : ""}>✗</Button>
            <Button size="sm" variant="outline" onClick={() => onSwipe(student.id, "late")} className={student.status === "late" ? "bg-warning/20" : ""}>⏰</Button>
            <Button size="sm" variant="outline" onClick={() => onLongPress(student.id)}>📝</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const RollCallPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
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
        if (cls.length > 0) setSelectedClass(cls[0].id);
      }
    };
    loadClasses();
  }, [profile.id]);

  useEffect(() => {
    if (!selectedClass) return;
    const loadStudents = async () => {
      setLoading(true);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").eq("class_id", selectedClass).eq("is_approved", true);
      if (!profiles) { setStudents([]); setLoading(false); return; }
      const { data: avatars } = await supabase.from("avatars").select("*").in("user_id", profiles.map(p => p.id));
      const avatarMap = new Map((avatars || []).map(a => [a.user_id, {
        body_type: a.face_shape || "basic", eye_color: a.eye_color || "brown", skin: a.skin_color || "#FDDBB4", hair_style: a.hair_style || "boy", hair_color: a.hair_color || "#2C1A0E",
      }]));

      setStudents(profiles.map(p => ({ id: p.id, name: p.full_name, avatar: avatarMap.get(p.id) || null, status: null, notes: [], isBirthday: false })));
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">הקראת שמות</h1>
        <div className="flex gap-2 items-center">
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

      {loading ? <div className="py-20 text-center text-muted-foreground">טוען תלמידים...</div> :
      viewMode === "list" ? (
        <div className="space-y-2">
            {students.map(s => <SwipeableStudentRow key={s.id} student={s} isMobile={isMobile} onSwipe={handleSwipe} onLongPress={setNoteStudentId} />)}
        </div>
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
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 text-sm"
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
