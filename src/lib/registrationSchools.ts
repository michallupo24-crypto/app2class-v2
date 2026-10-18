import { supabase } from "@/integrations/supabase/client";

type School = { id: string; name: string };

// Schools shown in the registration dropdowns: QA/demo schools are hidden via
// schools.open_for_registration (migration 20261018030000). Until that
// migration is applied the column doesn't exist, so fall back to every school
// rather than showing an empty list and blocking registration.
export async function fetchRegistrationSchools(): Promise<School[]> {
  const filtered = await (supabase.from("schools").select("id, name") as any).eq("open_for_registration", true);
  if (!filtered.error) return filtered.data ?? [];
  const { data } = await supabase.from("schools").select("id, name");
  return data ?? [];
}
