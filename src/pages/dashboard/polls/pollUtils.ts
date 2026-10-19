import type { Database } from "@/integrations/supabase/types";
import type { UserProfile } from "@/hooks/useAuth";
import { useCouncilRole } from "@/hooks/useCouncilRole";

export type Poll = Database["public"]["Tables"]["polls"]["Row"];
export type PollOption = Database["public"]["Tables"]["poll_options"]["Row"];

export const AUDIENCE_LABELS: Record<string, string> = {
  all: "כל בית הספר",
  students: "תלמידים",
  staff: "צוות",
  parents: "הורים",
};

export const SHOW_RESULTS_LABELS: Record<string, string> = {
  always: "תמיד",
  after_vote: "אחרי שהצבעתי",
  after_close: "רק בסגירת ההצבעה",
};

export type PollStatus = "upcoming" | "open" | "closed";

export function pollStatus(p: Pick<Poll, "opens_at" | "closes_at">, now = Date.now()): PollStatus {
  if (new Date(p.opens_at).getTime() > now) return "upcoming";
  if (p.closes_at && new Date(p.closes_at).getTime() <= now) return "closed";
  return "open";
}

export const STATUS_LABELS: Record<PollStatus, string> = { upcoming: "טרם נפתחה", open: "פתוחה", closed: "נסגרה" };

export function audienceText(p: Pick<Poll, "audience" | "audience_grades">): string {
  const base = AUDIENCE_LABELS[p.audience] ?? p.audience;
  if (p.audience === "students" && p.audience_grades?.length) return `${base} (שכבות ${p.audience_grades.join(", ")})`;
  return base;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Mirrors public.can_manage_polls: management, the council advisor and the active council head.
export function useCanManagePolls(profile: UserProfile): boolean {
  const { isCouncilHead } = useCouncilRole(profile.id);
  return profile.roles.some((r) => ["management", "system_admin", "council_advisor"].includes(r)) || isCouncilHead;
}
