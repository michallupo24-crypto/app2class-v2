import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Music, Plus, Trophy, Trash2, Vote } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCouncilRole } from "@/hooks/useCouncilRole";

interface Suggestion {
  id: string;
  suggested_by: string;
  title: string;
  youtube_url: string;
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const BellVotePage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isManagement = profile.roles.some((r) => ["management", "system_admin"].includes(r));
  const isCouncilAdvisor = profile.roles.includes("council_advisor");
  const { isCouncilHead } = useCouncilRole(profile.id);
  const canModerate = isManagement || isCouncilAdvisor || isCouncilHead;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesters, setSuggesters] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", youtube_url: "" });

  const load = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [suggRes, votesRes, myVoteRes] = await Promise.all([
      (supabase as any).from("bell_song_suggestions").select("*").eq("school_id", profile.schoolId).eq("is_active", true).order("created_at", { ascending: false }),
      (supabase as any).from("bell_song_votes").select("suggestion_id"),
      (supabase as any).from("bell_song_votes").select("suggestion_id").eq("voter_id", profile.id).maybeSingle(),
    ]);

    const list: Suggestion[] = suggRes.data || [];
    setSuggestions(list);
    setMyVote(myVoteRes.data?.suggestion_id || null);

    const countMap: Record<string, number> = {};
    (votesRes.data || []).forEach((v: any) => {
      countMap[v.suggestion_id] = (countMap[v.suggestion_id] || 0) + 1;
    });
    setCounts(countMap);

    const ids = Array.from(new Set(list.map((s) => s.suggested_by)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => (map[p.id] = p.full_name));
      setSuggesters(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile.id, profile.schoolId]);

  const addSuggestion = async () => {
    if (!form.title || !form.youtube_url || !profile.schoolId) return;
    const videoId = extractYoutubeId(form.youtube_url);
    if (!videoId) {
      toast({ title: "קישור לא תקין", description: "נא להדביק קישור YouTube תקין", variant: "destructive" });
      return;
    }
    const duplicate = suggestions.some((s) => extractYoutubeId(s.youtube_url) === videoId);
    if (duplicate) {
      toast({ title: "השיר כבר הוצע", description: "מישהו כבר הציע את השיר הזה - אפשר להצביע לו במקום", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("bell_song_suggestions").insert({
      school_id: profile.schoolId,
      suggested_by: profile.id,
      title: form.title,
      youtube_url: form.youtube_url,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "השיר נוסף להצבעה!" });
    setAddOpen(false);
    setForm({ title: "", youtube_url: "" });
    load();
  };

  const vote = async (suggestionId: string) => {
    const { error } = await (supabase as any)
      .from("bell_song_votes")
      .upsert({ voter_id: profile.id, suggestion_id: suggestionId }, { onConflict: "voter_id" });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "ההצבעה שלך נרשמה!" });
    load();
  };

  const removeSuggestion = async (id: string) => {
    const { error } = await (supabase as any).from("bell_song_suggestions").update({ is_active: false }).eq("id", id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    load();
  };

  const sorted = [...suggestions].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  const leaderId = sorted[0]?.id;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Music className="h-7 w-7 text-primary" /> הצבעה לצלצול
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">הציעו שיר לצלצול בית הספר והצביעו למועדף עליכם</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> הצע/י שיר</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">הצעת שיר לצלצול</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="שם השיר" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="קישור YouTube" value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} />
              <Button onClick={addSuggestion} className="w-full">הוסף להצבעה</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : suggestions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Music className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-heading font-medium">אין עדיין הצעות לצלצול</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((s) => {
            const videoId = extractYoutubeId(s.youtube_url);
            const isLeader = s.id === leaderId && (counts[s.id] || 0) > 0;
            const isMyVote = myVote === s.id;
            return (
              <Card key={s.id} className={isLeader ? "ring-2 ring-warning" : ""}>
                {videoId && (
                  <div className="aspect-video w-full">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={s.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    {isLeader && <Trophy className="h-3.5 w-3.5 text-warning" />}
                    <h3 className="font-heading font-bold text-sm truncate">{s.title}</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">הוצע ע"י {suggesters[s.suggested_by] || "תלמיד/ה"}</p>
                  <div className="flex items-center justify-between gap-2">
                    <Button size="sm" variant={isMyVote ? "secondary" : "default"} className="gap-1.5 flex-1" onClick={() => vote(s.id)} disabled={isMyVote}>
                      <Vote className="h-3.5 w-3.5" /> {isMyVote ? "הצבעת ✓" : "הצבע/י"}
                    </Button>
                    <span className="text-xs font-heading font-bold text-muted-foreground shrink-0">{counts[s.id] || 0} קולות</span>
                    {(canModerate || s.suggested_by === profile.id) && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeSuggestion(s.id)}>
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

export default BellVotePage;
