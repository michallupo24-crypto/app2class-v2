import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withGuidelineDefaults, type Guidelines } from "@/lib/schoolSetup";

/* The school's guidelines (school_settings.guidelines), with defaults for
   schools that never saved any. Cached per school for the session; saving
   in the school settings page calls invalidateSchoolGuidelines. */

const cache = new Map<string, Promise<Guidelines | null>>();

function fetchGuidelines(schoolId: string) {
  if (!cache.has(schoolId)) {
    cache.set(schoolId, (async () => {
      const { data, error } = await (supabase as any).from("school_settings").select("guidelines").eq("school_id", schoolId).maybeSingle();
      // No row (older schools) or no table yet: behave as before, everything on.
      if (error || !data) return null;
      return withGuidelineDefaults(data.guidelines);
    })());
  }
  return cache.get(schoolId)!;
}

export function invalidateSchoolGuidelines(schoolId: string) {
  cache.delete(schoolId);
}

export function getSchoolGuidelines(schoolId: string | null | undefined): Promise<Guidelines | null> {
  return schoolId ? fetchGuidelines(schoolId) : Promise.resolve(null);
}

export function useSchoolGuidelines(schoolId: string | null | undefined): Guidelines | null {
  const [g, setG] = useState<Guidelines | null>(null);
  useEffect(() => {
    let alive = true;
    if (!schoolId) { setG(null); return; }
    fetchGuidelines(schoolId).then((v) => { if (alive) setG(v); });
    return () => { alive = false; };
  }, [schoolId]);
  return g;
}
