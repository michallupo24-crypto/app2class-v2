import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* The school's list of quick roll call events (the row "⋯" menu). Management
   edits it under הגדרות בית הספר → אירועי נוכחות. */

export type AttendanceEventKind = "late" | "negative" | "positive";

export interface AttendanceEventType {
  id: string | null; // null = built-in default (school has no list in the DB yet)
  label: string;
  kind: AttendanceEventKind;
  category: string | null; // note_category for notes, null for "late"
}

export const DEFAULT_ATTENDANCE_EVENTS: AttendanceEventType[] = [
  { id: null, label: "איחור", kind: "late", category: null },
  { id: null, label: "הפרעה", kind: "negative", category: "disruption" },
  { id: null, label: "ציון לשבח", kind: "positive", category: "positive_participation" },
  { id: null, label: "שימוש בטלפון", kind: "negative", category: "phone" },
];

export const EVENT_KIND_LABELS: Record<AttendanceEventKind, string> = {
  late: "איחור (סטטוס נוכחות)",
  negative: "הערת משמעת",
  positive: "הערה חיובית",
};

/** note_category for a new event the school adds itself. */
export const customCategory = (kind: AttendanceEventKind) =>
  kind === "late" ? null : kind === "positive" ? "custom_positive" : "custom_negative";

/** Identity of a note within a roll call (toggle on/off). Built-in categories
    key by category so the menu and the full notes dialog stay in sync. */
export const eventKey = (e: Pick<AttendanceEventType, "id" | "category">) =>
  !e.category ? "late" : e.category.startsWith("custom_") && e.id ? e.id : e.category;

const db = supabase as any; // newer than the generated types

export function useAttendanceEventTypes(schoolId: string | null | undefined) {
  const [events, setEvents] = useState<AttendanceEventType[]>(DEFAULT_ATTENDANCE_EVENTS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    const { data, error } = await db.from("attendance_event_types")
      .select("id, label, kind, category").eq("school_id", schoolId).order("sort_order");
    // No table yet (migration not applied) or an empty list: keep the defaults
    // so the roll call menu always has the basics.
    setEvents(!error && data?.length ? data : DEFAULT_ATTENDANCE_EVENTS);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { reload(); }, [reload]);

  return { events, loading, reload };
}
