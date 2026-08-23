import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, CheckCheck, AlertTriangle, CalendarCheck, MessageCircle, ClipboardList,
  GraduationCap, Video, Megaphone, ShieldAlert, FileWarning, Clock, UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  emergency_announcement: AlertTriangle,
  attendance_red_line: ShieldAlert,
  approval_decided: CheckCheck,
  grade_event_approved: CalendarCheck,
  grade_announcement: Megaphone,
  class_announcement: Megaphone,
  meeting_booked: CalendarCheck,
  meeting_cancelled: CalendarCheck,
  absence_justification_decided: CheckCheck,
  new_message: MessageCircle,
  assignment_published: ClipboardList,
  submission_graded: GraduationCap,
  submission_reminder: Clock,
  missing_exam_material: FileWarning,
  counselor_referral: UserCheck,
  live_lesson_started: Video,
};

const NotificationIcon = ({ type }: { type: string }) => {
  const Icon = TYPE_ICONS[type] || Bell;
  return <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />;
};

const NotificationBell = ({ userId }: { userId: string }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async () => {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setUnreadCount(count || 0);
  };

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications(data || []);
    loadUnreadCount();
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as NotificationRow, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          // Keeps the bell in sync when something read outside the bell itself
          // (e.g. opening the relevant conversation in ChatPage) marks a
          // notification read server-side.
          const updated = payload.new as NotificationRow;
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
          loadUnreadCount();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markRead = async (n: NotificationRow) => {
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      if (error) {
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: false } : x)));
        setUnreadCount((prev) => prev + 1);
        toast({ title: "שגיאה בסימון ההתראה כנקראה", variant: "destructive" });
      }
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    if (error) {
      setNotifications((prev) => prev.map((n) => (unreadIds.includes(n.id) ? { ...n, is_read: false } : n)));
      loadUnreadCount();
      toast({ title: "שגיאה בסימון ההתראות כנקראו", variant: "destructive" });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={`התראות: ${unreadCount} שלא נקראו`}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge variant="destructive" aria-hidden="true"
              className="absolute -top-0.5 -left-0.5 text-[9px] px-1 py-0 h-4 min-w-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <span className="font-heading text-sm font-semibold">התראות</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 font-body" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" />סמן הכל כנקרא
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body text-center py-8">אין התראות עדיין</p>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`w-full text-right p-3 text-sm font-body hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    <NotificationIcon type={n.type} />
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: he })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
