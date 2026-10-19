import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, BarChart3, Lock, Plus, Trash2, Trophy, Vote } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  STATUS_LABELS, audienceText, extractYoutubeId, formatDateTime, pollStatus, useCanManagePolls,
  type Poll, type PollOption,
} from "./pollUtils";

const PollDetailPage = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const canManage = useCanManagePolls(profile);

  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [suggesters, setSuggesters] = useState<Record<string, string>>({});
  const [audienceSize, setAudienceSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestion, setSuggestion] = useState({ label: "", url: "" });

  const load = async () => {
    if (!pollId) return;
    setLoading(true);
    const [pollRes, optRes, voteRes, resultsRes] = await Promise.all([
      supabase.from("polls").select("*").eq("id", pollId).maybeSingle(),
      supabase.from("poll_options").select("*").eq("poll_id", pollId).eq("is_active", true).order("sort_order").order("created_at"),
      supabase.from("poll_votes").select("option_id").eq("poll_id", pollId).eq("voter_id", profile.id).maybeSingle(),
      supabase.rpc("get_poll_results", { _poll_id: pollId }),
    ]);
    const p = pollRes.data;
    setPoll(p);
    const opts = optRes.data || [];
    setOptions(opts);
    setMyVote(voteRes.data?.option_id ?? null);
    // The RPC returns no rows when results are hidden from this user.
    const rows = resultsRes.data || [];
    setCounts(rows.length ? Object.fromEntries(rows.map((r) => [r.option_id, Number(r.votes)])) : null);

    const ids = Array.from(new Set(opts.map((o) => o.suggested_by).filter((x): x is string => !!x)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setSuggesters(Object.fromEntries((profs || []).map((x) => [x.id, x.full_name])));
    }

    if (canManage && p && p.audience === "students" && profile.schoolId) {
      const { data: schoolProfiles } = await supabase.from("profiles").select("id, class_id").eq("school_id", profile.schoolId);
      let profileIds = (schoolProfiles || []).map((x) => x.id);
      if (p.audience_grades?.length) {
        const { data: classes } = await supabase.from("classes").select("id").eq("school_id", profile.schoolId).in("grade", p.audience_grades);
        const classIds = new Set((classes || []).map((c) => c.id));
        profileIds = (schoolProfiles || []).filter((x) => x.class_id && classIds.has(x.class_id)).map((x) => x.id);
      }
      const { data: studentRoles } = profileIds.length
        ? await supabase.from("user_roles").select("user_id").eq("role", "student").in("user_id", profileIds)
        : { data: [] as { user_id: string }[] };
      setAudienceSize(new Set((studentRoles || []).map((r) => r.user_id)).size);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [pollId, profile.id, canManage]);

  if (loading && !poll) return <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>;
  if (!poll) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground space-y-3">
        <p className="font-heading font-medium">ההצבעה לא נמצאה או שאינה מיועדת לך</p>
        <Button variant="outline" asChild><Link to="/dashboard/polls">לכל ההצבעות</Link></Button>
      </CardContent></Card>
    );
  }

  const status = pollStatus(poll);
  const isOpen = status === "open" && poll.is_active;
  const isBell = poll.kind === "bell_song";

  const vote = async (optionId: string) => {
    const { error } = await supabase
      .from("poll_votes")
      .upsert({ poll_id: poll.id, option_id: optionId, voter_id: profile.id }, { onConflict: "poll_id,voter_id" });
    if (error) return toast({ title: "לא ניתן להצביע", description: error.message, variant: "destructive" });
    toast({ title: "ההצבעה שלך נרשמה!" });
    load();
  };

  const suggest = async () => {
    const label = suggestion.label.trim();
    if (!label) return;
    let media_url: string | null = null;
    if (isBell) {
      const videoId = extractYoutubeId(suggestion.url);
      if (!videoId) return toast({ title: "קישור לא תקין", description: "נא להדביק קישור YouTube תקין", variant: "destructive" });
      if (options.some((o) => o.media_url && extractYoutubeId(o.media_url) === videoId)) {
        return toast({ title: "השיר כבר הוצע", description: "מישהו כבר הציע את השיר הזה - אפשר להצביע לו במקום", variant: "destructive" });
      }
      media_url = suggestion.url.trim();
    } else if (options.some((o) => o.label.trim() === label)) {
      return toast({ title: "האפשרות כבר קיימת", variant: "destructive" });
    }
    const { error } = await supabase.from("poll_options").insert({
      poll_id: poll.id, label, media_url, suggested_by: profile.id, sort_order: options.length,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "ההצעה נוספה להצבעה!" });
    setSuggestOpen(false);
    setSuggestion({ label: "", url: "" });
    load();
  };

  const removeOption = async (id: string) => {
    const { error } = await supabase.from("poll_options").update({ is_active: false }).eq("id", id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    load();
  };

  const closeNow = async () => {
    const { error } = await supabase.from("polls").update({ closes_at: new Date().toISOString() }).eq("id", poll.id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "ההצבעה נסגרה" });
    load();
  };

  const deletePoll = async () => {
    if (!window.confirm("למחוק את ההצבעה? היא תוסתר מכולם.")) return;
    const { error } = await supabase.from("polls").update({ is_active: false }).eq("id", poll.id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    navigate("/dashboard/polls");
  };

  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0;
  const sorted = counts ? [...options].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)) : options;
  const leaderId = counts && total > 0 ? sorted[0]?.id : null;
  const participationPct = audienceSize > 0 ? Math.round((total / audienceSize) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Link to="/dashboard/polls" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowRight className="h-4 w-4" /> כל ההצבעות
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={isOpen ? "default" : "secondary"}>{STATUS_LABELS[status]}</Badge>
            <span className="text-xs text-muted-foreground">{audienceText(poll)}</span>
          </div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Vote className="h-7 w-7 text-primary" /> {poll.title}
          </h1>
          {poll.description && <p className="text-sm text-muted-foreground font-body">{poll.description}</p>}
          <p className="text-xs text-muted-foreground">
            {status === "upcoming" ? `נפתחת ${formatDateTime(poll.opens_at)}` : `נפתחה ${formatDateTime(poll.opens_at)}`}
            {poll.closes_at && ` · ${status === "closed" ? "נסגרה" : "נסגרת"} ${formatDateTime(poll.closes_at)}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isOpen && poll.allow_suggestions && (
            <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> {isBell ? "הצע/י שיר" : "הצע/י אפשרות"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="font-heading">{isBell ? "הצעת שיר לצלצול" : "הצעת אפשרות"}</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input placeholder={isBell ? "שם השיר" : "האפשרות שלך"} value={suggestion.label} onChange={(e) => setSuggestion({ ...suggestion, label: e.target.value })} />
                  {isBell && <Input placeholder="קישור YouTube" value={suggestion.url} onChange={(e) => setSuggestion({ ...suggestion, url: e.target.value })} />}
                  <Button onClick={suggest} className="w-full">הוסף להצבעה</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canManage && isOpen && <Button variant="outline" className="gap-2" onClick={closeNow}><Lock className="h-4 w-4" /> סגירת ההצבעה</Button>}
          {canManage && <Button variant="ghost" className="gap-2 text-destructive" onClick={deletePoll}><Trash2 className="h-4 w-4" /> מחיקה</Button>}
        </div>
      </div>

      {counts && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-heading font-bold text-sm flex items-center gap-1.5 mb-3">
              <BarChart3 className="h-4 w-4" /> תוצאות · {total} קולות
              {canManage && poll.audience === "students" && audienceSize > 0 && (
                <span className="font-normal text-muted-foreground">· השתתפות {participationPct}% ({total}/{audienceSize})</span>
              )}
            </h2>
            <div className="space-y-2">
              {sorted.map((o) => {
                const c = counts[o.id] || 0;
                const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                return (
                  <div key={o.id} className="text-sm">
                    <div className="flex items-center justify-between mb-0.5 gap-2">
                      <span className="truncate flex items-center gap-1">
                        {o.id === leaderId && <Trophy className="h-3.5 w-3.5 text-warning" />}
                        {o.label}{o.id === myVote && " ✓"}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">{c} קולות · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {!counts && poll.show_results !== "always" && options.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {poll.show_results === "after_vote" ? "התוצאות יוצגו אחרי שתצביע/י" : "התוצאות יוצגו כשההצבעה תיסגר"}
        </p>
      )}

      {options.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <p className="font-heading font-medium">{poll.allow_suggestions ? "אין עדיין הצעות - היו הראשונים להציע!" : "אין אפשרויות בהצבעה"}</p>
        </CardContent></Card>
      ) : (
        <div className={isBell ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
          {options.map((o) => {
            const videoId = o.media_url ? extractYoutubeId(o.media_url) : null;
            const isMine = myVote === o.id;
            return (
              <Card key={o.id} className={isMine ? "ring-2 ring-primary" : ""}>
                {videoId && (
                  <div className="aspect-video w-full">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={o.label}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <h3 className="font-heading font-bold text-sm mb-1">{o.label}</h3>
                  {o.suggested_by && <p className="text-[11px] text-muted-foreground mb-3">הוצע ע"י {suggesters[o.suggested_by] || "תלמיד/ה"}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <Button size="sm" variant={isMine ? "secondary" : "default"} className="gap-1.5 flex-1" onClick={() => vote(o.id)} disabled={isMine || !isOpen}>
                      <Vote className="h-3.5 w-3.5" /> {isMine ? "הצבעת ✓" : "הצבע/י"}
                    </Button>
                    {(canManage || (o.suggested_by === profile.id && isOpen)) && (
                      <Button size="icon" variant="ghost" aria-label="הסרת האפשרות" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeOption(o.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default PollDetailPage;
