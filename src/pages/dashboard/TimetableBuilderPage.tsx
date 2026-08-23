import { useEffect, useState } from "react";
import { useOutletContext, Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, DoorOpen, ClipboardList, Users, Wand2 } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSchoolDays } from "@/hooks/useSchoolDays";
import { SUBJECTS, type GradeLevel } from "@/lib/constants";
import BellScheduleSetup from "@/components/timetable-builder/BellScheduleSetup";
import RoomsManager from "@/components/timetable-builder/RoomsManager";
import SubjectRequirementsEditor from "@/components/timetable-builder/SubjectRequirementsEditor";
import CoordinatorTeacherHours from "@/components/timetable-builder/CoordinatorTeacherHours";
import TeacherCountsBySubject from "@/components/timetable-builder/TeacherCountsBySubject";
import GeneratedTimetablePreview from "@/components/timetable-builder/GeneratedTimetablePreview";
import {
  generateTimetable,
  sanitizePlaceholderTeacher,
  type GeneratedSlot,
  type GeneratorClass,
  type GeneratorRequirement,
  type EligibleTeacher,
  type RoomInfo,
  type TimetableConflict,
} from "@/lib/timetableGenerator";

// A school day shouldn't end earlier than this just because a class's total
// weekly hours happen to be light on a given day - flagged as a warning so
// the principal can see it and add hours/rebalance rather than it passing silently.
const MIN_DAILY_END_TIME = "12:50";

const TimetableBuilderPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();

  const canManageSetup = profile.roles.some(r => ["grade_coordinator", "management", "system_admin"].includes(r));
  const canPlaceStaff = canManageSetup || profile.roles.includes("subject_coordinator");
  const canAccess = canManageSetup || canPlaceStaff;

  const [tab, setTab] = useState(canManageSetup ? "bell" : "staff");
  const days = useSchoolDays(profile.schoolId, tab);

  const [approved, setApproved] = useState(false);
  const [approvedChecked, setApprovedChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [classes, setClasses] = useState<GeneratorClass[]>([]);
  const [periods, setPeriods] = useState<{ lesson_number: number; label: string }[]>([]);
  const [eligibleTeachers, setEligibleTeachers] = useState<EligibleTeacher[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [slots, setSlots] = useState<GeneratedSlot[]>([]);
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [hoursSubjects, setHoursSubjects] = useState<string[]>([]);
  const [teacherCountsReady, setTeacherCountsReady] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  const [subjectRoomTypes, setSubjectRoomTypes] = useState<Record<string, string | null>>({});
  const [subjectTrackGroup, setSubjectTrackGroup] = useState<Record<string, string>>({});

  useEffect(() => {
    // Re-fetch every time the generate tab is opened, not just once on page
    // load - otherwise subjects added later in "תכנית שעות" (a sibling tab
    // that Radix keeps mounted the whole time) would never show up here.
    if (!profile.schoolId || tab !== "generate") return;
    supabase.from("subject_requirements").select("subject").eq("school_id", profile.schoolId)
      .then(({ data }) => setHoursSubjects(Array.from(new Set((data || []).map((r: any) => r.subject as string))).sort()));
  }, [profile.schoolId, tab]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;
  if (!profile.schoolId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Wand2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>בניית מערכת שעות זמינה רק למשתמש/ת המשויכ/ת לבית ספר ספציפי — חשבון מנהל/ת מערכת כללי אינו משויך לבית ספר אחד.</p>
        </CardContent>
      </Card>
    );
  }

  const checkApproval = async () => {
    const { data } = await supabase
      .from("school_timetable_settings")
      .select("hours_template_approved")
      .eq("school_id", profile.schoolId!)
      .maybeSingle();
    setApproved(!!data?.hours_template_approved);
    setApprovedChecked(true);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await checkApproval();

    const schoolId = profile.schoolId!;
    const [classesRes, bellRes, reqRes, tcRes, roleRes, profilesRes, roomsRes, existingRes, teacherCountsRes] = await Promise.all([
      supabase.from("classes").select("id, grade, class_number").eq("school_id", schoolId),
      supabase.from("bell_schedule").select("lesson_number, label, end_time, is_break").eq("school_id", schoolId).order("lesson_number"),
      supabase.from("subject_requirements").select("*").eq("school_id", schoolId),
      supabase.from("teacher_classes").select("user_id, class_id"),
      supabase.from("user_roles").select("user_id, subject").eq("role", "professional_teacher"),
      supabase.from("profiles").select("id, full_name").eq("school_id", schoolId),
      supabase.from("rooms").select("name, room_type, capacity").eq("school_id", schoolId),
      supabase.from("timetable_slots").select("*").eq("school_id", schoolId),
      supabase.from("subject_teacher_counts").select("subject, teacher_count").eq("school_id", schoolId),
    ]);

    if (!reqRes.data?.length) {
      toast({ title: "לא הוגדרה תכנית שעות", description: "יש להשלים את הטאב 'תכנית שעות ואישור' קודם", variant: "destructive" });
      setGenerating(false);
      return;
    }

    const classList: GeneratorClass[] = (classesRes.data || []) as GeneratorClass[];
    setClasses(classList);

    const roomTypesBySubject: Record<string, string | null> = {};
    const trackGroupBySubject: Record<string, string> = {};
    for (const r of reqRes.data as any[]) {
      if (r.preferred_room_type && !roomTypesBySubject[r.subject]) roomTypesBySubject[r.subject] = r.preferred_room_type;
      if (r.track_group) trackGroupBySubject[r.subject] = r.track_group;
    }
    setSubjectRoomTypes(roomTypesBySubject);
    setSubjectTrackGroup(trackGroupBySubject);

    const nonBreakBell = (bellRes.data || []).filter((b: any) => !b.is_break).sort((a: any, b: any) => a.lesson_number - b.lesson_number);
    const periodList = nonBreakBell.map((b: any) => ({ lesson_number: b.lesson_number, label: b.label }));
    setPeriods(periodList);
    const endTimeByLesson = new Map<number, string>(nonBreakBell.map((b: any) => [b.lesson_number, b.end_time?.slice(0, 5)]));

    const profilesById = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name]));
    const subjectByTeacher = new Map((roleRes.data || []).map((r: any) => [r.user_id, r.subject]));
    const teachers: EligibleTeacher[] = (tcRes.data || [])
      .map((tc: any) => {
        const subject = subjectByTeacher.get(tc.user_id);
        const teacherName = profilesById.get(tc.user_id);
        if (!subject || !teacherName) return null;
        return { class_id: tc.class_id, subject, teacher_id: tc.user_id, teacher_name: teacherName };
      })
      .filter((t): t is EligibleTeacher => t !== null);

    const roomList: RoomInfo[] = roomsRes.data || [];
    setRooms(roomList);

    const existingSlots: GeneratedSlot[] = clearExisting ? [] : (existingRes.data || []).map((s: any) => ({
      class_id: s.class_id,
      day_of_week: s.day_of_week,
      lesson_number: s.lesson_number,
      subject: s.subject,
      teacher_id: s.teacher_id,
      teacher_name: s.teacher_name,
      room: s.room,
      group_name: s.group_name,
    }));

    const existingCounts = new Map<string, number>();
    for (const s of existingSlots) {
      const k = `${s.class_id}-${s.subject}`;
      existingCounts.set(k, (existingCounts.get(k) || 0) + 1);
    }

    // Resolve grade-wide defaults + per-class overrides into one requirement per class.
    const requirementsByGrade = new Map<string, any>();
    const overridesByClass = new Map<string, any>();
    for (const r of reqRes.data as any[]) {
      if (r.class_id) overridesByClass.set(`${r.class_id}-${r.subject}`, r);
      else requirementsByGrade.set(`${r.grade}-${r.subject}`, r);
    }

    const resolved: GeneratorRequirement[] = [];
    for (const cls of classList) {
      const subjectsForGrade = new Set<string>();
      for (const r of reqRes.data as any[]) {
        if (r.grade === cls.grade) subjectsForGrade.add(r.subject);
      }
      for (const subject of subjectsForGrade) {
        const override = overridesByClass.get(`${cls.id}-${subject}`);
        const base = override || requirementsByGrade.get(`${cls.grade}-${subject}`);
        if (!base) continue;
        const already = existingCounts.get(`${cls.id}-${subject}`) || 0;
        const remaining = Math.max(0, base.weekly_hours - already);
        if (remaining <= 0) continue;
        resolved.push({
          class_id: cls.id,
          grade: cls.grade as GradeLevel,
          subject,
          weekly_hours: remaining,
          block_size: base.block_size,
          group_count: base.group_count,
          preferred_room_type: base.preferred_room_type,
          is_grade_wide: !!base.is_grade_wide,
          track_group: base.track_group ?? null,
        });
      }
    }

    // Grade-wide and track-block subjects are placed as ONE shared unit for
    // the whole grade - if classes ended up with different "remaining" hours
    // (e.g. some already partially scheduled from a prior run), the generator
    // would only build as many hours as the least-scheduled class needed,
    // silently under-scheduling the rest of the grade. Normalize every class
    // up to the group's own maximum instead - but keyed per SUBJECT, not just
    // per track_group: a track block's options can legitimately need
    // different totals from each other (e.g. a 10-hour מדעי המחשב option
    // sharing a slot with 4-hour כימיה/ביולוגיה options), and grouping by
    // track_group alone previously collapsed every option in the block up to
    // whichever one asked for the most hours - silently overriding the
    // school's own per-option numbers instead of just reconciling the same
    // option across classes.
    const maxByGroup = new Map<string, number>();
    for (const r of resolved) {
      if (!r.is_grade_wide && !r.track_group) continue;
      const k = r.track_group ? `track::${r.grade}::${r.track_group}::${r.subject}` : `wide::${r.grade}::${r.subject}`;
      maxByGroup.set(k, Math.max(maxByGroup.get(k) ?? 0, r.weekly_hours));
    }
    for (const r of resolved) {
      if (!r.is_grade_wide && !r.track_group) continue;
      const k = r.track_group ? `track::${r.grade}::${r.track_group}::${r.subject}` : `wide::${r.grade}::${r.subject}`;
      r.weekly_hours = maxByGroup.get(k)!;
    }

    // Placeholder teachers ("<subject> - מורה N"), sized from the school-wide
    // teacher headcount per subject entered in "תכנית שעות". These let the
    // generator cap how many classes get the same subject at the same slot
    // even before real teacher_classes assignments exist - real named
    // teachers are tried first (they're earlier in the array).
    const teacherCountBySubject = new Map<string, number>(
      (teacherCountsRes.data || []).map((r: any) => [r.subject, r.teacher_count])
    );
    const subjectsNeeded = new Set(resolved.map(r => r.subject));
    const placeholders: EligibleTeacher[] = [];
    for (const subject of subjectsNeeded) {
      const count = teacherCountBySubject.get(subject);
      if (!count) continue;
      const classesNeedingSubject = resolved.filter(r => r.subject === subject).map(r => r.class_id);
      for (const classId of classesNeedingSubject) {
        for (let n = 1; n <= count; n++) {
          placeholders.push({
            class_id: classId,
            subject,
            teacher_id: `placeholder-${subject}-${n}`,
            teacher_name: `${subject} - מורה ${n}`,
          });
        }
      }
    }
    const allTeachers = [...teachers, ...placeholders];
    setEligibleTeachers(teachers); // manual-override dropdown offers real staff only, not placeholders

    const result = generateTimetable({
      classes: classList,
      periods: periodList.map(p => p.lesson_number),
      days,
      requirements: resolved,
      eligibleTeachers: allTeachers,
      unavailable: new Set(),
      rooms: roomList,
      lockedSlots: existingSlots,
    });

    const earlyEndingConflicts: TimetableConflict[] = [];
    const lastLessonByClassDay = new Map<string, { classId: string; day: number; lastLesson: number }>();
    for (const s of result.slots) {
      const k = `${s.class_id}::${s.day_of_week}`;
      const current = lastLessonByClassDay.get(k);
      if (!current || s.lesson_number > current.lastLesson) {
        lastLessonByClassDay.set(k, { classId: s.class_id, day: s.day_of_week, lastLesson: s.lesson_number });
      }
    }
    for (const { classId, lastLesson } of lastLessonByClassDay.values()) {
      const endTime = endTimeByLesson.get(lastLesson);
      if (endTime && endTime < MIN_DAILY_END_TIME) {
        const cls = classList.find(c => c.id === classId);
        earlyEndingConflicts.push({
          class_id: classId,
          grade: cls?.grade ?? null,
          subject: "-",
          reason: cls
            ? `יום הלימודים של כיתה ${cls.grade}'${cls.class_number} מסתיים ב-${endTime}, לפני השעה המינימלית ${MIN_DAILY_END_TIME} — כדאי להוסיף שעות שבועיות או לפזר טוב יותר בין הימים`
            : `יום לימודים מסתיים לפני ${MIN_DAILY_END_TIME}`,
          severity: "warning",
        });
      }
    }

    setSlots(result.slots.map(sanitizePlaceholderTeacher));
    setConflicts([...result.conflicts, ...earlyEndingConflicts]);
    setHasGenerated(true);
    setGenerating(false);
  };

  const handlePublish = async () => {
    if (!profile.schoolId || slots.length === 0) return;
    setPublishing(true);
    const schoolId = profile.schoolId;
    const affectedClassIds = Array.from(new Set(slots.map(s => s.class_id)));

    const { error: delError } = await supabase.from("timetable_slots").delete().eq("school_id", schoolId).in("class_id", affectedClassIds);
    if (delError) {
      toast({ title: "שגיאה בפרסום", description: delError.message, variant: "destructive" });
      setPublishing(false);
      return;
    }

    const { error: insError } = await supabase.from("timetable_slots").insert(
      slots.map(s => ({
        school_id: schoolId,
        class_id: s.class_id,
        day_of_week: s.day_of_week,
        lesson_number: s.lesson_number,
        subject: s.subject,
        teacher_id: s.teacher_id,
        teacher_name: s.teacher_name,
        room: s.room,
        group_name: s.group_name,
      }))
    );
    if (insError) {
      toast({ title: "שגיאה בפרסום", description: insError.message, variant: "destructive" });
      setPublishing(false);
      return;
    }

    toast({ title: "המערכת פורסמה בהצלחה ✅" });
    setPublishing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          בניית מערכת שעות
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          הגדרת יום הלימודים, חדרים, תכנית השעות ובנייה אוטומטית של מערכת בית ספרית
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full h-auto p-1 bg-muted/50 flex-wrap">
          {canManageSetup && (
            <>
              <TabsTrigger value="bell" className="flex-1 gap-1.5 py-2.5 text-sm"><Clock className="h-4 w-4" /> יום הלימודים</TabsTrigger>
              <TabsTrigger value="rooms" className="flex-1 gap-1.5 py-2.5 text-sm"><DoorOpen className="h-4 w-4" /> חדרים</TabsTrigger>
              <TabsTrigger value="hours" className="flex-1 gap-1.5 py-2.5 text-sm"><ClipboardList className="h-4 w-4" /> תכנית שעות</TabsTrigger>
              <TabsTrigger value="generate" className="flex-1 gap-1.5 py-2.5 text-sm"><Wand2 className="h-4 w-4" /> בנייה ופרסום</TabsTrigger>
            </>
          )}
          {canPlaceStaff && (
            <TabsTrigger value="staff" className="flex-1 gap-1.5 py-2.5 text-sm"><Users className="h-4 w-4" /> השלמות ותיקונים</TabsTrigger>
          )}
        </TabsList>

        {canManageSetup && (
          <>
            {/* Radix mounts every TabsContent immediately regardless of which
                tab is active, so a component that only fetches once on mount
                (rooms, subjects...) would freeze on whatever existed at page
                load. Gating the child on the active tab makes it remount -
                and refetch fresh - every time the user actually opens it. */}
            <TabsContent value="bell" className="mt-4">
              {tab === "bell" && <BellScheduleSetup schoolId={profile.schoolId} />}
            </TabsContent>

            <TabsContent value="rooms" className="mt-4">
              {tab === "rooms" && <RoomsManager schoolId={profile.schoolId} />}
            </TabsContent>

            <TabsContent value="hours" className="mt-4">
              {tab === "hours" && <SubjectRequirementsEditor schoolId={profile.schoolId} profile={profile} />}
            </TabsContent>
          </>
        )}

        {canPlaceStaff && (
          <TabsContent value="staff" className="mt-4 space-y-4">
            <Card className="border-primary/30">
              <CardContent className="py-4 text-sm text-muted-foreground">
                לשונית זו מיועדת להשלמה ותיקון ידני אחרי בניית המערכת האוטומטית (בטאב "בנייה ופרסום") — למשל שיבוץ שעה שהמערכת לא הצליחה למצוא לה מורה מתאים.
              </CardContent>
            </Card>
            {tab === "staff" && <CoordinatorTeacherHours schoolId={profile.schoolId} profile={profile} />}
          </TabsContent>
        )}

        {canManageSetup && <TabsContent value="generate" className="mt-4 space-y-4">
          {approvedChecked && !approved && (
            <Card className="border-amber-500/40">
              <CardContent className="py-4 text-sm">
                ⚠️ תכנית השעות טרם אושרה על ידי ההנהלה. ניתן להמשיך וליצור טיוטה, אך מומלץ לאשר את התכנית בטאב "תכנית שעות" לפני פרסום סופי.
              </CardContent>
            </Card>
          )}

          {tab === "generate" && (
            <TeacherCountsBySubject
              schoolId={profile.schoolId}
              subjects={hoursSubjects}
              highlightMissing
              onStatusChange={setTeacherCountsReady}
            />
          )}

          {!teacherCountsReady && hoursSubjects.length > 0 && (
            <p className="text-xs text-amber-600 text-center">יש למלא כמות מורים לכל מקצוע לפני הבנייה האוטומטית.</p>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer justify-center">
            <Checkbox checked={clearExisting} onCheckedChange={(v) => setClearExisting(!!v)} />
            נקה שיבוצים קיימים לפני הבנייה (התחלה נקייה — מומלץ אם משהו נראה לא תקין)
          </label>

          <Button
            onClick={handleGenerate}
            disabled={generating || (!teacherCountsReady && hoursSubjects.length > 0)}
            className="w-full gap-2"
          >
            <Wand2 className="h-4 w-4" />
            {generating ? "בונה מערכת..." : "בנה מערכת שעות אוטומטית"}
          </Button>

          {hasGenerated && classes.length > 0 && (
            <>
              <GeneratedTimetablePreview
                classes={classes}
                periods={periods}
                days={days}
                slots={slots}
                onSlotsChange={setSlots}
                conflicts={conflicts}
                eligibleTeachers={eligibleTeachers}
                rooms={rooms}
                subjects={[...SUBJECTS]}
                subjectRoomTypes={subjectRoomTypes}
                subjectTrackGroup={subjectTrackGroup}
              />
              <Button onClick={handlePublish} disabled={publishing} variant="default" className="w-full">
                {publishing ? "מפרסם..." : "פרסם מערכת"}
              </Button>
            </>
          )}
        </TabsContent>}
      </Tabs>
    </div>
  );
};

export default TimetableBuilderPage;
