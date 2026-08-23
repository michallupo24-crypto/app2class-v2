import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserBadge {
  badge_key: string;
  badge_label: string;
  badge_icon: string;
  badge_category: string;
  earned_at: string;
}

export interface UserStreak {
  current_streak: number;
  longest_streak: number;
  last_active_date: string;
  total_active_days: number;
}

export interface UserReliability {
  score: number;
  total_positive: number;
  total_negative: number;
  is_faction_guardian: boolean;
}

export interface GamificationData {
  badges: UserBadge[];
  streak: UserStreak | null;
  reliability: UserReliability | null;
  loading: boolean;
  recordActivity: () => Promise<void>;
}

// Badge definitions
const BADGE_DEFS = {
  pioneer: { label: "החלוץ 🏴", icon: "🏴", category: "onboarding" },
  first_positive: { label: "כוכב התנהגות ⭐", icon: "⭐", category: "behavior" },
  five_above_80: { label: "רצף מצוינות 🏆", icon: "🏆", category: "academic" },
  streak_7: { label: "שבוע רצוף 🔥", icon: "🔥", category: "streak" },
  streak_30: { label: "חודש רצוף 💎", icon: "💎", category: "streak" },
  community_helper: { label: "עוזר קהילתי 🌸", icon: "🌸", category: "community" },
  faction_guardian: { label: "נאמן פלג 🛡️", icon: "🛡️", category: "status" },
  perfect_attendance: { label: "נוכחות מושלמת 🎯", icon: "🎯", category: "attendance" },
};

export function useGamification(userId: string | undefined): GamificationData {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [reliability, setReliability] = useState<UserReliability | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!userId) return;
    
    const [badgesRes, streakRes, reliabilityRes] = await Promise.all([
      supabase.from("user_badges").select("*").eq("user_id", userId).order("earned_at", { ascending: false }),
      supabase.from("user_streaks").select("*").eq("user_id", userId).single(),
      supabase.from("user_reliability").select("*").eq("user_id", userId).single(),
    ]);

    setBadges((badgesRes.data || []) as any);
    setStreak(streakRes.data as any);
    setReliability(reliabilityRes.data as any);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const recordActivity = useCallback(async () => {
    if (!userId) return;
    
    // Call the streak update function
    await supabase.rpc("update_user_streak", { p_user_id: userId });
    
    // Check for pioneer badge (first login)
    const { data: pioneerAwarded } = await supabase.rpc("check_and_award_badge", {
      p_user_id: userId,
      p_badge_key: "pioneer",
      p_badge_label: BADGE_DEFS.pioneer.label,
      p_badge_icon: BADGE_DEFS.pioneer.icon,
      p_category: BADGE_DEFS.pioneer.category,
    });

    if (pioneerAwarded) {
      toast.success("מדליה חדשה! 🏴", {
        description: `כל הכבוד! הרווחת את המדליה: ${BADGE_DEFS.pioneer.label}`,
      });
    }

    // Check streak badges
    const { data: streakData } = await supabase.from("user_streaks").select("current_streak").eq("user_id", userId).single();
    if (streakData) {
      if (streakData.current_streak >= 7) {
        const { data: s7 } = await supabase.rpc("check_and_award_badge", {
          p_user_id: userId, p_badge_key: "streak_7",
          p_badge_label: BADGE_DEFS.streak_7.label, p_badge_icon: BADGE_DEFS.streak_7.icon, p_category: BADGE_DEFS.streak_7.category,
        });
        if (s7) toast.success("איזו התמדה! 🔥", { description: "הרווחת מדליית שבוע רצוף!" });
      }
      if (streakData.current_streak >= 30) {
        const { data: s30 } = await supabase.rpc("check_and_award_badge", {
          p_user_id: userId, p_badge_key: "streak_30",
          p_badge_label: BADGE_DEFS.streak_30.label, p_badge_icon: BADGE_DEFS.streak_30.icon, p_category: BADGE_DEFS.streak_30.category,
        });
        if (s30) toast.success("אגדה חיה! 💎", { description: "חודש שלם של למידה רצופה!" });
      }
    }

    // Check for Academic Badges (e.g. Perfect Score)
    const { data: grades } = await supabase.from("submissions").select("grade").eq("student_id", userId).eq("status", "graded");
    if (grades && grades.some(g => g.grade === 100)) {
       const { data: perf } = await supabase.rpc("check_and_award_badge", {
          p_user_id: userId, p_badge_key: "perfect_score",
          p_badge_label: "מצוינות מושלמת 💯", p_badge_icon: "💯", p_category: "academic",
        });
        if (perf) toast.success("גאונות! 💯", { description: "קיבלת 100 במבחן והרווחת מדליה!" });
    }

    // Check for perfect attendance badge (mirrors the unexcused-absence
    // logic in StudentAttendancePage: absent + no approved justification),
    // gated on a minimum lesson count so it can't be earned on day one.
    const { data: profileRow } = await supabase.from("profiles").select("class_id").eq("id", userId).single();
    if (profileRow?.class_id) {
      const { count: totalLessons } = await supabase
        .from("lessons").select("id", { count: "exact", head: true }).eq("class_id", profileRow.class_id);
      if (totalLessons && totalLessons >= 10) {
        const { data: absences } = await supabase.from("attendance").select("id").eq("student_id", userId).eq("status", "absent");
        let unexcused = absences?.length ?? 0;
        if (absences && absences.length > 0) {
          const ids = absences.map(a => a.id);
          const { data: justs } = await (supabase as any)
            .from("absence_justifications").select("attendance_id, status").in("attendance_id", ids).order("created_at", { ascending: false });
          const latestByAttendance: Record<string, string> = {};
          (justs || []).forEach((j: any) => { if (!latestByAttendance[j.attendance_id]) latestByAttendance[j.attendance_id] = j.status; });
          unexcused = ids.filter(id => latestByAttendance[id] !== "approved").length;
        }
        if (unexcused === 0) {
          const { data: attBadge } = await supabase.rpc("check_and_award_badge", {
            p_user_id: userId, p_badge_key: "perfect_attendance",
            p_badge_label: BADGE_DEFS.perfect_attendance.label, p_badge_icon: BADGE_DEFS.perfect_attendance.icon, p_category: BADGE_DEFS.perfect_attendance.category,
          });
          if (attBadge) toast.success("נוכחות למופת! 🎯", { description: "אין לך אף חיסור לא מוצדק — מדליה!" });
        }
      }
    }

    // Ensure reliability record exists
    const { data: relData } = await supabase.from("user_reliability").select("id, score").eq("user_id", userId).single();
    if (!relData) {
      await supabase.from("user_reliability").insert({ user_id: userId, score: 50 });
    } else if (relData.score >= 90) {
       const { data: guardian } = await supabase.rpc("check_and_award_badge", {
          p_user_id: userId, p_badge_key: "faction_guardian",
          p_badge_label: BADGE_DEFS.faction_guardian.label, p_badge_icon: BADGE_DEFS.faction_guardian.icon, p_category: BADGE_DEFS.faction_guardian.category,
        });
        if (guardian) toast.success("נאמן פלג! 🛡️", { description: "מדד האמינות שלך הגיע לשיא!" });
    }

    await loadData();
  }, [userId, loadData]);

  return { badges, streak, reliability, loading, recordActivity };
}

export function getReliabilityLevel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 90) return { label: "מצוין", color: "text-success", emoji: "🌟" };
  if (score >= 70) return { label: "טוב", color: "text-primary", emoji: "👍" };
  if (score >= 50) return { label: "סביר", color: "text-warning", emoji: "😐" };
  if (score >= 30) return { label: "נמוך", color: "text-destructive", emoji: "⚠️" };
  return { label: "קריטי", color: "text-destructive", emoji: "🔴" };
}
