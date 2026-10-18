import { supabase } from "@/integrations/supabase/client";
import { getSchoolGuidelines } from "@/hooks/useSchoolGuidelines";

// Ministry rule (חוזר מנכ"ל 3.1-51): at most one assessment a day and three a
// week for the same students - so conflicts are counted within one grade only.
// A school may set stricter (or its own) limits in its guidelines.
export async function examConflictWarning(schoolId: string, grade: string, date: string): Promise<string | null> {
  if (!schoolId || !grade || !date) return null;
  const rules = (await getSchoolGuidelines(schoolId))?.exams;
  const maxPerDay = rules?.maxPerDay ?? 1;
  const maxPerWeek = rules?.maxPerWeek ?? 3;
  const minNotice = rules?.minNoticeDays ?? 0;

  const day = new Date(`${date}T00:00:00`);
  const weekStart = new Date(day);
  weekStart.setDate(day.getDate() - day.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const iso = (d: Date) => d.toLocaleDateString("en-CA");

  const { data } = await supabase
    .from("grade_events")
    .select("id, title, event_date")
    .eq("school_id", schoolId)
    .eq("grade", grade as any)
    .eq("event_type", "exam")
    .in("status", ["proposed", "approved"])
    .gte("event_date", iso(weekStart))
    .lte("event_date", iso(weekEnd));

  const sameDay = (data || []).filter((e) => e.event_date === date);
  if (sameDay.length > 0 && sameDay.length >= maxPerDay) return `⚠️ באותו יום כבר יש לשכבה ${sameDay.map((e) => `"${e.title}"`).join(", ")}. מומלץ לבחור תאריך אחר.`;
  if ((data || []).length > 0 && data!.length >= maxPerWeek) return `⚠️ לשכבה כבר יש ${data!.length} מבחנים בשבוע הזה (המקסימום בבית הספר הוא ${maxPerWeek}).`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAhead = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (minNotice > 0 && daysAhead >= 0 && daysAhead < minNotice) return `⚠️ לפי הנחיות בית הספר יש להודיע על מבחן ${minNotice} ימים מראש.`;
  return null;
}
