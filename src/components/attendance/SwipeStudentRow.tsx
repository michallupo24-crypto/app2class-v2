import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Cake, Check, MoreHorizontal, UserX } from "lucide-react";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { AvatarConfig } from "@/components/avatar/AvatarStudio";
import { eventKey, type AttendanceEventType } from "@/hooks/useAttendanceEventTypes";
import {
  swipeAxis, swipeDirection, swipeOffset, swipeOutcome, type AttendanceStatus, type SwipeAction, type SwipeAxis,
} from "@/lib/attendanceSwipe";
import { cn } from "@/lib/utils";

/* One student in the roll call list.
   Phone: swipe right = חיסור, swipe left = נוכח (see attendanceSwipe.ts);
   long-press or "⋯" opens the event menu.
   Desktop: one-tap "חיסור" button + "⋯" menu. */

const LONG_PRESS_MS = 500;

export const ROW_STATUS: Record<AttendanceStatus, { label: string; cls: string }> = {
  present: { label: "נוכח/ת", cls: "bg-success-soft text-success" },
  late: { label: "איחור", cls: "bg-warning-soft text-warning" },
  absent: { label: "חסר/ה", cls: "bg-destructive-soft text-destructive" },
  excused: { label: "מוצדק", cls: "bg-info-soft text-info" },
};

export interface RowStudent {
  id: string;
  name: string;
  avatar: AvatarConfig | null;
  status: AttendanceStatus | null;
  notes: { key: string; label: string }[];
  isBirthday: boolean;
}

interface Props {
  student: RowStudent;
  events: AttendanceEventType[];
  selected: boolean;
  onSelect: () => void;
  onSwipe: (action: SwipeAction) => void;
  onToggleAbsent: () => void;
  onEvent: (event: AttendanceEventType) => void;
  onMoreNotes: () => void;
}

export function SwipeStudentRow({ student, events, selected, onSelect, onSwipe, onToggleAbsent, onEvent, onMoreNotes }: Props) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; id: number; axis: SwipeAxis; touch: boolean } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  const st = student.status ? ROW_STATUS[student.status] : null;
  const width = rowRef.current?.offsetWidth || 340;
  const offset = dragging ? swipeOffset(dx, width) : 0;
  const pointing = swipeDirection(dx);
  const armed = !!swipeOutcome(dx, width);
  const activeKeys = new Set(student.notes.map(n => n.key));

  const clearPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const touch = e.pointerType !== "mouse";
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null, touch };
    suppressClick.current = false;
    if (touch) {
      pressTimer.current = setTimeout(() => {
        pressTimer.current = null;
        gesture.current = null;
        suppressClick.current = true;
        navigator.vibrate?.(12);
        setMenuOpen(true);
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (!g.axis) {
      g.axis = swipeAxis(mx, my);
      if (!g.axis) return;
      clearPress();
      // Only touch/pen swipes; a mouse drag on desktop does nothing.
      if (g.axis === "y" || !g.touch) { gesture.current = null; return; }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      setDragging(true);
    }
    setDx(mx);
  };

  const endGesture = (commit: boolean) => {
    clearPress();
    const g = gesture.current;
    gesture.current = null;
    if (g?.axis === "x") {
      suppressClick.current = true;
      const action = commit ? swipeOutcome(dx, width) : null;
      if (action) onSwipe(action);
    }
    setDragging(false);
    setDx(0);
  };

  return (
    <div ref={rowRef} className="relative overflow-hidden rounded-[18px]" data-student-row={student.id}>
      {/* Colored reveal behind the row while swiping */}
      {dragging && pointing && (
        <div aria-hidden className={cn(
          "absolute inset-0 flex items-center px-5 font-body font-black text-[15px] text-white transition-colors",
          pointing === "absent" ? "justify-start" : "justify-end",
          pointing === "absent" ? (armed ? "bg-destructive" : "bg-destructive/60") : (armed ? "bg-success" : "bg-success/60"),
        )} dir="ltr">
          {pointing === "absent"
            ? <span className="flex items-center gap-2"><UserX className="h-5 w-5" />{student.status === "absent" ? "ביטול" : "חיסור"}</span>
            : <span className="flex items-center gap-2">נוכח/ת<Check className="h-5 w-5" /></span>}
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label={`${student.name}: ${st ? st.label : "לא סומן"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endGesture(true)}
        onPointerCancel={() => endGesture(false)}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onSelect(); }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
        onContextMenu={e => { e.preventDefault(); setMenuOpen(true); }}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 bg-card select-none touch-pan-y cursor-pointer",
          "shadow-[0_8px_16px_-12px_rgba(40,30,15,.4)] rounded-[18px]",
          selected && "outline outline-2 -outline-offset-2 outline-foreground/25",
          !dragging && "transition-transform duration-200",
        )}
        style={{ transform: `translateX(${offset}px)`, WebkitTouchCallout: "none" } as React.CSSProperties}
      >
        <span className={cn("w-1.5 self-stretch rounded-full shrink-0",
          student.status === "absent" ? "bg-destructive" : student.status === "late" ? "bg-warning" : student.status === "present" ? "bg-success" : "bg-muted")} />
        <span className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white dark:border-card shadow-[0_2px_6px_rgba(40,30,15,.25)] bg-soft flex items-center justify-center shrink-0"
          style={{ opacity: student.status === "absent" ? 0.45 : 1 }}>
          {student.avatar ? <AvatarPreview config={student.avatar} size={40} /> : <span className="font-heading font-black text-base text-muted-foreground">{student.name.trim().charAt(0)}</span>}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="flex items-center gap-1.5 font-heading font-extrabold text-[14.5px] leading-tight truncate">
            {student.name}
            {student.isBirthday && <Cake className="h-3.5 w-3.5 text-accent shrink-0" aria-label="יום הולדת" />}
          </span>
          {student.notes.length > 0 && (
            <span className="flex gap-1 flex-wrap">
              {student.notes.map(n => (
                <span key={n.key} className="px-1.5 py-0.5 rounded-md bg-soft font-body font-bold text-[11px] leading-none text-text-secondary">{n.label}</span>
              ))}
            </span>
          )}
        </div>
        <span className={cn("px-2 py-1 rounded-lg font-body font-extrabold text-[11.5px] leading-none shrink-0", st ? st.cls : "bg-muted text-muted-foreground")}>
          {st ? st.label : "לא סומן"}
        </span>

        {/* Buttons: keep their pointer events away from the swipe/long-press handling */}
        <span className="flex items-center gap-1.5 shrink-0" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={onToggleAbsent} aria-pressed={student.status === "absent"}
            className={cn("max-md:hidden px-3 py-2 rounded-xl font-body font-extrabold text-[13px] leading-none border-[1.5px]",
              student.status === "absent" ? "bg-destructive text-destructive-foreground border-destructive" : "bg-card border-input text-destructive hover:bg-destructive-soft")}>
            {student.status === "absent" ? "בטל חיסור" : "חיסור"}
          </button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false} dir="rtl">
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`אירועים ל${student.name}`}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-soft text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[190px]">
              <DropdownMenuLabel className="font-heading font-black">{student.name}</DropdownMenuLabel>
              {events.map(ev => (
                <DropdownMenuCheckboxItem key={eventKey(ev)}
                  checked={ev.kind === "late" ? student.status === "late" : activeKeys.has(eventKey(ev))}
                  onSelect={() => onEvent(ev)}
                  className={cn("font-body font-bold", ev.kind === "positive" ? "text-success" : ev.kind === "negative" ? "text-destructive" : "text-warning")}>
                  {ev.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onMoreNotes} className="font-body font-bold">כל ההערות והפניה ליועצת…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
    </div>
  );
}
