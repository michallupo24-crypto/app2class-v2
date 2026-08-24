import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users } from "lucide-react";
import { HEBREW_DAYS } from "@/lib/constants";
import { useSchoolDays } from "@/hooks/useSchoolDays";
import type { UserProfile } from "@/hooks/useAuth";

interface TeacherRow {
  id: string;
  full_name: string;
  classes: { id: string; grade: string; class_number: number }[];
  requiredHours: number;
  scheduledHours: number;
}

interface CoordinatorTeacherHoursProps {
  schoolId: string;
  profile: UserProfile;
}

const CoordinatorTeacherHours = ({ schoolId, profile }: CoordinatorTeacherHoursProps) => {
  const { toast } = useToast();
  const days = useSchoolDays(schoolId);
  const [subject, setSubject] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [rooms, setRooms] = useState<{ name: string; room_type: string; capacity: number }[]>([]);
  const [requirements, setRequirements] = useState<{ grade: string; class_id: string | null; weekly_hours: number; preferred_room_type: string | null }[]>([]);
  const [classesById, setClassesById] = useState<Map<string, { grade: string; class_number: number }>>(new Map());
  const [periods, setPeriods] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingFor, setPlacingFor] = useState<string | null>(null);
  const [formClassId, setFormClassId] = useState("");
  const [formDay, setFormDay] = useState<string>("");
  const [formLesson, setFormLesson] = useState<string>("");
  const [formRoom, setFormRoom] = useState<string>("none");

  const loadData = async () => {
    setLoading(true);

    const { data: myRole } = await supabase
      .from("user_roles")
      .select("subject")
      .eq("user_id", profile.id)
      .eq("role", "subject_coordinator")
      .maybeSingle();
    const coordinatorSubject = myRole?.subject || null;
    setSubject(coordinatorSubject);

    if (!coordinatorSubject) {
      setTeachers([]);
      setLoading(false);
      return;
    }

    const [roleRes, bellRes, roomsRes, reqRes] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "professional_teacher").eq("subject", coordinatorSubject),
      supabase.from("bell_schedule").select("lesson_number, is_break").eq("school_id", schoolId).order("lesson_number"),
      supabase.from("rooms").select("name, room_type, capacity").eq("school_id", schoolId).order("name"),
      supabase.from("subject_requirements").select("grade, class_id, weekly_hours, preferred_room_type").eq("school_id", schoolId).eq("subject", coordinatorSubject),
    ]);

    setPeriods((bellRes.data || []).filter((b: any) => !b.is_break).map((b: any) => b.lesson_number));
    setRooms(roomsRes.data || []);
    setRequirements(reqRes.data || []);

    const teacherIds = (roleRes.data || []).map((r: any) => r.user_id);
    if (teacherIds.length === 0) {
      setTeachers([]);
      setLoading(false);
      return;
    }

    const [profilesRes, tcRes, classesRes, slotsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("school_id", schoolId).in("id", teacherIds),
      supabase.from("teacher_classes").select("user_id, class_id").in("user_id", teacherIds),
      supabase.from("classes").select("id, grade, class_number").eq("school_id", schoolId),
      supabase.from("timetable_slots").select("teacher_id").eq("school_id", schoolId).eq("subject", coordinatorSubject).in("teacher_id", teacherIds),
    ]);

    const classesById = new Map((classesRes.data || []).map((c: any) => [c.id, c]));
    setClassesById(classesById);
    const subjectRequirements = reqRes.data || [];

    const scheduledCounts = new Map<string, number>();
    for (const s of slotsRes.data || []) {
      scheduledCounts.set(s.teacher_id, (scheduledCounts.get(s.teacher_id) || 0) + 1);
    }

    const requiredHoursForClass = (classId: string) => {
      const cls = classesById.get(classId) as any;
      if (!cls) return 0;
      const specific = subjectRequirements.find((r: any) => r.class_id === classId);
      if (specific) return specific.weekly_hours;
      const gradeDefault = subjectRequirements.find((r: any) => r.class_id === null && r.grade === cls.grade);
      return gradeDefault?.weekly_hours || 0;
    };

    const list: TeacherRow[] = (profilesRes.data || []).map((p: any) => {
      const tcs = (tcRes.data || []).filter((tc: any) => tc.user_id === p.id);
      const classes = tcs
        .map((tc: any) => classesById.get(tc.class_id) as any)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, grade: c.grade, class_number: c.class_number }));
      const requiredHours = tcs.reduce((sum: number, tc: any) => sum + requiredHoursForClass(tc.class_id), 0);
      return {
        id: p.id,
        full_name: p.full_name,
        classes,
        requiredHours,
        scheduledHours: scheduledCounts.get(p.id) || 0,
      };
    });

    setTeachers(list.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, profile.id]);

  const resetForm = () => {
    setPlacingFor(null);
    setFormClassId("");
    setFormDay("");
    setFormLesson("");
    setFormRoom("none");
  };

  // Same class-override-then-grade-default resolution as requiredHoursForClass,
  // but for the room type this subject needs for that class - the manual
  // placement form must respect the same requirement the auto-generator does.
  const requiredRoomTypeForClass = (classId: string): string | null => {
    const cls = classesById.get(classId);
    if (!cls) return null;
    const specific = requirements.find(r => r.class_id === classId);
    if (specific) return specific.preferred_room_type;
    const gradeDefault = requirements.find(r => r.class_id === null && r.grade === cls.grade);
    return gradeDefault?.preferred_room_type ?? null;
  };

  const requiredRoomType = formClassId ? requiredRoomTypeForClass(formClassId) : null;
  const roomOptions = requiredRoomType ? rooms.filter(r => r.room_type === requiredRoomType) : rooms;

  const handlePlace = async (teacher: TeacherRow) => {
    if (!subject || !formClassId || formDay === "" || formLesson === "") return;
    const day = parseInt(formDay);
    const lesson = parseInt(formLesson);
    const room = formRoom === "none" ? null : formRoom;

    if (requiredRoomType && !room) {
      toast({ title: `מקצוע זה דורש חדר מסוג "${requiredRoomType}" — יש לבחור חדר`, variant: "destructive" });
      return;
    }
    if (requiredRoomType && room && rooms.find(r => r.name === room)?.room_type !== requiredRoomType) {
      toast({ title: `מקצוע זה דורש חדר מסוג "${requiredRoomType}"`, variant: "destructive" });
      return;
    }

    // A slot may already exist here from the automatic build (subject/room
    // set, teacher left empty) - fill it in rather than insert a duplicate.
    const { data: existingSlot } = await supabase
      .from("timetable_slots")
      .select("id, subject, teacher_id")
      .eq("school_id", schoolId)
      .eq("class_id", formClassId)
      .eq("day_of_week", day)
      .eq("lesson_number", lesson)
      .maybeSingle();

    if (existingSlot) {
      if (existingSlot.teacher_id) {
        toast({ title: "השעה כבר תפוסה עבור כיתה זו", variant: "destructive" });
        return;
      }
      if (existingSlot.subject !== subject) {
        toast({ title: `השעה כבר תפוסה במקצוע אחר (${existingSlot.subject})`, variant: "destructive" });
        return;
      }
    }

    const { data: teacherConflict } = await supabase
      .from("timetable_slots")
      .select("id")
      .eq("school_id", schoolId)
      .eq("teacher_id", teacher.id)
      .eq("day_of_week", day)
      .eq("lesson_number", lesson)
      .maybeSingle();
    if (teacherConflict) {
      toast({ title: "המורה כבר משובץ בשעה זו", variant: "destructive" });
      return;
    }

    if (room) {
      // Filling in an existing generator-placed slot updates that row in
      // place rather than adding a new occupant - exclude it from its own
      // room's occupancy count, or a single-capacity room the generator
      // already assigned to this exact slot would always read as "full"
      // and block the coordinator from ever completing it.
      let roomCountQuery = supabase
        .from("timetable_slots")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("room", room)
        .eq("day_of_week", day)
        .eq("lesson_number", lesson);
      if (existingSlot) roomCountQuery = roomCountQuery.neq("id", existingSlot.id);
      const { count } = await roomCountQuery;
      const capacity = rooms.find(r => r.name === room)?.capacity ?? 1;
      if ((count ?? 0) >= capacity) {
        toast({ title: "החדר מלא בשעה זו (הגיע למספר הכיתות המרבי)", variant: "destructive" });
        return;
      }
    }

    const { error } = existingSlot
      ? await supabase.from("timetable_slots").update({
          teacher_id: teacher.id,
          teacher_name: teacher.full_name,
          room: room ?? undefined,
        }).eq("id", existingSlot.id)
      : await supabase.from("timetable_slots").insert({
          school_id: schoolId,
          class_id: formClassId,
          day_of_week: day,
          lesson_number: lesson,
          subject,
          teacher_id: teacher.id,
          teacher_name: teacher.full_name,
          room,
        });

    if (error) {
      const friendly = error.code === "23505"
        ? "השעה כבר תפוסה (מורה, כיתה או חדר)"
        : error.message;
      toast({ title: "שגיאה בשיבוץ", description: friendly, variant: "destructive" });
      return;
    }

    toast({ title: "שובץ בהצלחה ✅" });
    resetForm();
    loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!subject) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>מסך זה מיועד לרכזי מקצוע — לא נמצא מקצוע המשויך לתפקיד שלך</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">מקצוע: <Badge variant="secondary">{subject}</Badge></p>

      {teachers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>אין מורים מקצועיים רשומים במקצוע זה</p>
          </CardContent>
        </Card>
      ) : (
        teachers.map(teacher => (
          <Card key={teacher.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base font-heading">{teacher.full_name}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    if (placingFor === teacher.id) {
                      resetForm();
                    } else {
                      setPlacingFor(teacher.id);
                      setFormClassId(teacher.classes[0]?.id || "");
                    }
                  }}
                  disabled={teacher.classes.length === 0}
                >
                  <Plus className="h-3.5 w-3.5" /> הוסף שיבוץ
                </Button>
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{teacher.scheduledHours} / {teacher.requiredHours || "?"} שעות משובצות</span>
                </div>
                {teacher.requiredHours > 0 && (
                  <Progress value={Math.min(100, (teacher.scheduledHours / teacher.requiredHours) * 100)} />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-2">
                {teacher.classes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">לא שובץ לכיתות עדיין</p>
                ) : (
                  teacher.classes.map(c => (
                    <Badge key={c.id} variant="outline">{c.grade}'{c.class_number}</Badge>
                  ))
                )}
              </div>

              {placingFor === teacher.id && (
                <div className="flex flex-wrap gap-2 items-end border-t border-border pt-3 mt-3">
                  <Select value={formClassId} onValueChange={setFormClassId}>
                    <SelectTrigger className="w-24"><SelectValue placeholder="כיתה" /></SelectTrigger>
                    <SelectContent>
                      {teacher.classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.grade}'{c.class_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formDay} onValueChange={setFormDay}>
                    <SelectTrigger className="w-24"><SelectValue placeholder="יום" /></SelectTrigger>
                    <SelectContent>
                      {days.map(d => <SelectItem key={d} value={String(d)}>{HEBREW_DAYS[d]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={formLesson} onValueChange={setFormLesson}>
                    <SelectTrigger className="w-24"><SelectValue placeholder="שעה" /></SelectTrigger>
                    <SelectContent>
                      {periods.map(p => <SelectItem key={p} value={String(p)}>שיעור {p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={formRoom} onValueChange={setFormRoom}>
                    <SelectTrigger className="w-28"><SelectValue placeholder="חדר" /></SelectTrigger>
                    <SelectContent>
                      {!requiredRoomType && <SelectItem value="none">ללא חדר</SelectItem>}
                      {roomOptions.map(r => <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handlePlace(teacher)}>שבץ</Button>
                  {requiredRoomType && (
                    <p className="w-full text-xs text-amber-600">מקצוע זה דורש חדר מסוג "{requiredRoomType}"</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default CoordinatorTeacherHours;
