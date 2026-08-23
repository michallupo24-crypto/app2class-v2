import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_SCHOOL_DAYS = [0, 1, 2, 3, 4];

// `refreshKey`: pass something that changes when the caller wants a refetch
// (e.g. the active tab) - useful for a long-lived page where a SIBLING tab
// (kept mounted by Radix) can update days_of_week without this hook's own
// component ever remounting to notice on its own.
export function useSchoolDays(schoolId: string | null | undefined, refreshKey?: unknown): number[] {
  const [days, setDays] = useState<number[]>(DEFAULT_SCHOOL_DAYS);

  useEffect(() => {
    if (!schoolId) return;
    supabase
      .from("school_timetable_settings")
      .select("days_of_week")
      .eq("school_id", schoolId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.days_of_week?.length) setDays(data.days_of_week);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, refreshKey]);

  return days;
}
