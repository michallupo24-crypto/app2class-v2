import { useEffect, useState } from "react";
import { AlertTriangle, Megaphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  title: string;
  content: string;
  severity: "info" | "emergency";
  created_at: string;
}

const DISMISSED_KEY = "app2class_dismissed_announcements";

export function AnnouncementBanner({ schoolId }: { schoolId: string | null }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      let query = (supabase as any)
        .from("system_announcements")
        .select("id, title, content, severity, created_at")
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(5);

      query = schoolId ? query.or(`school_id.eq.${schoolId},school_id.is.null`) : query.is("school_id", null);

      const { data } = await query;
      const dismissed: string[] = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
      const next = (data || []).find((a: Announcement) => !dismissed.includes(a.id));
      setAnnouncement(next || null);
    };
    load();
  }, [schoolId]);

  if (!announcement) return null;

  const dismiss = () => {
    const dismissed: string[] = JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, announcement.id]));
    setAnnouncement(null);
  };

  const isEmergency = announcement.severity === "emergency";

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b ${
        isEmergency ? "bg-destructive/10 border-destructive/30" : "bg-info/10 border-info/30"
      }`}
    >
      {isEmergency ? (
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
      ) : (
        <Megaphone className="h-5 w-5 text-info shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-heading font-bold ${isEmergency ? "text-destructive" : "text-info"}`}>{announcement.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{announcement.content}</p>
      </div>
      <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
