import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle2, AlertTriangle, Plus, Trash2, Layers, MoreVertical } from "lucide-react";
import { GRADES, type GradeLevel } from "@/lib/constants";
import { MOE_SUBJECT_HOURS_TEMPLATE } from "@/lib/moeSubjectHoursTemplate";
import TeacherCountsBySubject from "@/components/timetable-builder/TeacherCountsBySubject";
import TrackBlocksEditor from "@/components/timetable-builder/TrackBlocksEditor";
import type { UserProfile } from "@/hooks/useAuth";

interface Requirement {
  id: string;
  grade: GradeLevel;
  subject: string;
  weekly_hours: number;
  block_size: number;
  group_count: number;
  preferred_room_type: string | null;
  is_grade_wide: boolean;
  track_group: string | null;
  track_kind: string | null;
  base_subject: string | null;
}

interface SubjectRequirementsEditorProps {
  schoolId: string;
  profile: UserProfile;
}

const SubjectRequirementsEditor = ({ schoolId, profile }: SubjectRequirementsEditorProps) => {
  const { toast } = useToast();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const canApprove = profile.roles.some(r => ["management", "system_admin"].includes(r));

  const loadData = async () => {
    setLoading(true);
    const [reqRes, settingsRes, roomsRes] = await Promise.all([
      supabase.from("subject_requirements").select("*").eq("school_id", schoolId).order("grade").order("subject"),
      supabase.from("school_timetable_settings").select("hours_template_approved").eq("school_id", schoolId).maybeSingle(),
      supabase.from("rooms").select("room_type").eq("school_id", schoolId),
    ]);

    setRoomTypes(Array.from(new Set((roomsRes.data || []).map((r: any) => r.room_type as string))));
    setApproved(!!settingsRes.data?.hours_template_approved);

    if (!reqRes.data || reqRes.data.length === 0) {
      // First time this school opens the tab: seed from the starter template.
      const { error: seedError } = await supabase.from("subject_requirements").insert(
        MOE_SUBJECT_HOURS_TEMPLATE.map(t => ({
          school_id: schoolId,
          grade: t.grade,
          subject: t.subject,
          weekly_hours: t.weekly_hours,
          is_grade_wide: !!t.gradeWide,
        }))
      );
      if (!seedError) {
        const { data: seeded } = await supabase.from("subject_requirements").select("*").eq("school_id", schoolId).order("grade").order("subject");
        setRequirements((seeded || []) as Requirement[]);
      }
    } else {
      setRequirements(reqRes.data as Requirement[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const clearApproval = async () => {
    if (!approved) return;
    await supabase.from("school_timetable_settings").upsert({
      school_id: schoolId,
      hours_template_approved: false,
      hours_template_approved_by: null,
      hours_template_approved_at: null,
      updated_at: new Date().toISOString(),
    });
    setApproved(false);
  };

  const handleUpdate = async (id: string, patch: Partial<Requirement>) => {
    setRequirements(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("subject_requirements").update(patch).eq("id", id);
    if (error) {
      toast({ title: "שגיאה בעדכון", description: error.message, variant: "destructive" });
      return;
    }
    clearApproval();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("subject_requirements").delete().eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setRequirements(rs => rs.filter(r => r.id !== id));
    clearApproval();
  };

  const handleAdd = async (grade: GradeLevel, subject: string, hours: number) => {
    if (!hours || hours <= 0) return;
    // The grade-default row (class_id null) is unique per (grade, subject) at
    // the DB level, but that only rejects the insert after the fact - check
    // first so the coordinator gets a clear "it already exists, edit it
    // above" message instead of a raw constraint-violation error, and so two
    // conflicting default rows for the same subject can never silently coexist.
    const alreadyExists = requirements.some(r => r.grade === grade && r.subject === subject && !r.track_group);
    if (alreadyExists) {
      toast({ title: `${subject} כבר מוגדר/ת לשכבה ${grade}'`, description: "ניתן לערוך את השעות בשורה הקיימת למעלה", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.from("subject_requirements").insert({
      school_id: schoolId,
      grade,
      subject,
      weekly_hours: hours,
    }).select().single();
    if (error) {
      toast({ title: "שגיאה בהוספה", description: error.message, variant: "destructive" });
      return;
    }
    setRequirements(rs => [...rs, data as Requirement]);
    clearApproval();
    toast({ title: "נוסף בהצלחה ✅" });
  };

  // Converts an existing plain subject row in-place into the first level of
  // a הקבצה: same row (keeps its room/is_grade_wide/etc.), just renamed to
  // "<subject> (<level>)" and tagged so it becomes a track_group of one -
  // more levels can then be added to it via TrackBlocksEditor's own "add"
  // row for that block, same as a הקבצה created from scratch.
  const handleConvertToHakbatza = async (item: Requirement, level: string) => {
    const trimmed = level.trim();
    if (!trimmed) return;
    const patch = {
      subject: `${item.subject} (${trimmed})`,
      track_group: `${item.subject} - הקבצות`,
      track_kind: "hakbatza",
      base_subject: item.subject,
    };
    const { error } = await supabase.from("subject_requirements").update(patch).eq("id", item.id);
    if (error) {
      toast({ title: "שגיאה בהמרה להקבצה", description: error.message, variant: "destructive" });
      return;
    }
    setConvertingId(null);
    toast({ title: "המקצוע הפך להקבצה — כעת אפשר להוסיף לו עוד רמות למטה ✅" });
    clearApproval();
    loadData();
  };

  const handleApprove = async () => {
    const { error } = await supabase.from("school_timetable_settings").upsert({
      school_id: schoolId,
      hours_template_approved: true,
      hours_template_approved_by: profile.id,
      hours_template_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast({ title: "שגיאה באישור", description: error.message, variant: "destructive" });
      return;
    }
    setApproved(true);
    toast({ title: "תכנית השעות אושרה ✅" });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const byGrade = GRADES.map(g => ({ grade: g, items: requirements.filter(r => r.grade === g && !r.track_group) }));
  const distinctSubjects = Array.from(new Set(requirements.map(r => r.subject))).sort();

  return (
    <div className="space-y-6">
      {/* Shared autocomplete source for every subject-name input below (plain
          "add subject" rows and track/הקבצה option rows alike) - lets a
          coordinator pick an existing subject instead of retyping it and
          accidentally creating a near-duplicate like "אומנות"/"אמנות". */}
      <datalist id="known-subjects">
        {distinctSubjects.map(s => <option key={s} value={s} />)}
      </datalist>
      <Card className={approved ? "border-emerald-500/40" : "border-amber-500/40"}>
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {approved ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="font-heading font-bold text-sm">✅ תכנית השעות מאושרת</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="font-heading font-bold text-sm">⚠️ תכנית השעות טרם אושרה</span>
              </>
            )}
          </div>
          {canApprove ? (
            !approved && <Button size="sm" onClick={handleApprove}>אשר תכנית שעות</Button>
          ) : (
            <span className="text-xs text-muted-foreground">רק הנהלה יכולה לאשר את התכנית</span>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        שכבות ז'–ט': מבוסס על חוזר מנכ"ל תשס"ט/8(א) סעיף 3.1-36 (תוכנית היסוד לחטיבות הביניים, ממ"ד כללי) — המסמך המחייב היחיד שקיים. שכבות י'–יב': אין חוזר מחייב מקביל לחטיבה העליונה, לכן אלו אומדן נהוג הנגזר מדרישות הבגרות בלבד. בכל מקרה ייתכנו הבדלי זרם/מגמות/תנאים בבית הספר שלכם — יש לבדוק ולעדכן את המספרים לפני האישור.
      </p>
      <p className="text-xs text-muted-foreground">
        <Layers className="h-3 w-3 inline ml-1" />
        סימון "שכבתי" אומר שכל כיתות השכבה ילמדו את המקצוע באותה שעה בדיוק — נדרש למקצועות עם הקבצות חוצות-כיתה (למשל מתמטיקה, אנגלית) או למגמות. מסומן כברירת מחדל למתמטיקה ואנגלית; ניתן לשנות לפי המצב בבית הספר.
      </p>

      {byGrade.map(({ grade, items }) => (
        <Card key={grade}>
          <CardHeader>
            <CardTitle className="text-lg font-heading">שכבה {grade}'</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין מקצועות מוגדרים לשכבה זו</p>
            ) : (
              items.map(item => (
                <div key={item.id}>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 flex-wrap">
                    <Badge variant="outline" className="min-w-[90px] justify-center">{item.subject}</Badge>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="w-16"
                        value={item.weekly_hours}
                        onChange={(e) => handleUpdate(item.id, { weekly_hours: parseInt(e.target.value) || 1 })}
                      />
                      <span className="text-xs text-muted-foreground">שעות/שבוע</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="w-16"
                        value={item.block_size}
                        onChange={(e) => handleUpdate(item.id, { block_size: parseInt(e.target.value) || 1 })}
                      />
                      <span className="text-xs text-muted-foreground">גודל בלוק</span>
                    </div>
                    <Select
                      value={item.preferred_room_type || "none"}
                      onValueChange={(v) => handleUpdate(item.id, { preferred_room_type: v === "none" ? null : v })}
                    >
                      <SelectTrigger className="w-36"><SelectValue placeholder="סוג חדר" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">כל חדר</SelectItem>
                        {roomTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="כל הכיתות בשכבה ילמדו את המקצוע באותה שעה בדיוק (למשל הקבצות מתמטיקה/אנגלית או מגמות)">
                      <Switch
                        checked={item.is_grade_wide}
                        onCheckedChange={(v) => handleUpdate(item.id, { is_grade_wide: v })}
                      />
                      <Layers className="h-3.5 w-3.5" />
                      שכבתי
                    </label>
                    <div className="mr-auto flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => setConvertingId(item.id)}>
                            הפוך להקבצה (רמות לימוד)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemove(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {convertingId === item.id && (
                    <ConvertToHakbatzaRow
                      subject={item.subject}
                      onConfirm={(level) => handleConvertToHakbatza(item, level)}
                      onCancel={() => setConvertingId(null)}
                    />
                  )}
                </div>
              ))
            )}
            <AddSubjectRow
              existingSubjects={items.map(i => i.subject)}
              allSubjects={distinctSubjects}
              onAdd={(subject, hours) => handleAdd(grade, subject, hours)}
            />
            <TrackBlocksEditor schoolId={schoolId} grade={grade} roomTypes={roomTypes} onChanged={loadData} />
          </CardContent>
        </Card>
      ))}

      <TeacherCountsBySubject schoolId={schoolId} subjects={distinctSubjects} />
    </div>
  );
};

const AddSubjectRow = ({ existingSubjects, allSubjects, onAdd }: { existingSubjects: string[]; allSubjects: string[]; onAdd: (subject: string, hours: number) => void }) => {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [hours, setHours] = useState("2");

  const handleAdd = () => {
    const trimmed = subject.trim();
    if (!trimmed) {
      toast({ title: "יש להזין שם מקצוע", variant: "destructive" });
      return;
    }
    if (existingSubjects.includes(trimmed)) {
      toast({ title: `${trimmed} כבר מוגדר/ת לשכבה זו`, variant: "destructive" });
      return;
    }
    onAdd(trimmed, parseInt(hours) || 1);
    setSubject("");
    setHours("2");
  };

  return (
    <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-border/40">
      <Input
        placeholder='שם מקצוע (למשל: "מדעי המחשב")'
        className="w-48 h-8"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        list="known-subjects"
      />
      <Input type="number" className="w-20 h-8" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="שעות" />
      <Button size="sm" className="gap-1 h-8" onClick={handleAdd}>
        <Plus className="h-3.5 w-3.5" /> הוסף מקצוע לשכבה זו
      </Button>
    </div>
  );
};

const ConvertToHakbatzaRow = ({ subject, onConfirm, onCancel }: { subject: string; onConfirm: (level: string) => void; onCancel: () => void }) => {
  const [level, setLevel] = useState("");
  return (
    <div className="flex flex-wrap gap-2 items-end p-2 mt-1 rounded-lg bg-primary/5 border border-primary/20">
      <p className="text-xs text-muted-foreground w-full">
        "{subject}" יהפוך להקבצה — רמה ראשונה תיקרא "{subject} ({level || "..."})", ואפשר יהיה להוסיף לה עוד רמות למטה.
      </p>
      <Input
        placeholder='שם הרמה הראשונה (למשל: "5 יח״ל")'
        className="w-48 h-8"
        value={level}
        onChange={(e) => setLevel(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && level.trim() && onConfirm(level)}
        autoFocus
      />
      <Button size="sm" className="h-8" onClick={() => onConfirm(level)} disabled={!level.trim()}>אשר</Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>ביטול</Button>
    </div>
  );
};

export default SubjectRequirementsEditor;
