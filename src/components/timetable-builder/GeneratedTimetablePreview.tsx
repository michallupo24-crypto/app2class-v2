import { useMemo, useState, type CSSProperties } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, XCircle, X, Printer } from "lucide-react";
import { HEBREW_DAYS } from "@/lib/constants";
import type { GeneratedSlot, TimetableConflict, EligibleTeacher, GeneratorClass, RoomInfo } from "@/lib/timetableGenerator";

interface BellPeriod {
  lesson_number: number;
  label: string;
}

// Deterministic subject -> hue, so every occurrence of a subject (across
// classes, across the legend, across re-renders) always gets the same color
// without needing a stored color-assignment table.
const subjectHue = (subject: string): number => {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return hash % 360;
};

interface GeneratedTimetablePreviewProps {
  classes: GeneratorClass[];
  periods: BellPeriod[];
  days: number[];
  slots: GeneratedSlot[];
  onSlotsChange: (slots: GeneratedSlot[]) => void;
  conflicts: TimetableConflict[];
  eligibleTeachers: EligibleTeacher[];
  rooms: RoomInfo[];
  subjects: string[];
  // subject -> the room_type it requires (null/undefined = any room is fine),
  // so manual edits here respect the same requirement the auto-generator does.
  subjectRoomTypes: Record<string, string | null>;
  // subject -> the track_group (cluster/הקבצה name) it belongs to, for
  // subjects that came from a track block. A class/day/lesson can legitimately
  // hold several rows at once here - one per option of a shared track/הקבצה
  // slot (see tryPlaceTrackBlock in timetableGenerator.ts) - so a cell needs
  // to show all of them together under their cluster name, not just
  // whichever one happens to be first.
  subjectTrackGroup: Record<string, string>;
}

const GeneratedTimetablePreview = ({
  classes, periods, days, slots, onSlotsChange, conflicts, eligibleTeachers, rooms, subjects, subjectRoomTypes, subjectTrackGroup,
}: GeneratedTimetablePreviewProps) => {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const [editingCell, setEditingCell] = useState<{ day: number; lesson: number } | null>(null);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const classSlots = useMemo(
    () => slots.filter(s => s.class_id === selectedClassId),
    [slots, selectedClassId]
  );

  const getCellSlots = (day: number, lesson: number) =>
    classSlots.filter(s => s.day_of_week === day && s.lesson_number === lesson);
  const getCellSlot = (day: number, lesson: number) => getCellSlots(day, lesson)[0];

  const classConflicts = conflicts.filter(c => c.class_id === selectedClassId || c.class_id === null);

  const teacherOptions = eligibleTeachers.filter(t => t.class_id === selectedClassId);

  const handleSave = (subject: string, teacherId: string | null, room: string | null) => {
    if (!editingCell || !selectedClassId) return;
    const teacher = teacherOptions.find(t => t.teacher_id === teacherId);
    const next = slots.filter(
      s => !(s.class_id === selectedClassId && s.day_of_week === editingCell.day && s.lesson_number === editingCell.lesson)
    );
    next.push({
      class_id: selectedClassId,
      day_of_week: editingCell.day,
      lesson_number: editingCell.lesson,
      subject,
      teacher_id: teacherId,
      teacher_name: teacher?.teacher_name || null,
      room,
      group_name: null,
    });
    onSlotsChange(next);
    setEditingCell(null);
  };

  const handleRemove = () => {
    if (!editingCell || !selectedClassId) return;
    onSlotsChange(slots.filter(
      s => !(s.class_id === selectedClassId && s.day_of_week === editingCell.day && s.lesson_number === editingCell.lesson)
    ));
    setEditingCell(null);
  };

  const editingSlot = editingCell ? getCellSlot(editingCell.day, editingCell.lesson) : undefined;

  const scheduledCount = classSlots.length;
  const possibleCount = periods.length * days.length;
  const legendSubjects = useMemo(
    () => Array.from(new Set(classSlots.map(s => s.subject))).sort(),
    [classSlots]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Select value={selectedClassId} onValueChange={(v) => { setSelectedClassId(v); setEditingCell(null); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
          <SelectContent>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.grade}'{c.class_number}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {scheduledCount} מתוך {possibleCount} שעות משובצות השבוע
          </span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> הדפסה
          </Button>
        </div>
      </div>

      {selectedClass && (
        <p className="hidden print:block text-lg font-heading font-bold mb-2">
          מערכת שעות — כיתה {selectedClass.grade}'{selectedClass.class_number}
        </p>
      )}

      {legendSubjects.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 print:mb-2">
          {legendSubjects.map(subject => {
            const hue = subjectHue(subject);
            return (
              <div key={subject} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: `hsl(${hue} 70% 55%)` }}
                />
                {subject}
              </div>
            );
          })}
        </div>
      )}

      <Card className="print:border-none print:shadow-none">
        <CardContent className="pt-6 overflow-x-auto print:p-0">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="text-xs text-muted-foreground p-2 w-16"></th>
                {days.map(d => (
                  <th key={d} className="text-xs font-heading font-bold p-2 text-center">{HEBREW_DAYS[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.lesson_number}>
                  <td className="text-[10px] text-muted-foreground p-1 text-center align-middle">{p.label}</td>
                  {days.map(d => {
                    const cellSlots = getCellSlots(d, p.lesson_number);
                    const slot = cellSlots[0];
                    const isEditing = editingCell?.day === d && editingCell?.lesson === p.lesson_number;
                    const hue = slot ? subjectHue(slot.subject) : null;
                    // Several options of the same shared track/הקבצה slot -
                    // lead with the cluster name, then each option below it.
                    // A single leftover option (the block's own hours ran
                    // longer than the others already dropped out) just shows
                    // its own name like any normal subject, per the group's
                    // request - the cluster header only appears when there's
                    // actually more than one option to distinguish here.
                    const clusterName = cellSlots.length > 1 ? subjectTrackGroup[slot.subject] : null;
                    return (
                      <td key={d} className="p-1 align-top">
                        <button
                          onClick={() => setEditingCell({ day: d, lesson: p.lesson_number })}
                          style={hue !== null ? ({ "--sh": hue } as CSSProperties) : undefined}
                          className={`w-full min-h-[60px] rounded-lg p-1.5 text-right border border-s-4 transition-all print:min-h-[44px] ${
                            isEditing ? "ring-2 ring-primary" : "border-border/40 hover:border-primary/40"
                          } ${slot
                            ? "bg-[hsl(var(--sh)_70%_95%)] border-s-[hsl(var(--sh)_70%_55%)] dark:bg-[hsl(var(--sh)_45%_20%)] dark:border-s-[hsl(var(--sh)_55%_55%)]"
                            : "bg-muted/20 border-s-transparent"}`}
                        >
                          {clusterName ? (
                            <>
                              <p className="text-[11px] font-heading font-bold leading-tight text-foreground">{clusterName}</p>
                              {cellSlots.map((s, i) => (
                                <p key={i} className="text-[10px] text-muted-foreground leading-tight">
                                  {s.subject}{s.teacher_name ? ` — ${s.teacher_name}` : ""}{s.room ? ` (חדר ${s.room})` : ""}
                                </p>
                              ))}
                            </>
                          ) : slot ? (
                            <>
                              <p className="text-[11px] font-heading font-bold leading-tight text-foreground">{slot.subject}</p>
                              {slot.teacher_name && <p className="text-[10px] text-muted-foreground leading-tight">{slot.teacher_name}</p>}
                              {slot.room && <p className="text-[9px] text-muted-foreground/70 leading-tight">חדר {slot.room}</p>}
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editingCell && (
        <Card className="print:hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-heading">
              עריכת שיבוץ — {HEBREW_DAYS[editingCell.day]}, שיעור {editingCell.lesson}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setEditingCell(null)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <CellEditForm
              initialSubject={editingSlot?.subject || subjects[0] || ""}
              initialTeacherId={editingSlot?.teacher_id || null}
              initialRoom={editingSlot?.room || null}
              subjects={subjects}
              teacherOptions={teacherOptions}
              rooms={rooms}
              subjectRoomTypes={subjectRoomTypes}
              onSave={handleSave}
              onRemove={editingSlot ? handleRemove : undefined}
            />
          </CardContent>
        </Card>
      )}

      {classConflicts.length > 0 && (
        <Card className="print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading">התראות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {classConflicts.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {c.severity === "error" ? (
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                )}
                <span className={c.severity === "error" ? "text-destructive" : "text-muted-foreground"}>{c.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface CellEditFormProps {
  initialSubject: string;
  initialTeacherId: string | null;
  initialRoom: string | null;
  subjects: string[];
  teacherOptions: EligibleTeacher[];
  rooms: RoomInfo[];
  subjectRoomTypes: Record<string, string | null>;
  onSave: (subject: string, teacherId: string | null, room: string | null) => void;
  onRemove?: () => void;
}

const CellEditForm = ({ initialSubject, initialTeacherId, initialRoom, subjects, teacherOptions, rooms, subjectRoomTypes, onSave, onRemove }: CellEditFormProps) => {
  const [subject, setSubject] = useState(initialSubject);
  const [teacherId, setTeacherId] = useState<string>(initialTeacherId || "none");
  const [room, setRoom] = useState<string>(initialRoom || "none");

  const subjectTeachers = teacherOptions.filter(t => t.subject === subject);
  const requiredRoomType = subjectRoomTypes[subject] || null;
  const roomOptions = requiredRoomType ? rooms.filter(r => r.room_type === requiredRoomType) : rooms;

  const handleSubjectChange = (v: string) => {
    setSubject(v);
    // A room picked under a different subject's requirement may no longer be
    // valid - clear it rather than silently keeping a mismatched room.
    const newRequiredType = subjectRoomTypes[v] || null;
    if (newRequiredType && rooms.find(r => r.name === room)?.room_type !== newRequiredType) {
      setRoom("none");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-end">
        <Select value={subject} onValueChange={handleSubjectChange}>
          <SelectTrigger className="w-36"><SelectValue placeholder="מקצוע" /></SelectTrigger>
          <SelectContent>
            {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger className="w-40"><SelectValue placeholder="מורה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">ללא מורה</SelectItem>
            {subjectTeachers.map(t => <SelectItem key={t.teacher_id} value={t.teacher_id}>{t.teacher_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={room} onValueChange={setRoom}>
          <SelectTrigger className="w-32"><SelectValue placeholder="חדר" /></SelectTrigger>
          <SelectContent>
            {!requiredRoomType && <SelectItem value="none">ללא חדר</SelectItem>}
            {roomOptions.map(r => <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => {
            if (requiredRoomType && room === "none") return;
            onSave(subject, teacherId === "none" ? null : teacherId, room === "none" ? null : room);
          }}
        >
          שמור
        </Button>
        {onRemove && (
          <Button size="sm" variant="outline" className="text-destructive" onClick={onRemove}>
            הסר שיעור
          </Button>
        )}
      </div>
      {requiredRoomType && (
        <p className="text-xs text-amber-600">מקצוע "{subject}" דורש חדר מסוג "{requiredRoomType}"</p>
      )}
    </div>
  );
};

export default GeneratedTimetablePreview;
