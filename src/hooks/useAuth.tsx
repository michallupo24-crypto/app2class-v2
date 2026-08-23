import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { AvatarConfig } from "@/components/avatar/AvatarStudio";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  isApproved: boolean;
  schoolId: string | null;
  schoolName: string | null;
  roles: string[];
  avatar: AvatarConfig | null;
  pendingApprovalsCount: number;
  unreadChatCount: number;
}

export const useAuth = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const [profileRes, rolesRes, avatarRes] = await Promise.all([
      supabase.from("profiles").select("*, schools(name)").eq("id", user.id).single(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("avatars").select("*").eq("user_id", user.id).single(),
    ]);

    if (!profileRes.data && profileRes.error) {
      console.error("Profile fetch error:", profileRes.error);
    }

    const roles = (rolesRes.data || []).map((r: any) => r.role);

    // profiles' own-row SELECT policy is `auth.uid() = id`, always allowed - a
    // missing profileRes.data here means the row genuinely doesn't exist yet
    // (e.g. a signup race) or fetch errored, never "access denied". Fail
    // closed (unapproved, no roles) rather than fabricating an approved
    // parent identity, which previously gave full parent-dashboard access to
    // anyone caught in that state.
    const fullName = profileRes.data?.full_name || user.user_metadata?.full_name || "משתמש אנונימי";
    const userEmail = profileRes.data?.email || user.email || "";
    const isApproved = profileRes.data ? profileRes.data.is_approved : false;
    const schoolId = profileRes.data?.school_id || null;
    const schoolName = profileRes.data ? (profileRes.data as any).schools?.name : null;

    const validRoles = profileRes.data ? roles : [];

    // Count pending approvals — single query with IN filter
    let pendingCount = 0;
    if (roles.length > 0) {
      const { count } = await supabase
        .from("approvals")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .in("required_role", roles);
      pendingCount = count || 0;
    }

    // Count unread chat messages, compared per-conversation against that
    // conversation's own last_read_at (not a single global minimum across
    // all conversations - that let one stale/abandoned conversation keep
    // the badge stuck even after everything else was read).
    const { data: unreadCountData } = await supabase.rpc("get_unread_chat_count");
    const unreadChatCount = unreadCountData || 0;

    let avatar: AvatarConfig | null = null;
    if (avatarRes.data) {
      const faceToBody: Record<string, string> = {
        round: "basic", oval: "basic", square: "wider", long: "taller",
        basic: "basic", wider: "wider", taller: "taller",
      };
      avatar = {
        body_type: faceToBody[avatarRes.data.face_shape] || "basic",
        eye_color: avatarRes.data.eye_color || "brown",
        skin: avatarRes.data.skin_color || "#FDDBB4",
        hair_style: avatarRes.data.hair_style || "boy",
        hair_color: avatarRes.data.hair_color || "#2C1A0E",
      };
    }

    setProfile({
      id: user.id,
      fullName,
      email: userEmail,
      isApproved,
      schoolId,
      schoolName,
      roles: validRoles,
      avatar,
      pendingApprovalsCount: pendingCount,
      unreadChatCount,
    });

    // Record gamification activity
    try {
      await supabase.rpc("update_user_streak", { p_user_id: user.id });
      await supabase.rpc("check_and_award_badge", {
        p_user_id: user.id,
        p_badge_key: "pioneer",
        p_badge_label: "החלוץ 🏴",
        p_badge_icon: "🏴",
        p_category: "onboarding",
      });
    } catch { /* gamification is best-effort */ }

    // No cron infra for scheduled_chat_messages delivery - flush whichever of
    // the user's own scheduled messages are due, opportunistically, on every
    // auth refresh (i.e. whenever they're active anywhere in the dashboard),
    // not just while ChatPage happens to be open.
    try {
      await supabase.rpc("process_due_scheduled_messages");
    } catch { /* best-effort */ }

    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return { profile, loading, logout, refresh: loadProfile };
};
