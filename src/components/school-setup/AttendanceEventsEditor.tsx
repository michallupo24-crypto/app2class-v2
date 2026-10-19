import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/school-setup/SetupSections";
import { EVENT_KIND_LABELS, customCategory, type AttendanceEventKind, type AttendanceEventType } from "@/hooks/useAttendanceEventTypes";

/* The roll call "⋯" menu, per school: add, rename, remove, reorder. */

export function AttendanceEventsEditor({ value, onChange }: { value: AttendanceEventType[]; onChange: (v: AttendanceEventType[]) => void }) {
  const set = (i: number, patch: Partial<AttendanceEventType>) => onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const hasLate = value.some((e) => e.kind === "late");
  // Saved events keep their kind (it decides how past notes were stored); new ones pick it.
  const kindsFor = (e: AttendanceEventType) =>
    (Object.keys(EVENT_KIND_LABELS) as AttendanceEventKind[]).filter((k) => k !== "late" || !hasLate || e.kind === "late");

  return (
    <div className="space-y-2">
      <Hint>האירועים שמופיעים בתפריט ⋯ ליד כל תלמיד/ה בהקראת שמות. הסדר כאן הוא הסדר בתפריט.</Hint>
      {value.map((e, i) => (
        <div key={e.id ?? `new-${i}`} className="grid grid-cols-[auto_1fr_150px_auto] items-center gap-2">
          <span className="flex flex-col">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`העברה למעלה: ${e.label}`} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`העברה למטה: ${e.label}`} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
          </span>
          <Input value={e.label} maxLength={40} onChange={(ev) => set(i, { label: ev.target.value })} placeholder="שם האירוע" aria-label="שם האירוע" className="h-9 text-sm" />
          {e.id ? (
            <span className="px-2 font-body text-[12.5px] font-bold text-muted-foreground">{EVENT_KIND_LABELS[e.kind]}</span>
          ) : (
            <Select value={e.kind} onValueChange={(k: AttendanceEventKind) => set(i, { kind: k, category: k === "late" ? null : e.category && !e.category.startsWith("custom_") && e.kind === k ? e.category : customCategory(k) })}>
              <SelectTrigger className="h-9 text-sm" aria-label="סוג האירוע"><SelectValue /></SelectTrigger>
              <SelectContent>{kindsFor(e).map((k) => <SelectItem key={k} value={k}>{EVENT_KIND_LABELS[k]}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`הסרה: ${e.label}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="gap-1"
        onClick={() => onChange([...value, { id: null, label: "", kind: "negative", category: customCategory("negative") }])}>
        <Plus className="h-4 w-4" />אירוע
      </Button>
      <Hint>הסרת אירוע לא מוחקת הערות שכבר נרשמו בעזרתו.</Hint>
    </div>
  );
}
