import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Route, Layers } from "lucide-react";
import type { GradeLevel } from "@/lib/constants";

type TrackKind = "megama" | "hakbatza";

interface TrackOption {
  id: string;
  subject: string;
  preferred_room_type: string | null;
  weeklyHours: number;
}

interface TrackBlock {
  trackGroup: string;
  trackKind: TrackKind;
  baseSubject: string | null;
  weeklyHours: number;
  blockSize: number;
  options: TrackOption[];
}

interface TrackBlocksEditorProps {
  schoolId: string;
  grade: GradeLevel;
  roomTypes: string[];
}

// A מגמה (elective) block is several DIFFERENT subjects sharing one slot -
// what the coordinator types as options is entirely up to their own school's
// program, so every name here is free text rather than a fixed national list
// (the old hardcoded MEGAMOT list flattened two clusters into one
// deduplicated set, silently losing which cluster an option like "פיזיקה"
// belonged to).
// A הקבצה (ability group) block is the SAME underlying mechanism - one
// shared grade-wide slot, several options, each its own teacher/room - but
// every option is really the same base subject at a different level, so its
// "subject" is auto-composed as "<subject> (<level>)" to keep options
// distinct while base_subject records the plain name for grouping/reporting.
// Scoped to a single grade and rendered inside that grade's own card in
// SubjectRequirementsEditor, alongside its regular subjects and the plain
// "add subject" row - so every grade block offers all three add actions in
// one place instead of a separate page-wide section per kind.
const TrackBlocksEditor = ({ schoolId, grade, roomTypes }: TrackBlocksEditorProps) => {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<TrackBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<TrackKind | null>(null);

  const [newKind, setNewKind] = useState<TrackKind>("megama");
  const [newGroupName, setNewGroupName] = useState(""); // cluster name (megama) or base subject (hakbatza)
  const [newFirstOption, setNewFirstOption] = useState(""); // first subject (megama) or first level label (hakbatza)
  const [newHours, setNewHours] = useState("4");

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("subject_requirements")
      .select("*")
      .eq("school_id", schoolId)
      .eq("grade", grade)
      .not("track_group", "is", null);

    const grouped = new Map<string, TrackBlock>();
    for (const row of (data || []) as any[]) {
      const k = row.track_group;
      if (!grouped.has(k)) {
        grouped.set(k, {
          trackGroup: row.track_group,
          trackKind: (row.track_kind as TrackKind) || "megama",
          baseSubject: row.base_subject,
          weeklyHours: row.weekly_hours,
          blockSize: row.block_size,
          options: [],
        });
      }
      grouped.get(k)!.options.push({ id: row.id, subject: row.subject, preferred_room_type: row.preferred_room_type, weeklyHours: row.weekly_hours });
    }
    setBlocks(Array.from(grouped.values()));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, grade]);

  const clearApproval = async () => {
    await supabase.from("school_timetable_settings").upsert({
      school_id: schoolId,
      hours_template_approved: false,
      hours_template_approved_by: null,
      hours_template_approved_at: null,
      updated_at: new Date().toISOString(),
    });
  };

  const handleCreateBlock = async () => {
    const groupLabel = newGroupName.trim();
    const firstOption = newFirstOption.trim();
    if (!groupLabel) {
      toast({ title: newKind === "hakbatza" ? "יש להזין שם מקצוע" : "יש להזין שם לאשכול", variant: "destructive" });
      return;
    }
    if (!firstOption) {
      toast({ title: newKind === "hakbatza" ? "יש להזין רמה ראשונה" : "יש להזין אפשרות ראשונה", variant: "destructive" });
      return;
    }
    const hours = parseInt(newHours) || 1;
    const trackGroup = newKind === "hakbatza" ? `${groupLabel} - הקבצות` : groupLabel;
    const subject = newKind === "hakbatza" ? `${groupLabel} (${firstOption})` : firstOption;
    const { error } = await supabase.from("subject_requirements").insert({
      school_id: schoolId,
      grade,
      subject,
      weekly_hours: hours,
      block_size: Math.min(hours, 2),
      track_group: trackGroup,
      track_kind: newKind,
      base_subject: newKind === "hakbatza" ? groupLabel : null,
    });
    if (error) {
      toast({ title: newKind === "hakbatza" ? "שגיאה ביצירת ההקבצה" : "שגיאה ביצירת המגמה", description: error.message, variant: "destructive" });
      return;
    }
    setNewGroupName("");
    setNewFirstOption("");
    setAdding(null);
    toast({ title: newKind === "hakbatza" ? "ההקבצה נוצרה — כעת הוסיפו לה עוד רמות ✅" : "המגמה נוצרה — כעת הוסיפו לה עוד אפשרויות ✅" });
    await clearApproval();
    loadData();
  };

  const handleAddOption = async (block: TrackBlock, optionInput: string) => {
    const value = optionInput.trim();
    if (!value) return;
    const subject = block.trackKind === "hakbatza" ? `${block.baseSubject} (${value})` : value;
    if (block.options.some(o => o.subject === subject)) {
      toast({ title: "האפשרות הזו כבר קיימת בבלוק", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("subject_requirements").insert({
      school_id: schoolId,
      grade,
      subject,
      weekly_hours: block.weeklyHours,
      block_size: block.blockSize,
      track_group: block.trackGroup,
      track_kind: block.trackKind,
      base_subject: block.trackKind === "hakbatza" ? block.baseSubject : null,
    });
    if (error) {
      toast({ title: "שגיאה בהוספת אפשרות", description: error.message, variant: "destructive" });
      return;
    }
    await clearApproval();
    loadData();
  };

  const handleRemoveOption = async (id: string) => {
    const { error } = await supabase.from("subject_requirements").delete().eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    await clearApproval();
    loadData();
  };

  const handleUpdateOptionRoom = async (id: string, room_type: string | null) => {
    const { error } = await supabase.from("subject_requirements").update({ preferred_room_type: room_type }).eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    await clearApproval();
    loadData();
  };

  // Each option can now carry its own weekly-hours (e.g. a 5-יח"ל group
  // meeting more hours/week than a 3-יח"ל group of the same הקבצה) - see
  // tryPlaceTrackBlock in timetableGenerator.ts, which already places every
  // round using only the options that still have hours left in it, so
  // options no longer have to share one identical total.
  const handleUpdateOptionHours = async (id: string, weekly_hours: number) => {
    if (!weekly_hours || weekly_hours <= 0) return;
    const { error } = await supabase.from("subject_requirements").update({ weekly_hours }).eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    await clearApproval();
    loadData();
  };

  // The block-level input is a bulk convenience ("שעות לכולם") - it sets
  // every current option to the same number in one click, but each option's
  // own input (below) can still be changed individually afterward.
  const handleUpdateBlockHours = async (block: TrackBlock, weekly_hours: number) => {
    if (!weekly_hours || weekly_hours <= 0) return;
    const { error } = await supabase
      .from("subject_requirements")
      .update({ weekly_hours, block_size: Math.min(block.blockSize, weekly_hours) })
      .eq("school_id", schoolId)
      .eq("grade", grade)
      .eq("track_group", block.trackGroup);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    await clearApproval();
    loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-3">
      {blocks.map(block => (
        <div key={block.trackGroup} className="border border-border/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {block.trackKind === "hakbatza" ? <Layers className="h-3.5 w-3.5 text-primary" /> : <Route className="h-3.5 w-3.5 text-primary" />}
              <span className="font-heading font-bold text-sm">
                {block.trackKind === "hakbatza" ? block.baseSubject : block.trackGroup}
              </span>
              <Badge variant="outline" className="text-[10px]">{block.trackKind === "hakbatza" ? "הקבצה" : "מגמה"}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                className="w-16 h-7"
                value={block.weeklyHours}
                onChange={(e) => handleUpdateBlockHours(block, parseInt(e.target.value) || 1)}
              />
              <span className="text-xs text-muted-foreground">שעות/שבוע לכולם</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {block.options.map(opt => (
              <div key={opt.id} className="flex items-center gap-2 bg-muted/30 rounded-md p-1.5">
                <span className="text-sm flex-1">{opt.subject}</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="w-14 h-7 text-xs"
                    value={opt.weeklyHours}
                    onChange={(e) => handleUpdateOptionHours(opt.id, parseInt(e.target.value) || 1)}
                  />
                  <span className="text-[10px] text-muted-foreground">שעות</span>
                </div>
                <Select
                  value={opt.preferred_room_type || "none"}
                  onValueChange={(v) => handleUpdateOptionRoom(opt.id, v === "none" ? null : v)}
                >
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="סוג חדר" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">כל חדר</SelectItem>
                    {roomTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveOption(opt.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <AddOptionRow
            placeholder={block.trackKind === "hakbatza" ? 'רמה חדשה (למשל: "5 יח״ל")' : "אפשרות חדשה למגמה..."}
            onAdd={(value) => handleAddOption(block, value)}
          />
        </div>
      ))}

      {adding ? (
        <div className="border border-dashed border-border rounded-lg p-3 flex flex-wrap gap-2 items-end">
          <Select value={newKind} onValueChange={(v) => setNewKind(v as TrackKind)}>
            <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="megama">מגמה</SelectItem>
              <SelectItem value="hakbatza">הקבצה</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={newKind === "hakbatza" ? 'שם המקצוע (למשל: "מתמטיקה")' : 'שם האשכול (למשל: "אשכול א׳")'}
            className="w-44 h-8"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <Input
            placeholder={newKind === "hakbatza" ? 'רמה ראשונה (למשל: "5 יח״ל")' : "אפשרות ראשונה"}
            className="w-40 h-8"
            value={newFirstOption}
            onChange={(e) => setNewFirstOption(e.target.value)}
          />
          <Input type="number" className="w-16 h-8" value={newHours} onChange={(e) => setNewHours(e.target.value)} placeholder="שעות" />
          <Button size="sm" onClick={handleCreateBlock} className="gap-1 h-8">
            <Plus className="h-3.5 w-3.5" /> צור
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAdding(null); setNewGroupName(""); setNewFirstOption(""); }}>
            ביטול
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNewKind("megama"); setAdding("megama"); }}>
            <Route className="h-3.5 w-3.5" /> הוסף אשכול מגמה
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNewKind("hakbatza"); setAdding("hakbatza"); }}>
            <Layers className="h-3.5 w-3.5" /> הוסף הקבצה
          </Button>
        </div>
      )}
    </div>
  );
};

const AddOptionRow = ({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) => {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-48 h-7 text-xs"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(""); } }}
      >
        הוסף
      </Button>
    </div>
  );
};

export default TrackBlocksEditor;
