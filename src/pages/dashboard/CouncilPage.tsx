import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Landmark, Plus, Vote, Trophy, UserPlus, ChevronLeft } from "lucide-react";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  full_name: string;
  avatar?: any;
}
interface Election {
  id: string;
  title: string;
  description: string | null;
  num_seats: number;
  status: "nominations" | "voting" | "closed";
}
interface Candidate {
  id: string;
  election_id: string;
  student_id: string;
  statement: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  nominations: { label: "פתוח למועמדות", color: "bg-info/10 text-info border-info/30" },
  voting: { label: "הצבעה פתוחה", color: "bg-warning/10 text-warning border-warning/30" },
  closed: { label: "נסגר - תוצאות", color: "bg-success/10 text-success border-success/30" },
};

const CouncilPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isManagement = profile.roles.some((r) => ["management", "system_admin"].includes(r));
  const isStudent = profile.roles.includes("student");

  const [members, setMembers] = useState<(Profile & { position: string })[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [candidatesByElection, setCandidatesByElection] = useState<Record<string, Candidate[]>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [myVotes, setMyVotes] = useState<Record<string, string>>({}); // election_id -> candidate_id
  const [voteCounts, setVoteCounts] = useState<Record<string, Record<string, number>>>({}); // election_id -> candidate_id -> count
  const [loading, setLoading] = useState(true);

  const [newElectionOpen, setNewElectionOpen] = useState(false);
  const [newElection, setNewElection] = useState({ title: "", description: "", num_seats: 1 });
  const [nominateDialog, setNominateDialog] = useState<string | null>(null);
  const [statement, setStatement] = useState("");

  const load = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [membersRes, electionsRes] = await Promise.all([
      (supabase as any).from("council_members").select("student_id, position").eq("school_id", profile.schoolId).eq("is_active", true),
      (supabase as any).from("council_elections").select("*").eq("school_id", profile.schoolId).order("created_at", { ascending: false }),
    ]);

    const electionsData: Election[] = electionsRes.data || [];
    setElections(electionsData);

    const candidatesRes = electionsData.length
      ? await (supabase as any).from("council_candidates").select("*").in("election_id", electionsData.map((e) => e.id))
      : { data: [] };
    const candidates: Candidate[] = candidatesRes.data || [];
    const grouped: Record<string, Candidate[]> = {};
    candidates.forEach((c) => {
      grouped[c.election_id] = grouped[c.election_id] || [];
      grouped[c.election_id].push(c);
    });
    setCandidatesByElection(grouped);

    const memberRows: { student_id: string; position: string }[] = membersRes.data || [];
    const allStudentIds = Array.from(
      new Set([...memberRows.map((m) => m.student_id), ...candidates.map((c) => c.student_id)])
    );

    const [profilesRes, myVotesRes] = await Promise.all([
      allStudentIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", allStudentIds)
        : Promise.resolve({ data: [] }),
      (supabase as any).from("council_votes").select("election_id, candidate_id").eq("voter_id", profile.id),
    ]);

    const profileMap: Record<string, Profile> = {};
    (profilesRes.data || []).forEach((p: any) => (profileMap[p.id] = p));
    setProfiles(profileMap);

    setMembers(memberRows.map((m) => ({ ...profileMap[m.student_id], id: m.student_id, position: m.position })));

    const votesMap: Record<string, string> = {};
    (myVotesRes.data || []).forEach((v: any) => (votesMap[v.election_id] = v.candidate_id));
    setMyVotes(votesMap);

    // Aggregate counts for closed elections only (RLS hides open-ballot votes from non-owners)
    const closedIds = electionsData.filter((e) => e.status === "closed").map((e) => e.id);
    if (closedIds.length) {
      const { data: allVotes } = await (supabase as any).from("council_votes").select("election_id, candidate_id").in("election_id", closedIds);
      const counts: Record<string, Record<string, number>> = {};
      (allVotes || []).forEach((v: any) => {
        counts[v.election_id] = counts[v.election_id] || {};
        counts[v.election_id][v.candidate_id] = (counts[v.election_id][v.candidate_id] || 0) + 1;
      });
      setVoteCounts(counts);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile.id, profile.schoolId]);

  const createElection = async () => {
    if (!newElection.title || !profile.schoolId) return;
    const { error } = await (supabase as any).from("council_elections").insert({
      school_id: profile.schoolId,
      title: newElection.title,
      description: newElection.description || null,
      num_seats: newElection.num_seats,
      created_by: profile.id,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "✅ הבחירות נפתחו למועמדות" });
    setNewElectionOpen(false);
    setNewElection({ title: "", description: "", num_seats: 1 });
    load();
  };

  const advanceStatus = async (election: Election) => {
    const next = election.status === "nominations" ? "voting" : "closed";
    const { error } = await (supabase as any).from("council_elections").update({ status: next }).eq("id", election.id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: next === "voting" ? "🗳️ ההצבעה נפתחה" : "🏆 הבחירות נסגרו" });
    load();
  };

  const nominate = async () => {
    if (!nominateDialog) return;
    const { error } = await (supabase as any).from("council_candidates").insert({
      election_id: nominateDialog,
      student_id: profile.id,
      statement: statement || null,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "✅ המועמדות שלך נרשמה!" });
    setNominateDialog(null);
    setStatement("");
    load();
  };

  const castVote = async (electionId: string, candidateId: string) => {
    const { error } = await (supabase as any).from("council_votes").insert({
      election_id: electionId,
      candidate_id: candidateId,
      voter_id: profile.id,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "🗳️ ההצבעה שלך נקלטה!" });
    load();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Landmark className="h-7 w-7 text-primary" /> מועצת תלמידים
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">הקול שלך נשמע - בחירות, מועמדות והצבעות</p>
        </div>
        {isManagement && (
          <Dialog open={newElectionOpen} onOpenChange={setNewElectionOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> בחירות חדשות
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">פתיחת בחירות למועצה</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <Input placeholder="כותרת (למשל: בחירות ליו״ר מועצה תשפ״ו)" value={newElection.title} onChange={(e) => setNewElection({ ...newElection, title: e.target.value })} />
                <Textarea placeholder="תיאור קצר" value={newElection.description} onChange={(e) => setNewElection({ ...newElection, description: e.target.value })} rows={2} />
                <div>
                  <label className="text-sm font-medium">מספר מקומות פנויים</label>
                  <Input type="number" min={1} value={newElection.num_seats} onChange={(e) => setNewElection({ ...newElection, num_seats: Number(e.target.value) })} />
                </div>
                <Button onClick={createElection} className="w-full">פתח למועמדות</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">חברי המועצה הנוכחית</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {members.map((m) => (
              <div key={m.id} className="text-center p-3 rounded-lg bg-muted/40">
                {m.avatar ? <AvatarPreview config={m.avatar} size={56} /> : <div className="h-14 w-14 rounded-full bg-muted mx-auto" />}
                <p className="text-sm font-heading font-bold mt-2">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.position}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : elections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Vote className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-heading font-medium">אין בחירות פעילות כרגע</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {elections.map((e) => {
            const candidates = candidatesByElection[e.id] || [];
            const alreadyCandidate = candidates.some((c) => c.student_id === profile.id);
            const myVote = myVotes[e.id];
            const counts = voteCounts[e.id] || {};
            const sortedByVotes = e.status === "closed" ? [...candidates].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)) : candidates;
            const statusConf = STATUS_LABELS[e.status];

            return (
              <Card key={e.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="font-heading text-lg">{e.title}</CardTitle>
                      {e.description && <p className="text-xs text-muted-foreground mt-1">{e.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusConf.color}`}>{statusConf.label}</span>
                      {isManagement && e.status !== "closed" && (
                        <Button size="sm" variant="outline" onClick={() => advanceStatus(e)} className="gap-1">
                          {e.status === "nominations" ? "פתח הצבעה" : "סגור בחירות"} <ChevronLeft className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {e.status === "nominations" && isStudent && !alreadyCandidate && (
                    <Button size="sm" variant="secondary" className="gap-2 mb-2" onClick={() => setNominateDialog(e.id)}>
                      <UserPlus className="h-3.5 w-3.5" /> אני רוצה להתמודד!
                    </Button>
                  )}
                  {candidates.length === 0 && <p className="text-xs text-muted-foreground">עדיין אין מועמדים</p>}
                  {sortedByVotes.map((c, idx) => {
                    const isWinner = e.status === "closed" && idx < e.num_seats;
                    return (
                      <div key={c.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg ${isWinner ? "bg-success/10 border border-success/30" : "bg-muted/40"}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-heading font-medium flex items-center gap-1.5">
                            {isWinner && <Trophy className="h-3.5 w-3.5 text-success" />}
                            {profiles[c.student_id]?.full_name || "מועמד/ת"}
                          </p>
                          {c.statement && <p className="text-xs text-muted-foreground">{c.statement}</p>}
                        </div>
                        {e.status === "voting" && isStudent && (
                          myVote ? (
                            myVote === c.id ? <Badge variant="secondary" className="shrink-0">הצבעת ✓</Badge> : null
                          ) : (
                            <Button size="sm" onClick={() => castVote(e.id, c.id)} className="shrink-0 gap-1">
                              <Vote className="h-3.5 w-3.5" /> הצבע/י
                            </Button>
                          )
                        )}
                        {e.status === "closed" && <Badge variant="outline" className="shrink-0">{counts[c.id] || 0} קולות</Badge>}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!nominateDialog} onOpenChange={(o) => !o && setNominateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">הצגת מועמדות</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="למה שיצביעו לך? כמה מילים על עצמך..." value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} />
          <Button onClick={nominate} className="w-full">שלח/י מועמדות</Button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default CouncilPage;
