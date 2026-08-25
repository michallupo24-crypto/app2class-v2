import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, Crown, Vote, Plus, UserPlus, Check, X, Undo2, ChevronLeft, ClipboardList, Trash2 } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  votes_per_student: number;
  candidates_per_class: number;
  tie_break_mode: "revote_tied" | "all_advance";
  has_grade_round: boolean;
  final_round_voters: "all_students" | "council_members";
  status: "class" | "grade" | "school" | "closed";
}
interface RoundElection {
  id: string;
  campaign_id: string;
  round_scope: "class" | "grade" | "school";
  status: "nominations" | "voting" | "closed";
  title: string;
}
interface TCandidate {
  id: string;
  student_id: string;
  statement: string | null;
  status: "pending_review" | "approved" | "rejected" | "needs_revision";
  round_result: "pending" | "tied" | "advanced" | "eliminated";
  review_notes: string | null;
}
interface ClassInfo {
  id: string;
  grade: string;
  class_number: number;
}

const ROUND_LABELS: Record<string, string> = { class: "שלב כיתתי", grade: "שלב שכבתי", school: "שלב סופי (בית ספרי)", closed: "הסתיים" };
const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  advanced: { label: "עלה/תה לשלב הבא", color: "bg-success/10 text-success border-success/30" },
  tied: { label: "תיקו - ממתין להצבעה חוזרת", color: "bg-warning/10 text-warning border-warning/30" },
  eliminated: { label: "לא עבר/ה", color: "bg-muted text-muted-foreground border-border" },
};

const CouncilTournament = ({ profile }: { profile: UserProfile }) => {
  const { toast } = useToast();
  const canManage = profile.roles.some((r) => ["management", "system_admin", "council_advisor"].includes(r));
  const isStudent = profile.roles.includes("student");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [roundElection, setRoundElection] = useState<RoundElection | null>(null);
  const [candidates, setCandidates] = useState<TCandidate[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; class_id: string | null }>>({});
  const [classes, setClasses] = useState<Record<string, ClassInfo>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [myClassId, setMyClassId] = useState<string | null>(null);
  const [isHomeroomTeacher, setIsHomeroomTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    votes_per_student: 1,
    candidates_per_class: 1,
    tie_break_mode: "revote_tied" as "revote_tied" | "all_advance",
    has_grade_round: false,
    final_round_voters: "all_students" as "all_students" | "council_members",
  });

  const [nominateOpen, setNominateOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const [reviewDialog, setReviewDialog] = useState<{ id: string; action: "rejected" | "needs_revision" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const load = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: myProfile } = await supabase.from("profiles").select("class_id").eq("id", profile.id).single();
    setMyClassId(myProfile?.class_id || null);

    if (profile.roles.includes("educator")) {
      const { data: myRoles } = await supabase
        .from("user_roles")
        .select("homeroom_class_id")
        .eq("user_id", profile.id)
        .eq("role", "educator")
        .not("homeroom_class_id", "is", null)
        .limit(1);
      setIsHomeroomTeacher(!!myRoles?.[0]?.homeroom_class_id);
    }

    const { data: campaignsData } = await (supabase as any)
      .from("council_campaigns")
      .select("*")
      .eq("school_id", profile.schoolId)
      .order("created_at", { ascending: false });
    const campaignList: Campaign[] = campaignsData || [];
    setCampaigns(campaignList);
    const active = campaignList.find((c) => c.status !== "closed") || campaignList[0] || null;
    setActiveCampaign(active);

    if (!active) {
      setRoundElection(null);
      setCandidates([]);
      setLoading(false);
      return;
    }

    const { data: electionsData } = await (supabase as any)
      .from("council_elections")
      .select("id, campaign_id, round_scope, status, title")
      .eq("campaign_id", active.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const round: RoundElection | null = electionsData?.[0] || null;
    setRoundElection(round);
    if (!round) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    const { data: candidatesData } = await (supabase as any).from("council_candidates").select("*").eq("election_id", round.id);
    const cands: TCandidate[] = candidatesData || [];
    setCandidates(cands);

    const studentIds = cands.map((c) => c.student_id);
    const { data: profilesData } = studentIds.length
      ? await supabase.from("profiles").select("id, full_name, class_id").in("id", studentIds)
      : { data: [] };
    const pMap: Record<string, { full_name: string; class_id: string | null }> = {};
    (profilesData || []).forEach((p: any) => (pMap[p.id] = p));
    setProfiles(pMap);

    const classIds = Array.from(new Set((profilesData || []).map((p: any) => p.class_id).filter(Boolean)));
    const { data: classesData } = classIds.length ? await supabase.from("classes").select("id, grade, class_number").in("id", classIds) : { data: [] };
    const cMap: Record<string, ClassInfo> = {};
    (classesData || []).forEach((c: any) => (cMap[c.id] = c));
    setClasses(cMap);

    const { data: myVotesData } = await (supabase as any).from("council_votes").select("candidate_id").eq("election_id", round.id).eq("voter_id", profile.id);
    setMyVotes(new Set((myVotesData || []).map((v: any) => v.candidate_id)));

    if (canManage || round.status === "closed") {
      const { data: allVotes } = await (supabase as any).from("council_votes").select("candidate_id").eq("election_id", round.id);
      const counts: Record<string, number> = {};
      (allVotes || []).forEach((v: any) => {
        counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1;
      });
      setVoteCounts(counts);
    } else {
      setVoteCounts({});
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile.id, profile.schoolId]);

  const createCampaign = async () => {
    if (!form.title || !profile.schoolId) return;
    const { data: campaign, error } = await (supabase as any)
      .from("council_campaigns")
      .insert({
        school_id: profile.schoolId,
        title: form.title,
        description: form.description || null,
        votes_per_student: form.votes_per_student,
        candidates_per_class: form.candidates_per_class,
        tie_break_mode: form.tie_break_mode,
        has_grade_round: form.has_grade_round,
        final_round_voters: form.final_round_voters,
        created_by: profile.id,
      })
      .select()
      .single();
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });

    const { error: electionError } = await (supabase as any).from("council_elections").insert({
      school_id: profile.schoolId,
      title: `${form.title} - שלב כיתתי`,
      description: form.description || null,
      status: "nominations",
      created_by: profile.id,
      campaign_id: campaign.id,
      round_scope: "class",
    });
    if (electionError) return toast({ title: "שגיאה", description: electionError.message, variant: "destructive" });

    toast({ title: "✅ הטורניר נפתח למועמדויות כיתתיות" });
    setCreateOpen(false);
    setForm({ title: "", description: "", votes_per_student: 1, candidates_per_class: 1, tie_break_mode: "revote_tied", has_grade_round: false, final_round_voters: "all_students" });
    load();
  };

  const openVoting = async () => {
    if (!roundElection) return;
    const { error } = await (supabase as any).from("council_elections").update({ status: "voting" }).eq("id", roundElection.id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "🗳️ ההצבעה לשלב זה נפתחה" });
    load();
  };

  const nominate = async () => {
    if (!roundElection) return;
    const { error } = await (supabase as any).from("council_candidates").insert({ election_id: roundElection.id, student_id: profile.id, statement: statement || null });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "✅ המועמדות שלך נשלחה לאישור המחנך/ת" });
    setNominateOpen(false);
    setStatement("");
    load();
  };

  const castVote = async (candidateId: string) => {
    if (!roundElection) return;
    const { error } = await (supabase as any).from("council_votes").insert({ election_id: roundElection.id, candidate_id: candidateId, voter_id: profile.id });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "🗳️ ההצבעה נקלטה" });
    load();
  };

  const reviewCandidate = async (candidateId: string, status: "approved" | "rejected" | "needs_revision", notes?: string) => {
    const { error } = await (supabase as any)
      .from("council_candidates")
      .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString(), review_notes: notes || null })
      .eq("id", candidateId);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: status === "approved" ? "✅ המועמדות אושרה" : status === "rejected" ? "המועמדות נדחתה" : "המועמדות הוחזרה לעריכה" });
    setReviewDialog(null);
    setReviewNote("");
    load();
  };

  const deleteCandidate = async (candidateId: string) => {
    const { error } = await (supabase as any).from("council_candidates").delete().eq("id", candidateId);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "המועמדות הוסרה" });
    load();
  };

  const advanceRound = async () => {
    if (!activeCampaign) return;
    setAdvancing(true);
    const { data, error } = await (supabase as any).rpc("advance_council_round", { p_campaign_id: activeCampaign.id });
    setAdvancing(false);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    if (data?.error === "campaign_closed") {
      toast({ title: "הטורניר כבר הסתיים" });
    } else if (data?.round_closed) {
      toast({ title: `✅ השלב הסתיים`, description: `${data.advanced_count} מתמודדים עלו לשלב הבא` });
    } else if (data?.tied_count) {
      toast({ title: "יש תיקו", description: `${data.tied_count} מועמדים בתיקו - ממתין להצבעה חוזרת`, variant: "destructive" });
    }
    load();
  };

  if (!activeCampaign) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Trophy className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-muted-foreground font-heading font-medium">אין טורניר בחירות פעיל כרגע</p>
          {!canManage && <p className="text-xs text-muted-foreground -mt-2">כשהאחראית על המועצה תפתח טורניר בחירות, אפשרות ההגשה תופיע כאן</p>}
          {canManage && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> פתח טורניר בחירות חדש
                </Button>
              </DialogTrigger>
              <CampaignForm form={form} setForm={setForm} onSubmit={createCampaign} />
            </Dialog>
          )}
        </CardContent>
      </Card>
    );
  }

  const myGroupKey =
    roundElection?.round_scope === "class" ? myClassId : roundElection?.round_scope === "grade" ? (myClassId ? classes[myClassId]?.grade : null) : "school";

  const groupKeyFor = (c: TCandidate): string => {
    const classId = profiles[c.student_id]?.class_id || null;
    if (!roundElection) return "";
    if (roundElection.round_scope === "class") return classId || "unknown";
    if (roundElection.round_scope === "grade") return classId ? classes[classId]?.grade || "unknown" : "unknown";
    return "school";
  };
  const groupLabelFor = (key: string): string => {
    if (!roundElection) return "";
    if (roundElection.round_scope === "class") {
      const c = classes[key];
      return c ? `כיתה ${c.grade}${c.class_number}` : key;
    }
    if (roundElection.round_scope === "grade") return `שכבה ${key}`;
    return "כלל בית הספר";
  };

  const visibleGroups = canManage ? Array.from(new Set(candidates.map(groupKeyFor))) : myGroupKey ? [myGroupKey] : [];
  const myCandidacy = candidates.find((c) => c.student_id === profile.id);
  const pendingReview = candidates.filter((c) => c.status === "pending_review" && (canManage || groupKeyFor(c) === myGroupKey));
  const canReview = isHomeroomTeacher || canManage;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5" /> {activeCampaign.title}
              </CardTitle>
              {activeCampaign.description && <p className="text-xs text-muted-foreground mt-1">{activeCampaign.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{ROUND_LABELS[activeCampaign.status]}</Badge>
              {roundElection && <Badge variant="secondary">{roundElection.status === "nominations" ? "פתוח למועמדות" : roundElection.status === "voting" ? "הצבעה פתוחה" : "נסגר"}</Badge>}
            </div>
          </div>
        </CardHeader>
        {canManage && roundElection && (
          <CardContent className="flex flex-wrap gap-2">
            {roundElection.status === "nominations" && (
              <Button size="sm" variant="outline" className="gap-1" onClick={openVoting}>
                פתח הצבעה <ChevronLeft className="h-3 w-3" />
              </Button>
            )}
            {roundElection.status === "voting" && (
              <Button size="sm" onClick={advanceRound} disabled={advancing} className="gap-1">
                <Trophy className="h-3.5 w-3.5" /> חשב תוצאות וקדם לשלב הבא
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {roundElection?.status === "nominations" && isStudent && !myCandidacy && (
        <Button size="sm" variant="secondary" className="gap-2" onClick={() => setNominateOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" /> אני רוצה להתמודד!
        </Button>
      )}
      {myCandidacy && myCandidacy.status !== "approved" && roundElection?.status !== "closed" && (
        <Card>
          <CardContent className="py-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium">המועמדות שלך: {myCandidacy.status === "pending_review" ? "ממתינה לאישור מחנך/ת" : myCandidacy.status === "rejected" ? "נדחתה" : "הוחזרה לעריכה"}</span>
            {myCandidacy.review_notes && <span className="text-xs text-muted-foreground">הערה: {myCandidacy.review_notes}</span>}
          </CardContent>
        </Card>
      )}

      {canReview && pendingReview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> מועמדויות לבדיקה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingReview.map((c) => (
              <div key={c.id} className="p-3 rounded-lg bg-muted/40 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-heading font-bold">{profiles[c.student_id]?.full_name || "מועמד/ת"}</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" className="gap-1" onClick={() => reviewCandidate(c.id, "approved")}>
                      <Check className="h-3.5 w-3.5" /> אשר
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setReviewDialog({ id: c.id, action: "needs_revision" })}>
                      <Undo2 className="h-3.5 w-3.5" /> החזר לעריכה
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1" onClick={() => setReviewDialog({ id: c.id, action: "rejected" })}>
                      <X className="h-3.5 w-3.5" /> דחה
                    </Button>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteCandidate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {c.statement && <p className="text-xs text-muted-foreground">{c.statement}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse">טוען...</div>
      ) : (
        roundElection &&
        roundElection.status !== "nominations" &&
        visibleGroups.map((groupKey) => {
          const groupCandidates = candidates.filter((c) => c.status === "approved" && groupKeyFor(c) === groupKey);
          const votesUsed = myVotes.size;
          return (
            <Card key={groupKey}>
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base">{groupLabelFor(groupKey)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {groupCandidates.length === 0 && <p className="text-xs text-muted-foreground">אין מועמדים מאושרים</p>}
                {groupCandidates.map((c) => {
                  const resultInfo = RESULT_LABELS[c.round_result];
                  const votable = roundElection.status === "voting" && c.round_result !== "advanced" && c.round_result !== "eliminated" && isStudent && !myVotes.has(c.id) && votesUsed < activeCampaign.votes_per_student;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/40">
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-medium flex items-center gap-1.5">
                          {c.round_result === "advanced" && roundElection.status === "closed" && <Trophy className="h-3.5 w-3.5 text-success" />}
                          {profiles[c.student_id]?.full_name || "מועמד/ת"}
                        </p>
                        {c.statement && <p className="text-xs text-muted-foreground">{c.statement}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {resultInfo && roundElection.status !== "voting" && (
                          <Badge variant="outline" className={`text-[10px] ${resultInfo.color}`}>
                            {resultInfo.label}
                          </Badge>
                        )}
                        {c.round_result === "tied" && roundElection.status === "voting" && (
                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                            תיקו
                          </Badge>
                        )}
                        {votable && (
                          <Button size="sm" onClick={() => castVote(c.id)} className="gap-1">
                            <Vote className="h-3.5 w-3.5" /> הצבע/י
                          </Button>
                        )}
                        {myVotes.has(c.id) && roundElection.status === "voting" && <Badge variant="secondary">הצבעת ✓</Badge>}
                        {(canManage || roundElection.status === "closed") && <Badge variant="outline">{voteCounts[c.id] || 0} קולות</Badge>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}

      {activeCampaign.status === "closed" && (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <Crown className="h-10 w-10 mx-auto text-warning" />
            <p className="font-heading font-bold">הטורניר הסתיים</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={nominateOpen} onOpenChange={setNominateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">הצגת מועמדות</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">המועמדות תישלח לאישור המחנך/ת שלך</p>
          <Textarea placeholder="למה שיצביעו לך? כמה מילים על עצמך..." value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} />
          <Button onClick={nominate} className="w-full">
            שלח/י מועמדות
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!reviewDialog}
        onOpenChange={(o) => {
          if (!o) {
            setReviewDialog(null);
            setReviewNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{reviewDialog?.action === "rejected" ? "דחיית מועמדות" : "החזרת מועמדות לעריכה"}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="הערה לתלמיד/ה (חובה)..." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} />
          <Button
            onClick={() => reviewDialog && reviewCandidate(reviewDialog.id, reviewDialog.action, reviewNote)}
            disabled={!reviewNote.trim()}
            className="w-full"
            variant={reviewDialog?.action === "rejected" ? "destructive" : "default"}
          >
            {reviewDialog?.action === "rejected" ? "דחה מועמדות" : "החזר לעריכה"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CampaignForm = ({
  form,
  setForm,
  onSubmit,
}: {
  form: {
    title: string;
    description: string;
    votes_per_student: number;
    candidates_per_class: number;
    tie_break_mode: "revote_tied" | "all_advance";
    has_grade_round: boolean;
    final_round_voters: "all_students" | "council_members";
  };
  setForm: (f: any) => void;
  onSubmit: () => void;
}) => (
  <DialogContent>
    <DialogHeader>
      <DialogTitle className="font-heading">פתיחת טורניר בחירות</DialogTitle>
    </DialogHeader>
    <div className="space-y-3 mt-2">
      <Input placeholder="כותרת (למשל: בחירות למועצת תלמידים תשפ״ו)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <Textarea placeholder="תיאור קצר" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">מספר הצבעות לכל תלמיד/ה</Label>
          <Input type="number" min={1} value={form.votes_per_student} onChange={(e) => setForm({ ...form, votes_per_student: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">מספר מועמדים עולים מכל כיתה</Label>
          <Input type="number" min={1} value={form.candidates_per_class} onChange={(e) => setForm({ ...form, candidates_per_class: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">מה קורה במקרה של תיקו?</Label>
        <Select value={form.tie_break_mode} onValueChange={(v: any) => setForm({ ...form, tie_break_mode: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="revote_tied">הצבעה חוזרת רק בין המתמודדים בתיקו</SelectItem>
            <SelectItem value="all_advance">כולם עולים לשלב הבא</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-sm">יש שלב שכבתי (ראש/ת מועצה שכבתי) לפני השלב הסופי</Label>
        <Switch checked={form.has_grade_round} onCheckedChange={(v) => setForm({ ...form, has_grade_round: v })} />
      </div>
      <div>
        <Label className="text-xs">מי מצביע בשלב הסופי (ראש/ת המועצה)?</Label>
        <Select value={form.final_round_voters} onValueChange={(v: any) => setForm({ ...form, final_round_voters: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_students">כלל תלמידי בית הספר</SelectItem>
            <SelectItem value="council_members">רק חברי המועצה הנבחרים</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onSubmit} className="w-full">
        פתח למועמדויות כיתתיות
      </Button>
    </div>
  </DialogContent>
);

export default CouncilTournament;
