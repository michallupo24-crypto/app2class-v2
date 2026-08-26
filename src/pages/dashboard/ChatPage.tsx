import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import {
  MessageCircle, Send, Search, Users, ArrowRight, Moon,
  AlertTriangle, BookOpen, UserPlus, Lock, Check, X, Plus,
  School, HeartHandshake, UserRound, CalendarClock, XCircle,
  Bell, BellOff, Pencil, Trash2, CheckCheck, Reply, Paperclip,
  Settings, LogOut, UserMinus, FileText, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import type { AvatarConfig } from "@/components/avatar/AvatarStudio";
import { extractDocumentText, isExtractableDocument, isImageFile } from "@/lib/fileExtraction";
import { requestImageOcr } from "@/lib/fileOcr";

/* ─── Types ───────────────────────────────────────────── */
type ConversationType = 
  | "direct" | "class" | "grade" | "subject" | "announcement" | "parent_teacher" | "counseling" | "parent_class" | "parent_grade"
  | "private" | "group" | "class_subject" | "class_homeroom" | "class_parent_group" | "grade_parent_group";

interface Conversation {
  id: string;
  title: string | null;
  type: ConversationType;
  class_id?: string | null;
  school_id?: string | null;
  subject?: string | null;
  grade?: string | null;
  classId?: string | null; // Support both naming styles found in DB vs Code
  schoolId?: string | null;
  is_accepted: boolean;
  created_by: string;
  updated_at: string;
  lastMessage?: { content: string; created_at: string; is_flagged: boolean; is_deleted: boolean };
  unreadCount: number;
  otherName: string;
  otherAvatar: AvatarConfig | null;
  otherRoleLabel: string;
  otherUserId: string | null;
  participantCount: number;
  participantPreview: string;
  muted: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: AvatarConfig | null;
  content: string;
  created_at: string;
  is_flagged: boolean;
  flag_reason: string | null;
  is_deleted: boolean;
  edited_at: string | null;
  reply_to_id: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_extracted_text: string | null;
  mentioned_user_ids: string[];
}

interface SearchUser {
  user_id: string;
  full_name: string;
  avatar: AvatarConfig | null;
  roleLabel: string;
}

interface Participant {
  user_id: string;
  full_name: string;
  last_read_at: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  student: "תלמיד/ה", parent: "הורה", educator: "מחנך/ת",
  professional_teacher: "מורה", subject_coordinator: "רכז/ת מקצוע",
  grade_coordinator: "רכז/ת שכבה", counselor: "יועץ/ת",
  management: "הנהלה", system_admin: "מנהל/ת מערכת",
};

/** Staff who can publish availability to students/parents */
const STAFF_PRESENCE_ROLES = new Set([
  "educator", "professional_teacher", "subject_coordinator",
  "grade_coordinator", "counselor", "management",
]);

const PRESENCE_LABELS: Record<string, string> = {
  available: "פנוי/ה לשיחה",
  in_lesson: "בשיעור",
  resting: "במנוחה",
};

const CHANNEL_SECTIONS: { types: ConversationType[]; title: string }[] = [
  { types: ["class_parent_group", "grade_parent_group"], title: "קהילת הורים" },
  { types: ["counseling"], title: "מרחב ייעוץ" },
  { types: ["parent_teacher"], title: "הורה–מורה" },
  { types: ["class_subject"], title: "מקצועות" },
  { types: ["class_homeroom"], title: "חדר הכיתה" },
  { types: ["group"], title: "קבוצות" },
  { types: ["private"], title: "אישי" },
];

const FACE_TO_BODY: Record<string, string> = {
  round: "basic", oval: "basic", square: "wider", long: "taller",
  basic: "basic", wider: "wider", taller: "taller",
};

function avatarFromRow(av: any): AvatarConfig | null {
  if (!av) return null;
  return {
    body_type: FACE_TO_BODY[av.face_shape] || "basic",
    eye_color: av.eye_color || "brown",
    skin: av.skin_color || "#FDDBB4",
    hair_style: av.hair_style || "boy",
    hair_color: av.hair_color || "#2C1A0E",
  };
}

/** Supabase may return avatars as one row or an array */
function firstAvatarFromProfile(avatars: unknown): any {
  if (!avatars) return null;
  if (Array.isArray(avatars)) return avatars[0] ?? null;
  return avatars;
}

/** avatars.user_id → auth.users; אין FK ל-profiles — לא משתמשים ב-embed של PostgREST */
async function fetchAvatarsByUserIds(userIds: string[]) {
  const map = new Map<string, Record<string, unknown>>();
  const uniq = [...new Set(userIds)].filter(Boolean);
  if (!uniq.length) return map;
  const { data, error } = await supabase
    .from("avatars")
    .select("user_id, face_shape, eye_color, skin_color, hair_style, hair_color")
    .in("user_id", uniq);
  if (error) {
    console.error("avatars (batch):", error);
    return map;
  }
  for (const row of data || []) map.set(row.user_id as string, row as Record<string, unknown>);
  return map;
}

/* ─── Component ───────────────────────────────────────── */
const ChatPage = () => {
  const { profile, refresh } = useOutletContext<{ profile: UserProfile; refresh: () => Promise<void> }>();
  const { toast } = useToast();
  const location = useLocation();
  const navState = location.state as { targetUserId?: string; initialType?: ConversationType; targetConversationId?: string } | null;
  // A notification click lands here as /dashboard/chat?conversation=<id> (no
  // router state, since it's a plain link navigation from NotificationBell).
  const queryConversationId = new URLSearchParams(location.search).get("conversation");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [quietHours, setQuietHours] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [listFilter, setListFilter] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);

  // Global search: listFilter already filters the conversation list by
  // title/name client-side; this additionally searches message *content*
  // across every conversation the user is in (server-side, since messages
  // aren't all loaded locally the way the conversation list is).
  interface MessageSearchResult {
    id: string; conversation_id: string; content: string; sender_id: string;
    created_at: string; conversationTitle: string; senderName: string;
  }
  const [messageSearchResults, setMessageSearchResults] = useState<MessageSearchResult[]>([]);
  const [messageSearchLoading, setMessageSearchLoading] = useState(false);
  const [myPresence, setMyPresence] = useState<string>("available");
  const [peerPresence, setPeerPresence] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const realtimeRef = useRef<any>(null);

  // Group creation
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<SearchUser[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Message scheduling
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<{ id: string; content: string; send_at: string }[]>([]);

  // Selected conversation's participants (read receipts, mentions, group management)
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([]);

  // Edit / delete
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Reply
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Typing indicator
  const [typingNames, setTypingNames] = useState<Record<string, string>>({});
  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSentRef = useRef(0);

  // In-conversation search
  const [convoSearchOpen, setConvoSearchOpen] = useState(false);
  const [convoSearchQuery, setConvoSearchQuery] = useState("");

  // @mentions
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Attachments
  const [pendingAttachment, setPendingAttachment] = useState<{ path: string; name: string; type: string; extractedText: string | null } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [extractingAttachment, setExtractingAttachment] = useState(false);
  const [expandedExtractedText, setExpandedExtractedText] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  // chat-attachments is a private bucket, so images can't be rendered by
  // path directly - each one needs a signed URL, resolved and cached here.
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  // Group management
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupInfoName, setGroupInfoName] = useState("");
  const [groupAddQuery, setGroupAddQuery] = useState("");
  const [groupAddResults, setGroupAddResults] = useState<SearchUser[]>([]);

  const canSetPresence = profile.roles.some((r) => STAFF_PRESENCE_ROLES.has(r));

  /* ── Quiet hours ─────────────────────────────────────── */
  useEffect(() => {
    if (!profile.schoolId) return;
    const check = async () => {
      const { data } = await supabase
        .from("chat_settings").select("*")
        .eq("school_id", profile.schoolId!).single();
      if (!data?.quiet_hours_enabled) return;
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const s = data.quiet_hours_start || "22:00";
      const e = data.quiet_hours_end || "07:00";
      setQuietHours(s > e ? (t >= s || t < e) : (t >= s && t < e));
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [profile.schoolId]);

  /* ── Deliver due scheduled messages, and periodically resync the open
     conversation as a Realtime-miss safety net (see loadMessages) ────── */
  useEffect(() => {
    const tick = async () => {
      const { data: deliveredCount } = await supabase.rpc("process_due_scheduled_messages");
      if ((deliveredCount || 0) > 0) {
        loadConversations();
        setScheduledMessages((prev) => prev.filter((m) => new Date(m.send_at).getTime() > Date.now()));
      }
      if (selectedIdRef.current) loadMessages(selectedIdRef.current);
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load this conversation's pending scheduled messages ── */
  useEffect(() => {
    if (!selectedId) { setScheduledMessages([]); return; }
    supabase.from("scheduled_chat_messages")
      .select("id, content, send_at")
      .eq("conversation_id", selectedId)
      .eq("sender_id", profile.id)
      .is("sent_at", null)
      .order("send_at", { ascending: true })
      .then(({ data }) => setScheduledMessages(data || []));
  }, [selectedId, profile.id]);

  const loadSelectedParticipants = async (conversationId: string) => {
    const { data: parts } = await supabase.from("conversation_participants")
      .select("user_id, last_read_at")
      .eq("conversation_id", conversationId);
    if (!parts?.length) { setSelectedParticipants([]); return; }
    const ids = parts.map((p: any) => p.user_id);
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const nameMap = new Map((profs || []).map((p: any) => [p.id, p.full_name || "משתמש"]));
    setSelectedParticipants(parts.map((p: any) => ({
      user_id: p.user_id,
      full_name: nameMap.get(p.user_id) || "משתמש",
      last_read_at: p.last_read_at,
    })));
  };

  /* ── Load participants for read receipts / mentions / group mgmt ── */
  useEffect(() => {
    if (!selectedId) { setSelectedParticipants([]); return; }
    loadSelectedParticipants(selectedId);
  }, [selectedId]);

  // "Read by everyone else" threshold: the earliest last_read_at among the
  // other participants. A message is read-by-all once its created_at falls
  // at or before that.
  const allOthersReadAt = useMemo(() => {
    const others = selectedParticipants.filter((p) => p.user_id !== profile.id && p.last_read_at);
    if (others.length === 0 || others.length !== selectedParticipants.length - 1) return null;
    return others.reduce((min, p) => (p.last_read_at! < min ? p.last_read_at! : min), others[0].last_read_at!);
  }, [selectedParticipants, profile.id]);

  /* ── Staff: own chat presence ───────────────────────── */
  useEffect(() => {
    if (!canSetPresence) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("chat_presence").eq("id", profile.id).maybeSingle();
      if (data?.chat_presence) setMyPresence(data.chat_presence);
    })();
  }, [canSetPresence, profile.id]);

  const updateMyPresence = async (value: string) => {
    setMyPresence(value);
    const { error } = await supabase.from("profiles").update({ chat_presence: value }).eq("id", profile.id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "עודכן", description: "מצב הנראות שלך בשיחות עודכן" });
  };

  const toggleMute = async (conversationId: string, currentlyMuted: boolean) => {
    setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, muted: !currentlyMuted } : c));
    const { error } = await supabase.from("conversation_participants")
      .update({ muted: !currentlyMuted })
      .eq("conversation_id", conversationId)
      .eq("user_id", profile.id);
    if (error) {
      setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, muted: currentlyMuted } : c));
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    }
  };

  /* ── Load conversations (batched, no N+1) ───────────── */
  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);

    // 1. Get all conversation IDs I'm in
    const { data: myParts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at, muted")
      .eq("user_id", profile.id);

    if (!myParts?.length) { setConversations([]); setLoadingConvos(false); return; }

    const convoIds = myParts.map((p: any) => p.conversation_id);
    const lastReadMap = new Map<string, string>(
      myParts.map((p: any) => [p.conversation_id, p.last_read_at])
    );
    const mutedMap = new Map<string, boolean>(
      myParts.map((p: any) => [p.conversation_id, Boolean(p.muted)])
    );

    // 2. Fetch conversations + messages + participant rows (ללא embed — אין FK מ-user_id ל-profiles ב-PostgREST)
    const [convosRes, lastMsgsRes, participantsRawRes, unreadRes] = await Promise.all([
      supabase.from("conversations").select("*").in("id", convoIds).order("updated_at", { ascending: false }),
      supabase.from("messages").select("conversation_id, content, created_at, is_flagged, is_deleted")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false })
        .limit(convoIds.length * 3),
      supabase.from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convoIds),
      supabase.from("messages")
        .select("conversation_id, created_at")
        .in("conversation_id", convoIds),
    ]);

    const convos = convosRes.data || [];
    const allMsgs = lastMsgsRes.data || [];
    const allMsgTimes = unreadRes.data || [];

    if (participantsRawRes.error) {
      console.error("conversation_participants:", participantsRawRes.error);
      toast({
        title: "שגיאה בטעינת השיחות",
        description: participantsRawRes.error.message,
        variant: "destructive",
      });
      setConversations([]);
      setLoadingConvos(false);
      return;
    }

    const participantsRaw = participantsRawRes.data || [];
    const participantUserIds = [...new Set(participantsRaw.map((p: { user_id: string }) => p.user_id))];

    const profileMap = new Map<string, { full_name: string | null; avatars: unknown }>();
    const rolesByUser = new Map<string, { role: string }[]>();

    if (participantUserIds.length > 0) {
      const [profRes, rolesRes, avatarMap] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", participantUserIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", participantUserIds),
        fetchAvatarsByUserIds(participantUserIds),
      ]);
      if (profRes.error) console.error("profiles (chat participants):", profRes.error);
      if (rolesRes.error) console.error("user_roles (chat participants):", rolesRes.error);
      for (const p of profRes.data || []) {
        profileMap.set(p.id, {
          full_name: p.full_name,
          avatars: avatarMap.get(p.id) ?? null,
        });
      }
      for (const r of rolesRes.data || []) {
        const list = rolesByUser.get(r.user_id) || [];
        list.push({ role: r.role as string });
        rolesByUser.set(r.user_id, list);
      }
    }

    const allParts = participantsRaw.map((row: { conversation_id: string; user_id: string }) => ({
      conversation_id: row.conversation_id,
      user_id: row.user_id,
      profiles: profileMap.get(row.user_id) ?? null,
      user_roles: rolesByUser.get(row.user_id) || [],
    }));

    // Build last message map
    const lastMsgMap = new Map<string, typeof allMsgs[0]>();
    for (const msg of allMsgs) {
      if (!lastMsgMap.has(msg.conversation_id)) lastMsgMap.set(msg.conversation_id, msg);
    }

    // Build unread count map
    const unreadMap = new Map<string, number>();
    for (const msg of allMsgTimes) {
      const lastRead = lastReadMap.get(msg.conversation_id);
      if (lastRead && msg.created_at > lastRead) {
        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
      }
    }

    // Build participants map
    const partsByConvo = new Map<string, any[]>();
    for (const p of allParts) {
      const list = partsByConvo.get(p.conversation_id) || [];
      list.push(p);
      partsByConvo.set(p.conversation_id, list);
    }

    // Assemble conversations
    const enriched: Conversation[] = convos.map((c: any) => {
      const parts = partsByConvo.get(c.id) || [];
      const otherParts = parts.filter((p: any) => p.user_id !== profile.id);
      const other = otherParts[0];
      const roles = (other?.user_roles || []).map((r: any) => r.role);
      const roleLabel = roles.map((r: string) => ROLE_LABELS[r] || r).join(", ");
      const lastName = otherParts.map((p: any) => (p.profiles as any)?.full_name || "").filter(Boolean).join(", ");
      const otherUserId = c.type === "private" && other ? (other.user_id as string) : null;

      const participantNames = parts
        .map((p: any) => (p.profiles as any)?.full_name)
        .filter(Boolean) as string[];
      const participantPreview =
        participantNames.length > 0
          ? participantNames.slice(0, 8).join(" · ") +
            (participantNames.length > 8 ? ` · +${participantNames.length - 8}` : "")
          : "";

      const privateTitle = lastName || c.title || "שיחה";
      const groupTitle = c.title || lastName || "קבוצה";

      return {
        id: c.id,
        title: c.title,
        type: c.type as ConversationType,
        subject: c.subject,
        grade: c.grade,
        is_accepted: c.is_accepted,
        created_by: c.created_by,
        updated_at: c.updated_at,
        lastMessage: lastMsgMap.get(c.id)
          ? {
              content: lastMsgMap.get(c.id)!.content,
              created_at: lastMsgMap.get(c.id)!.created_at,
              is_flagged: lastMsgMap.get(c.id)!.is_flagged,
              is_deleted: Boolean((lastMsgMap.get(c.id) as any).is_deleted),
            }
          : undefined,
        unreadCount: unreadMap.get(c.id) || 0,
        otherName: c.type === "private" ? privateTitle : groupTitle,
        otherAvatar: c.type === "private" ? avatarFromRow(firstAvatarFromProfile((other?.profiles as any)?.avatars)) : null,
        otherRoleLabel: roleLabel,
        otherUserId,
        participantCount: parts.length,
        participantPreview,
        muted: mutedMap.get(c.id) || false,
      };
    });

    setConversations(enriched);
    setLoadingConvos(false);
  }, [profile.id]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const selectedPrivatePeerId = useMemo(() => {
    const c = conversations.find((x) => x.id === selectedId);
    return c?.type === "private" ? c.otherUserId : null;
  }, [conversations, selectedId]);

  /* ── נראות הצד השני בצ'אט פרטי (עמודה אופציונלית ב-DB) ─ */
  useEffect(() => {
    if (!selectedPrivatePeerId) {
      setPeerPresence(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("chat_presence")
        .eq("id", selectedPrivatePeerId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.chat_presence) setPeerPresence(null);
      else setPeerPresence(data.chat_presence);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPrivatePeerId]);

  // Clears the "new message" bell notifications for this conversation once
  // its messages have actually been read here, so they don't keep sitting
  // in the bell as unread after the user already saw them in the chat.
  const markConversationNotificationsRead = async (conversationId: string) => {
    await supabase.from("notifications")
      .update({ is_read: true })
      .eq("user_id", profile.id)
      .eq("type", "new_message")
      .eq("link", `/dashboard/chat?conversation=${conversationId}`)
      .eq("is_read", false);
  };

  /* ── Load messages for a conversation ──────────────────── */
  // Pulled out of the effect so it's also reachable as a resync path (see
  // the visibility-regain effect below): the panel previously depended
  // entirely on the Realtime INSERT subscription to keep an already-open
  // conversation's message list current, with no fallback - a dropped/
  // reconnected socket (e.g. the tab was backgrounded when a message
  // arrived) silently left it stuck showing stale (or, for a
  // freshly-opened conversation, empty) content even though the sidebar
  // preview - which re-queries independently via loadConversations - had
  // already moved on.
  const msgColumns = "id, sender_id, content, created_at, is_flagged, flag_reason, is_deleted, edited_at, reply_to_id, attachment_path, attachment_name, attachment_type, attachment_extracted_text, mentioned_user_ids";

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMsgs(true);

    const { data: msgRows, error: msgErr } = await supabase
      .from("messages")
      .select(msgColumns)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgErr) {
      toast({ title: "שגיאה בטעינת הודעות", description: msgErr.message, variant: "destructive" });
      setMessages([]);
      setLoadingMsgs(false);
      return;
    }

    const senderIds = [...new Set((msgRows || []).map((m) => m.sender_id))];
    const profById = new Map<string, { full_name: string | null; avatars: unknown }>();
    if (senderIds.length > 0) {
      const [profRes, avatarMap] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", senderIds),
        fetchAvatarsByUserIds(senderIds),
      ]);
      if (profRes.error) console.error("profiles (messages):", profRes.error);
      for (const p of profRes.data || []) {
        profById.set(p.id, {
          full_name: p.full_name,
          avatars: avatarMap.get(p.id) ?? null,
        });
      }
    }

    setMessages(
      (msgRows || []).map((m: any) => {
        const pr = profById.get(m.sender_id);
        const avRow = firstAvatarFromProfile(pr?.avatars);
        return {
          id: m.id,
          sender_id: m.sender_id,
          sender_name: (pr?.full_name && pr.full_name.trim()) || "משתמש",
          sender_avatar: avatarFromRow(avRow),
          content: m.content,
          created_at: m.created_at,
          is_flagged: m.is_flagged,
          flag_reason: m.flag_reason,
          is_deleted: m.is_deleted,
          edited_at: m.edited_at,
          reply_to_id: m.reply_to_id,
          attachment_path: m.attachment_path,
          attachment_name: m.attachment_name,
          attachment_type: m.attachment_type,
          attachment_extracted_text: m.attachment_extracted_text ?? null,
          mentioned_user_ids: m.mentioned_user_ids || [],
        };
      }),
    );
    setLoadingMsgs(false);

    // Mark as read
    await supabase.from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", profile.id);
    markConversationNotificationsRead(conversationId);

    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  /* ── Resync on tab focus: catch anything Realtime missed while away ── */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && selectedId) loadMessages(selectedId);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [selectedId, loadMessages]);

  /* ── Load messages for selected conversation ──────────── */
  useEffect(() => {
    if (!selectedId) return;
    setMessages([]);
    loadMessages(selectedId);

    // Realtime subscription
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    const channel = supabase
      .channel(`chat-${selectedId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${selectedId}`,
      }, async (payload) => {
        const m = payload.new as any;
        // Fetch sender info
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", m.sender_id)
          .maybeSingle();
        const avMap = await fetchAvatarsByUserIds([m.sender_id]);
        const avRow = avMap.get(m.sender_id);
        const newMsg: Message = {
          id: m.id,
          sender_id: m.sender_id,
          sender_name: ((prof as any)?.full_name && String((prof as any).full_name).trim()) || "משתמש",
          sender_avatar: avatarFromRow(avRow ?? null),
          content: m.content,
          created_at: m.created_at,
          is_flagged: m.is_flagged,
          flag_reason: m.flag_reason,
          is_deleted: m.is_deleted,
          edited_at: m.edited_at,
          reply_to_id: m.reply_to_id,
          attachment_path: m.attachment_path,
          attachment_name: m.attachment_name,
          attachment_type: m.attachment_type,
          attachment_extracted_text: m.attachment_extracted_text ?? null,
          mentioned_user_ids: m.mentioned_user_ids || [],
        };
        setMessages(prev => prev.some(msg => msg.id === newMsg.id) ? prev : [...prev, newMsg]);
        if (m.sender_id !== profile.id) {
          setTypingNames((prev) => {
            const next = { ...prev };
            delete next[m.sender_id];
            return next;
          });
        }
        // Update last message in list
        setConversations(prev => prev.map(c =>
          c.id === selectedId
            ? { ...c, lastMessage: { content: m.content, created_at: m.created_at, is_flagged: m.is_flagged, is_deleted: false }, updated_at: m.created_at }
            : c
        ));
        await supabase.from("conversation_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("conversation_id", selectedId).eq("user_id", profile.id);
        markConversationNotificationsRead(selectedId);
        refresh();
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `conversation_id=eq.${selectedId}`,
      }, (payload) => {
        const m = payload.new as any;
        setMessages((prev) => prev.map((msg) => msg.id === m.id
          ? { ...msg, content: m.content, is_deleted: m.is_deleted, edited_at: m.edited_at }
          : msg));
        // If this was the conversation's last message, keep the sidebar preview in sync too
        setConversations((prev) => prev.map((c) =>
          c.id === selectedId && c.lastMessage && c.lastMessage.created_at === m.created_at
            ? { ...c, lastMessage: { ...c.lastMessage, content: m.content, is_deleted: m.is_deleted } }
            : c
        ));
      })
      .on("postgres_changes", {
        event: "*", schema: "public", table: "conversation_participants",
        filter: `conversation_id=eq.${selectedId}`,
      }, () => {
        // Someone's last_read_at (read receipts) or the participant list
        // itself (added/removed/left) changed - just refetch both derived
        // views rather than trying to patch them from the bare payload.
        loadSelectedParticipants(selectedId);
        loadConversations();
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const { user_id, full_name } = (payload.payload || {}) as { user_id?: string; full_name?: string };
        if (!user_id || user_id === profile.id) return;
        setTypingNames((prev) => ({ ...prev, [user_id]: full_name || "מישהו" }));
        if (typingTimeouts.current[user_id]) clearTimeout(typingTimeouts.current[user_id]);
        typingTimeouts.current[user_id] = setTimeout(() => {
          setTypingNames((prev) => {
            const next = { ...prev };
            delete next[user_id];
            return next;
          });
        }, 3000);
      })
      .subscribe();
    realtimeRef.current = channel;

    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
      Object.values(typingTimeouts.current).forEach(clearTimeout);
      typingTimeouts.current = {};
      setTypingNames({});
      setReplyingTo(null);
      setEditingId(null);
      setMentionedIds(new Set());
      setPendingAttachment(null);
      setConvoSearchOpen(false);
      setConvoSearchQuery("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, profile.id]);

  // Handle deep linking from Dashboard. Guard on loadingConvos (not
  // conversations.length) - a brand-new user with zero conversations is
  // exactly the common case for "message my teacher for the first time",
  // and the old length check silently no-opped for them.
  useEffect(() => {
    if (loadingConvos || (!navState && !queryConversationId)) return;

    const targetUserId = navState?.targetUserId;
    const initialType = navState?.initialType;
    const targetConversationId = navState?.targetConversationId || queryConversationId || undefined;

    if (targetUserId) {
      const existing = conversations.find(c => c.otherUserId === targetUserId);
      if (existing) {
        selectConvo(existing.id);
        (window as any).history?.replaceState({}, "");
      } else {
        const u: SearchUser = { user_id: targetUserId, full_name: "צוות חינוכי", avatar: null, roleLabel: "" };
        startDM(u);
        (window as any).history?.replaceState({}, "");
      }
    } else if (targetConversationId) {
      // Deep link straight to a conversation by id (e.g. a class_subject group
      // that a caller like SubjectDetailPage just found-or-created). It may
      // not be in `conversations` yet if it was created moments ago, in the
      // same navigation - reload once before giving up.
      const existing = conversations.find(c => c.id === targetConversationId);
      if (existing) {
        selectConvo(existing.id);
        (window as any).history?.replaceState({}, "");
      } else {
        loadConversations().then(() => selectConvo(targetConversationId));
        (window as any).history?.replaceState({}, "");
      }
    } else if (initialType) {
      const groupToken = initialType === 'parent_class' ? 'הורי כיתה' : 'הורי שכבה';
      const existingGroup = conversations.find(c => c.title?.includes(groupToken) || c.type === initialType);
      if (existingGroup) {
        selectConvo(existingGroup.id);
        (window as any).history?.replaceState({}, "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingConvos, navState, queryConversationId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Global search: message content across all conversations ──── */
  useEffect(() => {
    const term = listFilter.trim();
    if (showNewChat || term.length < 2) { setMessageSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setMessageSearchLoading(true);
      const { data: rows, error } = await supabase
        .from("messages")
        .select("id, conversation_id, content, sender_id, created_at")
        .eq("is_deleted", false)
        .ilike("content", `%${term}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      setMessageSearchLoading(false);
      if (error || !rows?.length) { setMessageSearchResults([]); return; }

      const senderIds = [...new Set(rows.map((r) => r.sender_id))];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", senderIds);
      const nameMap = new Map((profs || []).map((p) => [p.id, p.full_name || "משתמש"]));
      const titleMap = new Map(conversations.map((c) => [c.id, c.otherName]));

      setMessageSearchResults(
        rows
          // RLS already restricts this to conversations the user's in, but
          // the title lookup needs them present in the loaded list too -
          // skip the rare case where it isn't (e.g. not loaded yet).
          .filter((r) => titleMap.has(r.conversation_id))
          .map((r) => ({
            id: r.id,
            conversation_id: r.conversation_id,
            content: r.content,
            sender_id: r.sender_id,
            created_at: r.created_at,
            conversationTitle: titleMap.get(r.conversation_id) || "שיחה",
            senderName: nameMap.get(r.sender_id) || "משתמש",
          })),
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [listFilter, showNewChat, conversations]);

  /* ── Search users for new DM ─────────────────────────── */
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchUsers([]); return; }
    const timer = setTimeout(async () => {
      const term = searchQuery.trim();
      let q = supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_approved", true)
        .neq("id", profile.id)
        .ilike("full_name", `%${term}%`);
      if (profile.schoolId) q = q.eq("school_id", profile.schoolId);
      const { data: profs, error } = await q.limit(25);
      if (error) {
        console.error("chat search profiles:", error);
        toast({ title: "חיפוש", description: error.message, variant: "destructive" });
        setSearchUsers([]);
        return;
      }
      if (!profs?.length) {
        setSearchUsers([]);
        return;
      }
      const searchIds = profs.map((p) => p.id);
      const [{ data: roleRows }, avatarMap] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", searchIds),
        fetchAvatarsByUserIds(searchIds),
      ]);
      const roleLabelByUser = new Map<string, string>();
      for (const row of roleRows || []) {
        const label = ROLE_LABELS[row.role as string] || row.role;
        roleLabelByUser.set(row.user_id, [roleLabelByUser.get(row.user_id), label].filter(Boolean).join(", "));
      }
      setSearchUsers(
        profs.map((u: { id: string; full_name: string }) => ({
          user_id: u.id,
          full_name: u.full_name,
          avatar: avatarFromRow(avatarMap.get(u.id) ?? null),
          roleLabel: roleLabelByUser.get(u.id) || "",
        })),
      );
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery, profile.id, profile.schoolId]);

  /* ── Start / find DM ─────────────────────────────────── */
  const startDM = async (user: SearchUser) => {
    // Already open in this session's list - no round-trip needed.
    const existing = conversations.find(
      (c) => c.type === "private" && c.otherUserId === user.user_id,
    );
    if (existing) {
      selectConvo(existing.id);
      setShowNewChat(false);
      return;
    }

    // find_or_create_private_conversation does the existence check and the
    // insert inside one advisory-locked transaction, so two near-
    // simultaneous calls for the same pair can't both create a duplicate
    // conversation the way the old client-side check-then-insert could.
    const { data: convoId, error } = await supabase.rpc("find_or_create_private_conversation", {
      p_other_user_id: user.user_id,
    });
    if (error || !convoId) {
      toast({ title: "שגיאה בפתיחת שיחה", description: error?.message, variant: "destructive" });
      return;
    }

    const wasNew = !conversations.some((c) => c.id === convoId);
    await loadConversations();
    selectConvo(convoId);
    setShowNewChat(false);
    if (wasNew) {
      const { data: convoRow } = await supabase.from("conversations").select("is_accepted").eq("id", convoId).single();
      if (convoRow && !convoRow.is_accepted) {
        toast({ title: "בקשת הודעה", description: "ניתן לשלוח הודעה אחת עד שיקבלו" });
      }
    }
  };

  /* ── Create group ─────────────────────────────────────── */
  const resetGroupDialog = () => {
    setGroupName("");
    setGroupMembers([]);
    setSearchQuery("");
  };

  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0 || creatingGroup) return;
    setCreatingGroup(true);

    let schoolId = profile.schoolId;
    if (!schoolId) {
      const { data: s } = await supabase.from("schools").select("id").limit(1).single();
      schoolId = s?.id;
    }
    if (!schoolId) { setCreatingGroup(false); return; }

    const { data: convo, error } = await supabase.from("conversations")
      .insert({ school_id: schoolId, type: "group", title: groupName.trim(), created_by: profile.id, is_accepted: true })
      .select("id").single();
    if (error || !convo) {
      toast({ title: "שגיאה ביצירת קבוצה", description: error?.message, variant: "destructive" });
      setCreatingGroup(false);
      return;
    }

    const { error: partErr } = await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: profile.id },
      ...groupMembers.map((m) => ({ conversation_id: convo.id, user_id: m.user_id })),
    ]);
    if (partErr) {
      toast({ title: "שגיאה בהוספת חברים לקבוצה", description: partErr.message, variant: "destructive" });
      setCreatingGroup(false);
      return;
    }

    await loadConversations();
    selectConvo(convo.id);
    setShowNewGroup(false);
    resetGroupDialog();
    setCreatingGroup(false);
    toast({ title: "הקבוצה נוצרה" });
  };

  /* ── Send message ─────────────────────────────────────── */
  const sendMessage = async () => {
    if ((!input.trim() && !pendingAttachment) || !selectedId || sending) return;

    const convo = conversations.find(c => c.id === selectedId);
    // Block: creator of unaccepted request already sent 1 message
    if (convo && !convo.is_accepted && convo.created_by === profile.id) {
      const { count } = await supabase
        .from("messages").select("*", { count: "exact", head: true })
        .eq("conversation_id", selectedId).eq("sender_id", profile.id);
      if ((count || 0) >= 1) {
        toast({ title: "ממתין לתגובה", description: "ניתן לשלוח הודעה אחת עד שיענו", variant: "destructive" });
        return;
      }
    }
    // Accept if receiver replies
    if (convo && !convo.is_accepted && convo.created_by !== profile.id) {
      await supabase.from("conversations").update({ is_accepted: true }).eq("id", selectedId);
      setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, is_accepted: true } : c));
    }

    if (quietHours) toast({ title: "שעות שקטות", description: "ההודעה תישלח אך ההתראות מושתקות" });

    setSending(true);
    const content = input.trim();
    const attachment = pendingAttachment;
    const replyToId = replyingTo?.id ?? null;
    const mentions = Array.from(mentionedIds);
    setInput("");
    setPendingAttachment(null);
    setReplyingTo(null);
    setMentionedIds(new Set());

    try {
      type ModResponse = {
        blocked?: boolean;
        block_reason?: string | null;
        flag?: boolean;
        flag_reason?: string | null;
        safe?: boolean;
        reason?: string | null;
      };

      let blocked = false;
      let flagged = false;
      let flagReason: string | null = null;

      if (content) {
        const { data: modResult } = await supabase.functions.invoke("chat-moderate", {
          body: {
            message: content,
            sender_name: profile.fullName,
            sender_id: profile.id,
            conversation_id: selectedId,
          },
        });

        const mr = modResult as ModResponse | null;
        blocked = mr?.blocked === true;
        const legacyUnsafe = Boolean(mr && mr.blocked !== true && mr.safe === false);
        flagged = !blocked && (mr?.flag === true || legacyUnsafe);
        flagReason = mr?.flag_reason || mr?.reason || null;

        if (blocked) {
          toast({
            title: "לא נשלחה",
            description:
              mr?.block_reason ||
              "ההודעה שכתבת לא עומדת בסטנדרט הקהילה שלנו. נסה/י לנסח מחדש בנימוס ובכבוד.",
            variant: "destructive",
          });
          setInput(content);
          setPendingAttachment(attachment);
          return;
        }
      }

      const { data: inserted, error: insertError } = await supabase.from("messages").insert({
        conversation_id: selectedId,
        sender_id: profile.id,
        content: content || "",
        is_flagged: flagged,
        flag_reason: flagged ? flagReason : null,
        reply_to_id: replyToId,
        mentioned_user_ids: mentions,
        attachment_path: attachment?.path ?? null,
        attachment_name: attachment?.name ?? null,
        attachment_type: attachment?.type ?? null,
        attachment_extracted_text: attachment?.extractedText ?? null,
      }).select(msgColumns).single();
      if (insertError) throw insertError;

      // Show the sent message immediately instead of waiting on the
      // Realtime echo (which is what made sending feel slow) - the
      // Realtime INSERT handler already dedupes by id, so when that event
      // does arrive it's a no-op here.
      if (inserted) {
        const m = inserted as any;
        setMessages((prev) => prev.some((msg) => msg.id === m.id) ? prev : [...prev, {
          id: m.id,
          sender_id: m.sender_id,
          sender_name: profile.fullName,
          sender_avatar: profile.avatar,
          content: m.content,
          created_at: m.created_at,
          is_flagged: m.is_flagged,
          flag_reason: m.flag_reason,
          is_deleted: m.is_deleted,
          edited_at: m.edited_at,
          reply_to_id: m.reply_to_id,
          attachment_path: m.attachment_path,
          attachment_name: m.attachment_name,
          attachment_type: m.attachment_type,
          attachment_extracted_text: m.attachment_extracted_text ?? null,
          mentioned_user_ids: m.mentioned_user_ids || [],
        }]);
        setConversations((prev) => prev.map((c) =>
          c.id === selectedId
            ? { ...c, lastMessage: { content: m.content, created_at: m.created_at, is_flagged: m.is_flagged, is_deleted: false }, updated_at: m.created_at }
            : c
        ));
      }

      await supabase.from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedId);

      if (flagged) {
        toast({
          title: "הודעה נשלחה לבדיקה",
          description: flagReason || "התוכן סומן לצוות",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
      setInput(content);
      setPendingAttachment(attachment);
    } finally {
      setSending(false);
    }
  };

  /* ── Schedule message for later ───────────────────────── */
  const scheduleMessage = async () => {
    if (!input.trim() || !selectedId || !scheduleAt || scheduling) return;
    const sendAtDate = new Date(scheduleAt);
    if (isNaN(sendAtDate.getTime()) || sendAtDate.getTime() <= Date.now()) {
      toast({ title: "יש לבחור זמן עתידי", variant: "destructive" });
      return;
    }

    setScheduling(true);
    const content = input.trim();

    try {
      // Same moderation gate as an immediate send - a plpgsql function can't
      // call the chat-moderate edge function, so this has to happen now,
      // at schedule time, with the result stored for delivery time.
      const { data: modResult } = await supabase.functions.invoke("chat-moderate", {
        body: {
          message: content,
          sender_name: profile.fullName,
          sender_id: profile.id,
          conversation_id: selectedId,
        },
      });
      const mr = modResult as {
        blocked?: boolean; block_reason?: string | null;
        flag?: boolean; flag_reason?: string | null;
        safe?: boolean; reason?: string | null;
      } | null;
      const blocked = mr?.blocked === true;
      if (blocked) {
        toast({
          title: "לא ניתן לתזמן",
          description: mr?.block_reason || "ההודעה שכתבת לא עומדת בסטנדרט הקהילה שלנו. נסה/י לנסח מחדש בנימוס ובכבוד.",
          variant: "destructive",
        });
        return;
      }
      const legacyUnsafe = Boolean(mr && mr.blocked !== true && mr.safe === false);
      const flagged = mr?.flag === true || legacyUnsafe;
      const flagReason = mr?.flag_reason || mr?.reason || null;

      const { data, error } = await supabase.from("scheduled_chat_messages")
        .insert({
          conversation_id: selectedId, sender_id: profile.id, content,
          send_at: sendAtDate.toISOString(), is_flagged: flagged, flag_reason: flagged ? flagReason : null,
        })
        .select("id, content, send_at").single();
      if (error || !data) throw error;

      setScheduledMessages((prev) => [...prev, data].sort((a, b) => a.send_at.localeCompare(b.send_at)));
      setInput("");
      setScheduleOpen(false);
      setScheduleAt("");
      toast({ title: "⏰ ההודעה תוזמנה", description: `תישלח ב-${sendAtDate.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}` });
    } catch (err: any) {
      toast({ title: "שגיאה בתזמון ההודעה", description: err?.message, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  const cancelScheduledMessage = async (id: string) => {
    setScheduledMessages((prev) => prev.filter((m) => m.id !== id));
    const { error } = await supabase.from("scheduled_chat_messages").delete().eq("id", id);
    if (error) toast({ title: "שגיאה בביטול התזמון", description: error.message, variant: "destructive" });
  };

  /* ── Edit / delete own message ─────────────────────────── */
  const startEditMessage = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.content);
    setReplyingTo(null);
  };

  const cancelEditMessage = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEditMessage = async () => {
    if (!editingId || !editText.trim() || !selectedId) return;
    const text = editText.trim();
    const id = editingId;
    setEditingId(null);
    setEditText("");

    // An edited message never went through send-time moderation again -
    // someone could post something innocuous and edit it into something
    // that should have been blocked/flagged, skipping chat-moderate
    // entirely. Same gate as a fresh send.
    const { data: modResult } = await supabase.functions.invoke("chat-moderate", {
      body: { message: text, sender_name: profile.fullName, sender_id: profile.id, conversation_id: selectedId },
    });
    const mr = modResult as {
      blocked?: boolean; block_reason?: string | null;
      flag?: boolean; flag_reason?: string | null;
      safe?: boolean; reason?: string | null;
    } | null;
    if (mr?.blocked === true) {
      toast({
        title: "לא ניתן לשמור",
        description: mr.block_reason || "התוכן אינו עומד בסטנדרט הקהילה שלנו. נסה/י לנסח מחדש בנימוס ובכבוד.",
        variant: "destructive",
      });
      setEditingId(id);
      setEditText(text);
      return;
    }
    const legacyUnsafe = Boolean(mr && mr.blocked !== true && mr.safe === false);
    const flagged = mr?.flag === true || legacyUnsafe;
    const flagReason = mr?.flag_reason || mr?.reason || null;

    const editedAt = new Date().toISOString();
    setMessages((prev) => prev.map((m) => m.id === id
      ? { ...m, content: text, edited_at: editedAt, is_flagged: flagged, flag_reason: flagged ? flagReason : null }
      : m));
    const { error } = await supabase.from("messages")
      .update({ content: text, edited_at: editedAt, is_flagged: flagged, flag_reason: flagged ? flagReason : null })
      .eq("id", id);
    if (error) toast({ title: "שגיאה בעריכת ההודעה", description: error.message, variant: "destructive" });
    else if (flagged) toast({ title: "ההודעה המעודכנת נשלחה לבדיקה", description: flagReason || "התוכן סומן לצוות", variant: "destructive" });
  };

  const deleteMessage = async (id: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_deleted: true } : m));
    const { error } = await supabase.from("messages").update({ is_deleted: true }).eq("id", id);
    if (error) toast({ title: "שגיאה במחיקת ההודעה", description: error.message, variant: "destructive" });
  };

  /* ── Typing indicator (Realtime broadcast, nothing persisted) ── */
  const notifyTyping = () => {
    if (!realtimeRef.current) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    realtimeRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: profile.id, full_name: profile.fullName },
    });
  };

  /* ── @mentions ─────────────────────────────────────────── */
  const handleComposerChange = (value: string) => {
    setInput(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const uptoCaret = value.slice(0, caret);
    const match = uptoCaret.match(/(?:^|\s)@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
    notifyTyping();
  };

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.trim().toLowerCase();
    return selectedParticipants
      .filter((p) => p.user_id !== profile.id && (!q || p.full_name.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [mentionQuery, selectedParticipants, profile.id]);

  const selectMention = (p: Participant) => {
    const caret = textareaRef.current?.selectionStart ?? input.length;
    const uptoCaret = input.slice(0, caret);
    const replaced = uptoCaret.replace(/(?:^|\s)@([^\s@]*)$/, (m) => (m.startsWith(" ") ? " " : "") + `@${p.full_name} `);
    setInput(replaced + input.slice(caret));
    setMentionedIds((prev) => new Set(prev).add(p.user_id));
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  /* ── Attachments ───────────────────────────────────────── */
  const pickAttachment = () => fileInputRef.current?.click();

  const handleAttachmentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "קובץ גדול מדי", description: "עד 15MB לקובץ", variant: "destructive" });
      return;
    }
    setUploadingAttachment(true);
    try {
      // crypto.randomUUID() only exists in a secure context (HTTPS or
      // localhost) - falling silently through to an uncaught exception here
      // would leave the button stuck spinning forever with no feedback,
      // which is exactly what "upload does nothing" looks like from the
      // outside. Never rely on it alone for something this visible.
      const uniqueId = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `${selectedId}/${uniqueId}-${file.name}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (error) throw error;
      setPendingAttachment({ path, name: file.name, type: file.type || "application/octet-stream", extractedText: null });

      // Best-effort: a document/image whose text can't be extracted still
      // attaches fine, it just won't be searchable/previewable as text.
      if (isExtractableDocument(file) || isImageFile(file)) {
        setExtractingAttachment(true);
        try {
          const text = isImageFile(file)
            ? await requestImageOcr(file, "text")
            : await extractDocumentText(file);
          setPendingAttachment((prev) => (prev && prev.path === path ? { ...prev, extractedText: text.slice(0, 8000) } : prev));
        } catch (extractErr) {
          console.error("Chat attachment text extraction failed", extractErr);
        } finally {
          setExtractingAttachment(false);
        }
      }
    } catch (err: any) {
      toast({ title: "שגיאה בהעלאת הקובץ", description: err?.message || "נסה/י שוב", variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "שגיאה בפתיחת הקובץ", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  /* ── Group management ─────────────────────────────────── */
  const openGroupInfo = () => {
    setGroupInfoName(selectedConvo?.title || "");
    setGroupAddQuery("");
    setGroupAddResults([]);
    setShowGroupInfo(true);
  };

  const renameGroup = async () => {
    if (!selectedId || !groupInfoName.trim()) return;
    const title = groupInfoName.trim();
    setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, title, otherName: title } : c));
    const { error } = await supabase.from("conversations").update({ title }).eq("id", selectedId);
    if (error) toast({ title: "שגיאה בשינוי שם", description: error.message, variant: "destructive" });
  };

  useEffect(() => {
    if (!showGroupInfo || !groupAddQuery.trim()) { setGroupAddResults([]); return; }
    const timer = setTimeout(async () => {
      const term = groupAddQuery.trim();
      let q = supabase.from("profiles").select("id, full_name").eq("is_approved", true).ilike("full_name", `%${term}%`);
      if (profile.schoolId) q = q.eq("school_id", profile.schoolId);
      const { data: profs } = await q.limit(15);
      const existingIds = new Set(selectedParticipants.map((p) => p.user_id));
      setGroupAddResults(
        (profs || [])
          .filter((p: any) => !existingIds.has(p.id))
          .map((p: any) => ({ user_id: p.id, full_name: p.full_name, avatar: null, roleLabel: "" })),
      );
    }, 280);
    return () => clearTimeout(timer);
  }, [groupAddQuery, showGroupInfo, profile.schoolId, selectedParticipants]);

  const addGroupMember = async (userId: string) => {
    if (!selectedId) return;
    const { error } = await supabase.from("conversation_participants").insert({ conversation_id: selectedId, user_id: userId });
    if (error) {
      toast({ title: "שגיאה בהוספת חבר/ה", description: error.message, variant: "destructive" });
      return;
    }
    setGroupAddQuery("");
    setGroupAddResults([]);
    loadSelectedParticipants(selectedId);
    loadConversations();
  };

  const removeGroupMember = async (userId: string) => {
    if (!selectedId) return;
    const { error } = await supabase.from("conversation_participants")
      .delete().eq("conversation_id", selectedId).eq("user_id", userId);
    if (error) {
      toast({ title: "שגיאה בהסרת חבר/ה", description: error.message, variant: "destructive" });
      return;
    }
    loadSelectedParticipants(selectedId);
    loadConversations();
  };

  const leaveGroup = async () => {
    if (!selectedId) return;
    const { error } = await supabase.from("conversation_participants")
      .delete().eq("conversation_id", selectedId).eq("user_id", profile.id);
    if (error) {
      toast({ title: "שגיאה ביציאה מהקבוצה", description: error.message, variant: "destructive" });
      return;
    }
    setShowGroupInfo(false);
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
    toast({ title: "יצאת מהקבוצה" });
  };

  /* ── In-conversation search ────────────────────────────── */
  const visibleMessages = useMemo(() => {
    const q = convoSearchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => !m.is_deleted && m.content.toLowerCase().includes(q));
  }, [messages, convoSearchQuery]);

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const attachmentIcon = (type: string | null) =>
    type?.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />;

  /* ── Resolve signed URLs for image attachments so they can render inline
     instead of just a "📎 filename" chip ─────────────────────────────── */
  useEffect(() => {
    const paths = [...new Set(
      messages
        .filter((m) => !m.is_deleted && m.attachment_path && m.attachment_type?.startsWith("image/"))
        .map((m) => m.attachment_path as string)
    )].filter((p) => !imageUrls[p]);
    if (paths.length === 0) return;

    supabase.storage.from("chat-attachments").createSignedUrls(paths, 60 * 60 * 24).then(({ data, error }) => {
      if (error || !data) return;
      setImageUrls((prev) => {
        const next = { ...prev };
        for (const row of data) {
          if (row.signedUrl && row.path) next[row.path] = row.signedUrl;
        }
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const selectConvo = (id: string) => {
    setSelectedId(id);
    setMobileShowChat(true);
    setShowNewChat(false);
  };

  const acceptRequest = async (convoId: string) => {
    await supabase.from("conversations").update({ is_accepted: true }).eq("id", convoId);
    setConversations(prev => prev.map(c => c.id === convoId ? { ...c, is_accepted: true } : c));
    selectConvo(convoId);
    toast({ title: "בקשה אושרה" });
  };

  const declineRequest = async (convoId: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", convoId);
    if (error) {
      toast({ title: "שגיאה בדחיית הבקשה", variant: "destructive" });
      return;
    }
    setConversations(prev => prev.filter(c => c.id !== convoId));
    if (selectedId === convoId) setSelectedId(null);
    toast({ title: "הבקשה נדחתה" });
  };

  /* ── Derived data ─────────────────────────────────────── */
  const requests = conversations.filter(c => !c.is_accepted && c.created_by !== profile.id);
  const totalUnread = conversations.reduce((n, c) => n + c.unreadCount, 0);
  const selectedConvo = conversations.find(c => c.id === selectedId);

  const filteredConversations = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = c.otherName.toLowerCase();
      const title = (c.title || "").toLowerCase();
      const sub = (c.subject || "").toLowerCase();
      const gr = (c.grade || "").toLowerCase();
      return name.includes(q) || title.includes(q) || sub.includes(q) || gr.includes(q);
    });
  }, [conversations, listFilter]);

  const groupedConversationSections = useMemo(() => {
    const knownTypes = new Set(CHANNEL_SECTIONS.flatMap((s) => s.types));
    const sections = CHANNEL_SECTIONS.map((sec) => ({
      title: sec.title,
      items: filteredConversations
        .filter((c) => sec.types.includes(c.type))
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
    })).filter((s) => s.items.length > 0);

    const other = filteredConversations.filter((c) => !knownTypes.has(c.type));
    if (other.length > 0) {
      sections.push({
        title: "אחר",
        items: other.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      });
    }
    return sections;
  }, [filteredConversations]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const formatListTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return formatTime(iso);
    return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
  };

  const typeIcon = (type: string) => {
    if (type === "group") return <Users className="h-4 w-4" />;
    if (type === "class_subject") return <BookOpen className="h-4 w-4" />;
    if (type === "class_homeroom") return <School className="h-4 w-4" />;
    if (type === "counseling") return <HeartHandshake className="h-4 w-4" />;
    if (type === "parent_teacher") return <UserRound className="h-4 w-4" />;
    if (type === "class_parent_group") return <Users className="h-4 w-4" />;
    if (type === "grade_parent_group") return <School className="h-4 w-4" />;
    return <MessageCircle className="h-4 w-4" />;
  };

  const typeColor = (type: string) => {
    if (type === "group") return "bg-info/15 text-info";
    if (type === "class_subject") return "bg-accent/15 text-accent";
    if (type === "class_homeroom") return "bg-success/15 text-success";
    if (type === "counseling") return "bg-destructive/15 text-destructive";
    if (type === "parent_teacher") return "bg-warning/15 text-warning";
    if (type === "class_parent_group") return "bg-secondary/40 text-secondary-foreground";
    if (type === "grade_parent_group") return "bg-primary/15 text-primary";
    return "bg-muted text-muted-foreground";
  };

  /* ── Render conversation row ──────────────────────────── */
  const ConvoRow = ({ c }: { c: Conversation }) => {
    const isSelected = selectedId === c.id;
    return (
      <button
        onClick={() => selectConvo(c.id)}
        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-right border-b border-border/40 last:border-0
          ${isSelected ? "bg-primary/8 border-l-2 border-l-primary" : ""}`}
      >
        {/* Avatar / icon */}
        <div className="shrink-0 relative">
          {c.type === "private" && c.otherAvatar ? (
            <AvatarPreview config={c.otherAvatar} size={42} />
          ) : (
            <div className={`w-[42px] h-[42px] rounded-lg flex items-center justify-center ${typeColor(c.type)}`}>
              {typeIcon(c.type)}
            </div>
          )}
          {c.unreadCount > 0 && (
            <span className="absolute -top-1 -left-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {c.unreadCount > 9 ? "9+" : c.unreadCount}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={`font-heading text-sm truncate ${c.unreadCount > 0 ? "font-bold" : "font-medium"}`}>
              {c.otherName}
            </p>
            {c.lastMessage && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatListTime(c.lastMessage.created_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!c.is_accepted && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
            <p className={`text-xs truncate ${c.unreadCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>
              {c.lastMessage
                ? c.lastMessage.is_deleted
                  ? "ההודעה נמחקה"
                  : c.lastMessage.is_flagged ? "⚠️ " + c.lastMessage.content : c.lastMessage.content
                : c.otherRoleLabel || "אין הודעות"}
            </p>
          </div>
        </div>
      </button>
    );
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="h-[calc(100vh-5rem)] md:h-[calc(100vh-2rem)] flex flex-col">
      {/* Page header */}
      <div className="mb-3 shrink-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {mobileShowChat && (
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileShowChat(false)}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-2xl font-heading font-bold">שיחות</h1>
            {totalUnread > 0 && <Badge variant="destructive" className="text-xs">{totalUnread}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canSetPresence && (
              <Select value={myPresence} onValueChange={updateMyPresence}>
                <SelectTrigger className="h-8 w-[148px] text-xs">
                  <SelectValue placeholder="נראות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">{PRESENCE_LABELS.available}</SelectItem>
                  <SelectItem value="in_lesson">{PRESENCE_LABELS.in_lesson}</SelectItem>
                  <SelectItem value="resting">{PRESENCE_LABELS.resting}</SelectItem>
                </SelectContent>
              </Select>
            )}
            {quietHours && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Moon className="h-3 w-3" />שעות שקטות
              </Badge>
            )}
          </div>
        </div>
        <details className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
          <summary className="cursor-pointer select-none font-medium text-foreground/85">
            מבנה מרחב השיחות
          </summary>
          <p className="mt-2 pe-2">
            השיחות מסודרות לפי הקשר פדגוגי: מקצועות, חדר כיתה, ייעוץ, ערוץ הורה–מורה ושיחות אישיות.
            צוות יכול לסמן נראות (בשיעור / במנוחה). תוכן פוגען נחסם לפני שליחה; מצוקה מזוהה בדיסקרטיות לצוות טיפולי.
            Live Engagement (אנונימי בסקרים) וגיימיפיקציית קהילה — בשלבי הרחבה.
          </p>
        </details>
      </div>

      <div className="flex flex-1 min-h-0 rounded-lg border border-border overflow-hidden bg-card">

        {/* ── Left panel: conversation list ────────────────── */}
        <div className={`w-full md:w-80 lg:w-96 border-l border-border flex flex-col ${mobileShowChat ? "hidden md:flex" : "flex"}`}>

          {/* Search bar + new chat button */}
          <div className="p-3 border-b border-border flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  showNewChat ? "שם פרטי או משפחה באותו בית ספר..." : "חיפוש ברשימת השיחות..."
                }
                className="pr-9 h-9 text-sm bg-muted/40 border-0 focus-visible:ring-1"
                value={showNewChat ? searchQuery : listFilter}
                onChange={(e) => (showNewChat ? setSearchQuery(e.target.value) : setListFilter(e.target.value))}
              />
            </div>
            <Button
              size="icon"
              variant={showNewChat ? "secondary" : "ghost"}
              className="h-9 w-9 shrink-0"
              onClick={() => setShowNewChat((s) => !s)}
              title="שיחה חדשה"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              onClick={() => { resetGroupDialog(); setShowNewGroup(true); }}
              title="קבוצה חדשה"
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>

          {/* New chat search panel */}
          {showNewChat && (
            <div className="border-b border-border">
              <p className="px-3 pt-2 pb-1 text-[11px] text-muted-foreground leading-snug">
                חיפוש לפי שם — משתמשים מאושרים באותו בית ספר. אם אין תוצאות, ייתכן שחברים עדיין לא אושרו או שאין להם שם מלא בפרופיל.
              </p>
              {searchUsers.length > 0 && (
                <div className="max-h-52 overflow-y-auto">
                  {searchUsers.map(u => (
                    <button key={u.user_id} onClick={() => startDM(u)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-right border-t border-border/30">
                      {u.avatar ? (
                        <AvatarPreview config={u.avatar} size={34} />
                      ) : (
                        <div className="w-[34px] h-[34px] rounded-xl bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                          {u.full_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-heading text-sm font-medium">{u.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{u.roleLabel}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.trim().length >= 1 && searchUsers.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4 px-2">
                  לא נמצאו משתמשים לפי החיפוש
                </p>
              )}
            </div>
          )}

          {/* Global search results: message content across all conversations */}
          {!showNewChat && listFilter.trim().length >= 2 && (messageSearchResults.length > 0 || messageSearchLoading) && (
            <div className="border-b border-border max-h-56 overflow-y-auto">
              <div className="px-4 py-2 text-[10px] font-heading font-semibold uppercase tracking-wide text-muted-foreground bg-muted/25 border-b border-border/40 flex items-center gap-1.5">
                {messageSearchLoading && <div className="w-2.5 h-2.5 border-2 border-muted-foreground/40 border-t-transparent rounded-full animate-spin" />}
                תוצאות בהודעות
              </div>
              {messageSearchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { selectConvo(r.conversation_id); setListFilter(""); }}
                  className="w-full flex flex-col items-start gap-0.5 px-4 py-2.5 hover:bg-muted/50 transition-colors text-right border-t border-border/30 first:border-t-0"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="font-heading text-xs font-semibold truncate">{r.conversationTitle}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatListTime(r.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate w-full">
                    <span className="font-medium text-foreground/80">{r.senderName}: </span>{r.content}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Message requests banner */}
          {requests.length > 0 && (
            <button
              className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-border hover:bg-primary/10 transition-colors w-full text-right"
              onClick={() => {
                const r = requests[0];
                selectConvo(r.id);
              }}
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading text-sm font-medium">בקשות הודעה</p>
                <p className="text-xs text-muted-foreground">{requests.length} בקשות ממתינות</p>
              </div>
              <Badge variant="default" className="text-[10px] shrink-0">{requests.length}</Badge>
            </button>
          )}

          {/* Conversations list */}
          <ScrollArea className="flex-1">
            {loadingConvos ? (
              <div className="flex flex-col gap-3 p-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-32" />
                      <div className="h-2.5 bg-muted rounded w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="font-heading font-medium text-muted-foreground">אין שיחות עדיין</p>
                <p className="text-xs text-muted-foreground mt-1">לחץ + כדי להתחיל שיחה חדשה</p>
              </div>
            ) : groupedConversationSections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Search className="h-10 w-10 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">לא נמצאו שיחות לפי החיפוש</p>
              </div>
            ) : (
              groupedConversationSections.map((sec) => (
                <div key={sec.title}>
                  <div className="px-4 py-2 text-[10px] font-heading font-semibold uppercase tracking-wide text-muted-foreground bg-muted/25 border-b border-border/40">
                    {sec.title}
                  </div>
                  {sec.items.map((c) => (
                    <ConvoRow key={c.id} c={c} />
                  ))}
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        {/* ── Right panel: messages ─────────────────────────── */}
        <div className={`flex-1 flex flex-col min-w-0 ${!mobileShowChat ? "hidden md:flex" : "flex"}`}>
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <MessageCircle className="h-16 w-16 text-muted-foreground/15 mb-4" />
              <p className="font-heading font-medium text-muted-foreground">בחר שיחה כדי להתחיל</p>
              <p className="text-xs text-muted-foreground mt-1">או לחץ + לשיחה חדשה</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
                {selectedConvo?.type === "private" && selectedConvo.otherAvatar ? (
                  <AvatarPreview config={selectedConvo.otherAvatar} size={36} />
                ) : (
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${typeColor(selectedConvo?.type || "private")}`}>
                    {typeIcon(selectedConvo?.type || "private")}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-sm truncate">{selectedConvo?.otherName}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {selectedConvo?.type === "private" ? (
                      <>
                        {selectedConvo.otherRoleLabel || "שיחה פרטית"}
                        {peerPresence && (
                          <span>
                            {" · "}
                            {PRESENCE_LABELS[peerPresence] || peerPresence}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {(selectedConvo?.participantCount ?? 0) === 0
                          ? "טוען משתתפים…"
                          : `${selectedConvo?.participantCount} משתתפים`}
                        {selectedConvo?.participantPreview ? (
                          <span className="block mt-0.5 opacity-90">{selectedConvo.participantPreview}</span>
                        ) : null}
                      </>
                    )}
                    {!selectedConvo?.is_accepted && " • בקשת הודעה"}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => { setConvoSearchOpen((s) => !s); setConvoSearchQuery(""); }}
                    title="חיפוש בשיחה"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                  {selectedConvo && (
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => toggleMute(selectedConvo.id, selectedConvo.muted)}
                      title={selectedConvo.muted ? "בטל השתקה" : "השתק שיחה"}
                    >
                      {selectedConvo.muted ? <BellOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Bell className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  {selectedConvo?.type === "group" && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={openGroupInfo} title="פרטי קבוצה">
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* In-conversation search */}
              {convoSearchOpen && (
                <div className="px-4 py-2 border-b border-border shrink-0 relative">
                  <Search className="absolute right-7 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="חיפוש בהודעות השיחה..."
                    className="pr-8 h-8 text-sm"
                    value={convoSearchQuery}
                    onChange={(e) => setConvoSearchQuery(e.target.value)}
                  />
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-3">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="h-10 w-10 text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {convoSearchQuery.trim()
                        ? "לא נמצאו הודעות תואמות"
                        : selectedConvo?.is_accepted ? "אין הודעות עדיין — שלח הודעה ראשונה!" : "שלח הודעה ראשונה..."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleMessages.map((msg, idx) => {
                      const isMe = msg.sender_id === profile.id;
                      const prevMsg = visibleMessages[idx - 1];
                      const isGroupChat = Boolean(selectedConvo && selectedConvo.type !== "private");
                      /* בקבוצה: תמיד מציגים מי שלח. בפרטי: רק בתחילת רצף מאותו צד (כמו וואטסאפ) */
                      const showPeerHeader =
                        !isMe && (isGroupChat || prevMsg?.sender_id !== msg.sender_id);
                      const showDate = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(visibleMessages[idx - 1].created_at).toDateString();
                      const replySource = msg.reply_to_id ? messagesById.get(msg.reply_to_id) : null;
                      const isRead = isMe && !msg.is_deleted && allOthersReadAt !== null && msg.created_at <= allOthersReadAt;
                      const isEditing = editingId === msg.id;

                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="flex items-center justify-center my-3">
                              <span className="text-[10px] text-muted-foreground bg-muted px-3 py-0.5 rounded-full">
                                {new Date(msg.created_at).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}
                              </span>
                            </div>
                          )}
                          <div className={`group flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${idx > 0 && visibleMessages[idx - 1].sender_id === msg.sender_id ? "mt-0.5" : "mt-2"}`}>
                            {!isMe && (
                              <div className="w-8 h-8 shrink-0 mt-auto">
                                {showPeerHeader ? (
                                  msg.sender_avatar ? (
                                    <AvatarPreview config={msg.sender_avatar} size={32} />
                                  ) : (
                                    <div
                                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-heading font-semibold text-muted-foreground border border-border/60"
                                      title={msg.sender_name}
                                    >
                                      {(msg.sender_name || "?").trim().charAt(0) || "?"}
                                    </div>
                                  )
                                ) : (
                                  <div className="w-8 h-8" aria-hidden />
                                )}
                              </div>
                            )}
                            <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                              {showPeerHeader && (
                                <p className="text-[11px] font-medium text-foreground/90 mb-0.5 px-1 leading-tight">
                                  {msg.sender_name}
                                </p>
                              )}
                              <div className={`flex items-center gap-1 ${isMe ? "flex-row-reverse" : ""}`}>
                                {!msg.is_deleted && !isEditing && (
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                                    <button
                                      type="button" title="השב" onClick={() => { setReplyingTo(msg); setEditingId(null); textareaRef.current?.focus(); }}
                                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                                    >
                                      <Reply className="h-3 w-3" />
                                    </button>
                                    {isMe && (
                                      <>
                                        <button type="button" title="ערוך" onClick={() => startEditMessage(msg)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button type="button" title="מחק" onClick={() => deleteMessage(msg.id)} className="p-1 rounded hover:bg-muted text-destructive/80">
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                                <div className={`rounded-lg px-3.5 py-2 text-sm leading-relaxed min-w-0
                                  ${isMe
                                    ? "bg-primary text-primary-foreground rounded-tl-lg rounded-tr-sm"
                                    : "bg-muted rounded-tr-lg rounded-tl-sm"}
                                  ${msg.is_flagged ? "ring-1 ring-warning" : ""}`}>
                                  {msg.is_deleted ? (
                                    <span className="italic opacity-60">ההודעה נמחקה</span>
                                  ) : (
                                    <>
                                      {replySource && (
                                        <div className={`rounded-lg px-2 py-1 mb-1.5 text-xs border-r-2 ${isMe ? "bg-black/10 border-primary-foreground/40" : "bg-background/60 border-primary/50"}`}>
                                          <p className="font-medium opacity-80 truncate">{replySource.sender_name}</p>
                                          <p className="opacity-70 truncate">{replySource.is_deleted ? "ההודעה נמחקה" : replySource.content}</p>
                                        </div>
                                      )}
                                      {isEditing ? (
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            autoFocus
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") { e.preventDefault(); saveEditMessage(); }
                                              if (e.key === "Escape") cancelEditMessage();
                                            }}
                                            className="bg-transparent border-b border-current/30 outline-none text-sm min-w-[8rem] flex-1"
                                          />
                                          <button type="button" onClick={saveEditMessage} title="שמור"><Check className="h-3.5 w-3.5" /></button>
                                          <button type="button" onClick={cancelEditMessage} title="ביטול"><X className="h-3.5 w-3.5" /></button>
                                        </div>
                                      ) : (
                                        <>
                                          {msg.content}
                                          {msg.attachment_path && msg.attachment_type?.startsWith("image/") ? (
                                            imageUrls[msg.attachment_path] ? (
                                              <button
                                                type="button"
                                                onClick={() => openAttachment(msg.attachment_path!)}
                                                className="mt-1.5 block w-full"
                                              >
                                                <img
                                                  src={imageUrls[msg.attachment_path]}
                                                  alt={msg.attachment_name || "תמונה מצורפת"}
                                                  className="rounded-lg max-h-64 w-auto max-w-full object-contain"
                                                />
                                              </button>
                                            ) : (
                                              <div className={`mt-1.5 h-32 w-40 rounded-lg flex items-center justify-center ${isMe ? "bg-black/10" : "bg-background/60"}`}>
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
                                              </div>
                                            )
                                          ) : msg.attachment_path && (
                                            <button
                                              type="button"
                                              onClick={() => openAttachment(msg.attachment_path!)}
                                              className={`mt-1.5 flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 w-full ${isMe ? "bg-black/10 hover:bg-black/15" : "bg-background/60 hover:bg-background"}`}
                                            >
                                              {attachmentIcon(msg.attachment_type)}
                                              <span className="truncate flex-1 text-right">{msg.attachment_name || "קובץ מצורף"}</span>
                                            </button>
                                          )}
                                          {msg.attachment_extracted_text && (
                                            <div className="mt-1">
                                              <button
                                                type="button"
                                                onClick={() => setExpandedExtractedText((prev) => {
                                                  const next = new Set(prev);
                                                  next.has(msg.id) ? next.delete(msg.id) : next.add(msg.id);
                                                  return next;
                                                })}
                                                className="text-[10px] underline opacity-70 hover:opacity-100"
                                              >
                                                {expandedExtractedText.has(msg.id) ? "הסתר טקסט שחולץ" : "הצג טקסט שחולץ"}
                                              </button>
                                              {expandedExtractedText.has(msg.id) && (
                                                <div className={`mt-1 rounded-lg px-2 py-1.5 text-[11px] whitespace-pre-wrap max-h-40 overflow-y-auto ${isMe ? "bg-black/10" : "bg-background/60"}`}>
                                                  {msg.attachment_extracted_text}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {msg.is_flagged && (
                                        <div className="flex items-center gap-1 mt-1 text-[9px] opacity-60">
                                          <AlertTriangle className="h-3 w-3" />
                                          {msg.flag_reason || "תוכן סומן"}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              <p className={`text-[9px] text-muted-foreground mt-0.5 px-1 flex items-center gap-1 ${isMe ? "self-end flex-row-reverse" : ""}`}>
                                <span>{formatTime(msg.created_at)}{msg.edited_at && !msg.is_deleted ? " · נערך" : ""}</span>
                                {isMe && !msg.is_deleted && (
                                  isRead
                                    ? <CheckCheck className="h-3 w-3 text-primary" />
                                    : <Check className="h-3 w-3" />
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Typing indicator */}
              {Object.keys(typingNames).length > 0 && (
                <p className="px-4 pb-1 text-[11px] text-muted-foreground italic shrink-0">
                  {Object.values(typingNames).join(", ")} {Object.keys(typingNames).length === 1 ? "מקליד/ה" : "מקלידים"}...
                </p>
              )}

              {/* Scheduled messages pending for this conversation */}
              {scheduledMessages.length > 0 && (
                <div className="px-3 py-2 border-t border-border shrink-0 space-y-1 max-h-24 overflow-y-auto">
                  {scheduledMessages.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-2.5 py-1.5">
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 min-w-0 truncate">{m.content}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(m.send_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      <button type="button" onClick={() => cancelScheduledMessage(m.id)} title="ביטול תזמון" className="shrink-0 text-muted-foreground hover:text-destructive">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input area */}
              <div className="px-3 py-2.5 border-t border-border shrink-0">
                {!selectedConvo?.is_accepted && selectedConvo?.created_by !== profile.id ? (
                  /* Accept / decline request */
                  <div className="flex items-center justify-center gap-3 py-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <UserPlus className="h-4 w-4" />
                      בקשת הודעה מ{selectedConvo?.otherName}
                    </p>
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs font-heading text-destructive border-destructive/30" onClick={() => declineRequest(selectedId!)}>
                      <X className="h-3.5 w-3.5" />דחה
                    </Button>
                    <Button size="sm" className="h-8 gap-1 text-xs font-heading" onClick={() => acceptRequest(selectedId!)}>
                      <Check className="h-3.5 w-3.5" />אשר
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {replyingTo && (
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs">
                        <Reply className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{replyingTo.sender_name}</p>
                          <p className="text-muted-foreground truncate">{replyingTo.content}</p>
                        </div>
                        <button type="button" onClick={() => setReplyingTo(null)} className="shrink-0 text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {pendingAttachment && (
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1.5 text-xs">
                        {attachmentIcon(pendingAttachment.type)}
                        <span className="flex-1 min-w-0 truncate">{pendingAttachment.name}</span>
                        {extractingAttachment && (
                          <span className="shrink-0 text-muted-foreground flex items-center gap-1">
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            מעבד...
                          </span>
                        )}
                        <button type="button" onClick={() => setPendingAttachment(null)} className="shrink-0 text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-end relative">
                      {mentionQuery !== null && mentionCandidates.length > 0 && (
                        <div className="absolute bottom-full mb-1 right-0 w-56 max-h-40 overflow-y-auto rounded-lg border border-border bg-popover shadow-md z-10">
                          {mentionCandidates.map((p) => (
                            <button
                              key={p.user_id}
                              type="button"
                              onClick={() => selectMention(p)}
                              className="w-full text-right px-3 py-1.5 text-xs hover:bg-muted/60"
                            >
                              @{p.full_name}
                            </button>
                          ))}
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleAttachmentSelected}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0 rounded-xl"
                        onClick={pickAttachment}
                        disabled={uploadingAttachment || Boolean(pendingAttachment)}
                        title="צירוף קובץ"
                      >
                        {uploadingAttachment
                          ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          : <Paperclip className="h-4 w-4" />}
                      </Button>
                      <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => handleComposerChange(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) { e.preventDefault(); sendMessage(); }
                        }}
                        placeholder={quietHours ? "שעות שקטות — כתוב הודעה..." : "כתוב הודעה..."}
                        disabled={sending}
                        rows={1}
                        className="flex-1 resize-none text-sm min-h-[38px] max-h-24 py-2 bg-muted/40 border-muted"
                      />
                      <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 shrink-0 rounded-xl"
                            disabled={!input.trim()}
                            title="תזמן הודעה"
                          >
                            <CalendarClock className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 space-y-2" align="end">
                          <p className="text-xs font-medium">שליחה מתוזמנת</p>
                          <Input
                            type="datetime-local"
                            value={scheduleAt}
                            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                            onChange={(e) => setScheduleAt(e.target.value)}
                            className="h-9 text-sm"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="w-full h-8 text-xs"
                            disabled={!scheduleAt || scheduling}
                            onClick={scheduleMessage}
                          >
                            {scheduling ? "מתזמן..." : "תזמן שליחה"}
                          </Button>
                          <p className="text-[10px] text-muted-foreground leading-snug">
                            ההודעה תישלח אוטומטית כשתהיה/י מחובר/ת למערכת בזמן שנבחר או אחריו.
                          </p>
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="submit"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-xl"
                        disabled={(!input.trim() && !pendingAttachment) || sending}
                      >
                        {sending
                          ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                          : <Send className="h-4 w-4" />
                        }
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* New group dialog */}
      <Dialog open={showNewGroup} onOpenChange={(o) => { setShowNewGroup(o); if (!o) resetGroupDialog(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">קבוצה חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="שם הקבוצה"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="h-9 text-sm"
            />
            {groupMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {groupMembers.map((m) => (
                  <Badge key={m.user_id} variant="secondary" className="gap-1 pl-1 text-xs">
                    {m.full_name}
                    <button
                      type="button"
                      onClick={() => setGroupMembers((prev) => prev.filter((x) => x.user_id !== m.user_id))}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="הוספת חברים..."
                className="pr-9 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchUsers.filter((u) => !groupMembers.some((m) => m.user_id === u.user_id)).length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                {searchUsers
                  .filter((u) => !groupMembers.some((m) => m.user_id === u.user_id))
                  .map((u) => (
                    <button
                      key={u.user_id}
                      type="button"
                      onClick={() => { setGroupMembers((prev) => [...prev, u]); setSearchQuery(""); }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 text-right text-sm border-t border-border/30 first:border-t-0"
                    >
                      <span>{u.full_name}</span>
                      <span className="text-[10px] text-muted-foreground">{u.roleLabel}</span>
                    </button>
                  ))}
              </div>
            )}
            <Button
              className="w-full"
              disabled={!groupName.trim() || groupMembers.length === 0 || creatingGroup}
              onClick={createGroup}
            >
              {creatingGroup ? "יוצר..." : `צור קבוצה${groupMembers.length ? ` (${groupMembers.length + 1})` : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group info / management dialog */}
      <Dialog open={showGroupInfo} onOpenChange={setShowGroupInfo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">פרטי קבוצה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={groupInfoName}
                onChange={(e) => setGroupInfoName(e.target.value)}
                className="h-9 text-sm flex-1"
              />
              <Button
                size="sm"
                className="h-9"
                disabled={!groupInfoName.trim() || groupInfoName.trim() === selectedConvo?.title}
                onClick={renameGroup}
              >
                שמור שם
              </Button>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                {selectedParticipants.length} משתתפים
              </p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border/40">
                {selectedParticipants.map((p) => (
                  <div key={p.user_id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                    <span className="truncate">{p.full_name}{p.user_id === profile.id ? " (את/ה)" : ""}</span>
                    {p.user_id !== profile.id && selectedConvo?.created_by === profile.id && (
                      <button type="button" onClick={() => removeGroupMember(p.user_id)} title="הסר/י מהקבוצה" className="shrink-0 text-muted-foreground hover:text-destructive">
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedConvo?.created_by === profile.id && (
              <div>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="הוספת חבר/ה..."
                    className="pr-9 h-9 text-sm"
                    value={groupAddQuery}
                    onChange={(e) => setGroupAddQuery(e.target.value)}
                  />
                </div>
                {groupAddResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-border mt-1.5">
                    {groupAddResults.map((u) => (
                      <button
                        key={u.user_id}
                        type="button"
                        onClick={() => addGroupMember(u.user_id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 text-right text-sm border-t border-border/30 first:border-t-0"
                      >
                        <span>{u.full_name}</span>
                        <span className="text-[10px] text-muted-foreground">{u.roleLabel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button variant="outline" className="w-full gap-1.5 text-destructive border-destructive/30" onClick={leaveGroup}>
              <LogOut className="h-3.5 w-3.5" />צא/י מהקבוצה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
