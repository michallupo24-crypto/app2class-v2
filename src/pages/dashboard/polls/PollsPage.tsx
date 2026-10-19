import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, Music, Plus, Vote, X } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSchoolGuidelines } from "@/hooks/useSchoolGuidelines";
import { GRADES } from "@/lib/constants";
import {
  AUDIENCE_LABELS, SHOW_RESULTS_LABELS, STATUS_LABELS, audienceText, formatDateTime, pollStatus, useCanManagePolls,
  type Poll,
} from "./pollUtils";

const emptyForm = () => ({
  title: "",
  description: "",
  kind: "general" as "general" | "bell_song",
  options: ["", ""],
  audience: "students",
  grades: [] as string[],
  allowSuggestions: false,
  showResults: "after_vote",
  opensAt: "",
  closesAt: "",
});

// datetime-local value -> ISO, or null when empty
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

const PollsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const canManage = useCanManagePolls(profile);
  const guidelines = useSchoolGuidelines(profile.schoolId);
  const bellVoteOff = guidelines ? !guidelines.games.enabled || !guidelines.games.bellVote : false;

  const [polls, setPolls] = useState<Poll[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile.schoolId) return setLoading(false);
    setLoading(true);
    const [pollsRes, votesRes] = await Promise.all([
      supabase.from("polls").select("*").eq("school_id", profile.schoolId).eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("poll_votes").select("poll_id").eq("voter_id", profile.id),
    ]);
    if (pollsRes.error) toast({ title: "שגיאה בטעינת ההצבעות", description: pollsRes.error.message, variant: "destructive" });
    setPolls(pollsRes.data || []);
    setMyVotes(new Set((votesRes.data || []).map((v) => v.poll_id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile.id, profile.schoolId]);

  const createPoll = async () => {
    if (!profile.schoolId) return;
    const options = form.options.map((o) => o.trim()).filter(Boolean);
    const isBell = form.kind === "bell_song";
    if (!form.title.trim()) return toast({ title: "חסרה כותרת", variant: "destructive" });
    if (!isBell && !form.allowSuggestions && options.length < 2) {
      return toast({ title: "צריך לפחות שתי אפשרויות", variant: "destructive" });
    }
    const opensAt = toIso(form.opensAt);
    const closesAt = toIso(form.closesAt);
    if (closesAt && new Date(closesAt) <= new Date(opensAt ?? Date.now())) {
      return toast({ title: "מועד הסגירה חייב להיות אחרי מועד הפתיחה", variant: "destructive" });
    }
    setSaving(true);
    const { data: poll, error } = await supabase
      .from("polls")
      .insert({
        school_id: profile.schoolId,
        created_by: profile.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        audience: form.audience,
        audience_grades: form.audience === "students" && form.grades.length ? (form.grades as Poll["audience_grades"]) : null,
        allow_suggestions: isBell || form.allowSuggestions,
        show_results: form.showResults,
        ...(opensAt ? { opens_at: opensAt } : {}),
        closes_at: closesAt,
      })
      .select()
      .single();
    if (error || !poll) {
      setSaving(false);
      return toast({ title: "שגיאה", description: error?.message, variant: "destructive" });
    }
    if (!isBell && options.length) {
      const { error: optErr } = await supabase
        .from("poll_options")
        .insert(options.map((label, i) => ({ poll_id: poll.id, label, sort_order: i })));
      if (optErr) toast({ title: "ההצבעה נוצרה, אבל האפשרויות לא נשמרו", description: optErr.message, variant: "destructive" });
    }
    setSaving(false);
    setCreateOpen(false);
    setForm(emptyForm());
    toast({ title: "ההצבעה נוצרה!" });
    load();
  };

  const visible = polls.filter((p) => canManage || !(bellVoteOff && p.kind === "bell_song"));
  const order: Record<string, number> = { open: 0, upcoming: 1, closed: 2 };
  const sorted = [...visible].sort((a, b) => order[pollStatus(a)] - order[pollStatus(b)]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Vote className="h-7 w-7 text-primary" /> הצבעות
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">משאלים והצבעות של בית הספר - הקול שלך נחשב</p>
        </div>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> הצבעה חדשה</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">הצבעה חדשה</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label>סוג</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as typeof form.kind })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">הצבעה / משאל</SelectItem>
                      <SelectItem value="bell_song">שיר לצלצול (התלמידים מציעים שירים מ-YouTube)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="poll-title">כותרת</Label>
                  <Input id="poll-title" placeholder={form.kind === "bell_song" ? "שיר הצלצול" : "על מה מצביעים?"} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="poll-desc">תיאור (לא חובה)</Label>
                  <Textarea id="poll-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                {form.kind === "general" && (
                  <div className="space-y-1.5">
                    <Label>אפשרויות</Label>
                    {form.options.map((o, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder={`אפשרות ${i + 1}`}
                          value={o}
                          onChange={(e) => setForm({ ...form, options: form.options.map((x, j) => (j === i ? e.target.value : x)) })}
                        />
                        {form.options.length > 2 && (
                          <Button size="icon" variant="ghost" aria-label="הסר אפשרות" onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setForm({ ...form, options: [...form.options, ""] })}>
                      <Plus className="h-3.5 w-3.5" /> הוספת אפשרות
                    </Button>
                    <div className="flex items-center justify-between pt-1">
                      <Label htmlFor="poll-suggest" className="font-normal">המצביעים יכולים להציע אפשרויות</Label>
                      <Switch id="poll-suggest" checked={form.allowSuggestions} onCheckedChange={(v) => setForm({ ...form, allowSuggestions: v })} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>מי מצביע?</Label>
                  <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.audience === "students" && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {GRADES.map((g) => (
                        <label key={g} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={form.grades.includes(g)}
                            onCheckedChange={(c) => setForm({ ...form, grades: c ? [...form.grades, g] : form.grades.filter((x) => x !== g) })}
                          />
                          {g}
                        </label>
                      ))}
                      <span className="text-[11px] text-muted-foreground w-full">בלי סימון - כל השכבות</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="poll-open">נפתחת (ריק = עכשיו)</Label>
                    <Input id="poll-open" type="datetime-local" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="poll-close">נסגרת (ריק = ללא הגבלה)</Label>
                    <Input id="poll-close" type="datetime-local" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>מתי רואים תוצאות?</Label>
                  <Select value={form.showResults} onValueChange={(v) => setForm({ ...form, showResults: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SHOW_RESULTS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={createPoll} disabled={saving} className="w-full">{saving ? "יוצר..." : "פרסום ההצבעה"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Vote className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-heading font-medium">אין כרגע הצבעות</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((p) => {
            const status = pollStatus(p);
            const voted = myVotes.has(p.id);
            return (
              <Link key={p.id} to={`/dashboard/polls/${p.id}`} className="block group">
                <Card className={`h-full transition-shadow group-hover:shadow-md ${status === "closed" ? "opacity-75" : ""}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={status === "open" ? "default" : "secondary"}>{STATUS_LABELS[status]}</Badge>
                      {p.kind === "bell_song" && <Badge variant="outline" className="gap-1"><Music className="h-3 w-3" /> צלצול</Badge>}
                      {voted && <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> הצבעת</span>}
                    </div>
                    <h3 className="font-heading font-bold">{p.title}</h3>
                    {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      {audienceText(p)}
                      {status === "upcoming" && ` · נפתחת ${formatDateTime(p.opens_at)}`}
                      {status !== "upcoming" && p.closes_at && ` · ${status === "closed" ? "נסגרה" : "נסגרת"} ${formatDateTime(p.closes_at)}`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default PollsPage;
