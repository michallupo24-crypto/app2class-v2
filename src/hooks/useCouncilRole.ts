import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CouncilRole {
  isCouncilHead: boolean;
  isNewspaperEditor: boolean;
  loading: boolean;
}

// Council head / newspaper editor are stored in council_members, not as an
// app_role, so pages that gate UI on profile.roles never see them - this
// hook is the one place that resolves "am I currently an active head/editor".
export const useCouncilRole = (userId: string | undefined): CouncilRole => {
  const [isCouncilHead, setIsCouncilHead] = useState(false);
  const [isNewspaperEditor, setIsNewspaperEditor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (supabase as any)
      .from("council_members")
      .select("role_type")
      .eq("student_id", userId)
      .eq("is_active", true)
      .then(({ data }: { data: { role_type: string }[] | null }) => {
        if (cancelled) return;
        const roleTypes = new Set((data || []).map((r) => r.role_type));
        setIsCouncilHead(roleTypes.has("head"));
        setIsNewspaperEditor(roleTypes.has("newspaper_editor"));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isCouncilHead, isNewspaperEditor, loading };
};
