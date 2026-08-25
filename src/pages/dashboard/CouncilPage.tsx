import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Landmark, Plus, Vote, Trophy, UserPlus, ChevronLeft, Trash2, Search, Crown, Newspaper as NewspaperIcon, X, Check, Undo2, ClipboardList, Pencil, Megaphone } from "lucide-react";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CouncilTournament from "@/components/council/CouncilTournament";

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
  status: "pending_review" | "approved" | "rejected" | "needs_revision";
  review_notes: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  nominations: { label: "פתוח למועמדות", color: "bg-info/10 text-info border-info/30" },
  voting: { label: "הצבעה פתוחה", color: "bg-warning/10 text-warning border-warning/30" },
  closed: { label: "נסגר - תוצאות", color: "bg-success/10 text-success border-success/30" },
};

const LEADERSHIP_LABELS: Record<string, string> = {
  head: "ראש/ת מועצה",
  newspaper_editor: "עורכ/ת עיתון",
};

const CANDIDACY_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_review: { label: "ממתין/ה לאישור מחנך/ת", color: "bg-info/10 text-info border-info/30" },
  approved: { label: "אושרה", color: "bg-success/10 text-success border-success/30" },
  rejected: { label: "נדחתה", color: "bg-destructive/10 text-destructive border-destructive/30" },
  needs_revision: { label: "הוחזרה לעריכה", color: "bg-warning/10 text-warning border-warning/30" },
};

const CouncilPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isManagement = profile.roles.some((r) => ["management", "system_admin"].includes(r));
  const isCouncilAdvisor = profile.roles.includes("council_advisor");
  const canManageCouncil = isManagement || isCouncilAdvisor;
  const isStudent = profile.roles.includes("student");

  const [members, setMembers] = useState<(Profile & { position: string; roleType: string; councilRowId: string })[]>([]);
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

  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<Profile[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [appointing, setAppointing] = useState<string | null>(null);

  const [isHomeroomTeacher, setIsHomeroomTeacher] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{ id: string; action: "rejected" | "needs_revision" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [editDialog, setEditDialog] = useState<Candidate | null>(null);
  const [editStatement, setEditStatement] = useState("");

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const load = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);

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

    const [membersRes, electionsRes] = await Promise.all([
      (supabase as any).from("council_members").select("id, student_id, position, role_type").eq("school_id", profile.schoolId).eq("is_active", true),
      (supabase as any).from("council_elections").select("*").eq("school_id", profile.schoolId).is("campaign_id", null).order("created_at", { ascending: false }),
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

    const memberRows: { id: string; student_id: string; position: string; role_type: string }[] = membersRes.data || [];
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

    setMembers(
      memberRows.map((m) => ({ ...profileMap[m.student_id], id: m.student_id, position: m.position, roleType: m.role_type, councilRowId: m.id }))
    );

    const votesMap: Record<string, string> = {};
    (myVotesRes.data || []).forEach((v: any) => (votesMap[v.election_id] = v.candidate_id));
    setMyVotes(votesMap);

    // Management/advisor can see live vote counts on any election (RLS backs this);
    // everyone else only sees aggregate counts once an election is closed.
    const canSeeLiveVotes = isManagement || isCouncilAdvisor;
    const relevantIds = canSeeLiveVotes
      ? electionsData.map((e) => e.id)
      : electionsData.filter((e) => e.status === "closed").map((e) => e.id);
    if (relevantIds.length) {
      const { data: allVotes } = await (supabase as any).from("council_votes").select("election_id, candidate_id").in("election_id", relevantIds);
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
    const stillPending =
      next === "voting"
        ? (candidatesByElection[election.id] || []).filter((c) => c.status === "pending_review" || c.status === "needs_revision").length
        : 0;
    const { error } = await (supabase as any).from("council_elections").update({ status: next }).eq("id", election.id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: next === "voting" ? "🗳️ ההצבעה נפתחה" : "🏆 הבחירות נסגרו" });
    if (stillPending > 0) {
      toast({ title: `לתשומת לבך`, description: `${stillPending} מועמדויות עדיין ממתינות לאישור ולא ישתתפו בהצבעה`, variant: "destructive" });
    }
    load();
  };

  const deleteElection = async (electionId: string) => {
    const { error } = await (supabase as any).from("council_elections").delete().eq("id", electionId);
    if (error) return toast({ title: "שגיאה במחיקה", description: error.message, variant: "destructive" });
    toast({ title: "סבב הבחירות נמחק" });
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
    toast({ title: "✅ המועמדות שלך נשלחה לאישור המחנך/ת" });
    setNominateDialog(null);
    setStatement("");
    load();
  };

  const reviewCandidate = async (candidateId: string, status: "approved" | "rejected" | "needs_revision", notes?: string) => {
    const { error } = await (supabase as any)
      .from("council_candidates")
      .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString(), review_notes: notes || null })
      .eq("id", candidateId);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({
      title:
        status === "approved" ? "✅ המועמדות אושרה" : status === "rejected" ? "המועמדות נדחתה" : "המועמדות הוחזרה לעריכה",
    });
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

  const resubmitCandidacy = async () => {
    if (!editDialog) return;
    const { error } = await (supabase as any)
      .from("council_candidates")
      .update({ statement: editStatement || null, status: "pending_review" })
      .eq("id", editDialog.id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "✅ המועמדות נשלחה מחדש לאישור" });
    setEditDialog(null);
    setEditStatement("");
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

  const searchStudents = async () => {
    if (!studentQuery.trim() || !profile.schoolId) return;
    setSearchingStudents(true);
    const { data: matchingProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("school_id", profile.schoolId)
      .ilike("full_name", `%${studentQuery.trim()}%`)
      .limit(20);
    const ids = (matchingProfiles || []).map((p) => p.id);
    const { data: studentRoleRows } = ids.length
      ? await supabase.from("user_roles").select("user_id").eq("role", "student").in("user_id", ids)
      : { data: [] };
    const studentIds = new Set((studentRoleRows || []).map((r) => r.user_id));
    setStudentResults((matchingProfiles || []).filter((p) => studentIds.has(p.id)));
    setSearchingStudents(false);
  };

  const appointRole = async (studentId: string, roleType: "head" | "newspaper_editor") => {
    if (!profile.schoolId) return;
    setAppointing(studentId + roleType);
    try {
      if (roleType === "head") {
        const currentHead = members.find((m) => m.roleType === "head" && m.id !== studentId);
        if (currentHead) {
          const { error } = await (supabase as any).from("council_members").update({ is_active: false }).eq("id", currentHead.councilRowId);
          if (error) throw error;
        }
      }
      const existing = members.find((m) => m.id === studentId);
      if (existing) {
        const { error } = await (supabase as any)
          .from("council_members")
          .update({ role_type: roleType, is_active: true, appointed_by: profile.id, position: LEADERSHIP_LABELS[roleType] })
          .eq("id", existing.councilRowId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("council_members").insert({
          school_id: profile.schoolId,
          student_id: studentId,
          role_type: roleType,
          appointed_by: profile.id,
          appointment_type: "appointed",
          position: LEADERSHIP_LABELS[roleType],
        });
        if (error) throw error;
      }
      toast({ title: "✅ המינוי בוצע" });
      setStudentResults([]);
      setStudentQuery("");
      load();
    } catch (error: any) {
      const msg = error?.code === "23505" ? "כבר יש ראש/ת מועצה פעיל/ה - יש לבטל את המינוי הקיים קודם" : error.message;
      toast({ title: "שגיאה", description: msg, variant: "destructive" });
    } finally {
      setAppointing(null);
    }
  };

  const revokeRole = async (councilRowId: string) => {
    const { error } = await (supabase as any).from("council_members").update({ is_active: false }).eq("id", councilRowId);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "המינוי בוטל" });
    load();
  };

  const sendBroadcast = async () => {
    if (!broadcastText.trim() || !profile.schoolId) return;
    setSendingBroadcast(true);
    const { error } = await (supabase as any).from("system_announcements").insert({
      school_id: profile.schoolId,
      title: "הודעה ממועצת התלמידים",
      content: broadcastText.trim(),
      severity: "info",
      created_by: profile.id,
    });
    setSendingBroadcast(false);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "📢 ההודעה שודרה לכל בית הספר" });
    setBroadcastOpen(false);
    setBroadcastText("");
  };

  const councilHead = members.find((m) => m.roleType === "head");
  const newspaperEditors = members.filter((m) => m.roleType === "newspaper_editor");
  const isMeTheHead = councilHead?.id === profile.id;

  const canReviewCandidacies = isHomeroomTeacher || canManageCouncil;
  const pendingReview: (Candidate & { election_title: string })[] = canReviewCandidacies
    ? Object.entries(candidatesByElection).flatMap(([electionId, list]) => {
        const election = elections.find((e) => e.id === electionId);
        return list
          .filter((c) => c.status === "pending_review")
          .map((c) => ({ ...c, election_title: election?.title || "" }));
      })
    : [];

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

      {isMeTheHead && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-warning" /> את/ה ראש/ת המועצה
            </CardTitle>
            <p className="text-xs text-muted-foreground">בתור ראש/ת המועצה את/ה יכול/ה לשדר הודעה לכל בית הספר</p>
          </CardHeader>
          <CardContent>
            <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Megaphone className="h-4 w-4" /> שידור הודעה לבית הספר
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading">שידור הודעה מהמועצה</DialogTitle>
                </DialogHeader>
                <Textarea placeholder="תוכן ההודעה..." value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} rows={4} />
                <Button onClick={sendBroadcast} disabled={sendingBroadcast || !broadcastText.trim()} className="w-full gap-2">
                  <Megaphone className="h-4 w-4" /> שדר לכל בית הספר
                </Button>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="regular">
        <TabsList>
          <TabsTrigger value="regular">בחירות רגילות</TabsTrigger>
          <TabsTrigger value="tournament">טורניר בחירות</TabsTrigger>
        </TabsList>
        <TabsContent value="tournament" className="pt-4">
          <CouncilTournament profile={profile} />
        </TabsContent>
        <TabsContent value="regular" className="space-y-6 pt-4">

      {canManageCouncil && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">מינויים</CardTitle>
            <p className="text-xs text-muted-foreground">מינוי ראש/ת מועצה ועורכ/ת עיתון מתוך תלמידי בית הספר</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs font-heading font-bold flex items-center gap-1.5 mb-1.5"><Crown className="h-3.5 w-3.5" /> ראש/ת מועצה</p>
                {councilHead ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{councilHead.full_name}</span>
                    <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive gap-1" onClick={() => revokeRole(councilHead.councilRowId)}>
                      <X className="h-3.5 w-3.5" /> בטל
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">אין ראש/ת מועצה ממונ/ה</p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs font-heading font-bold flex items-center gap-1.5 mb-1.5"><NewspaperIcon className="h-3.5 w-3.5" /> עורכ/ת עיתון</p>
                {newspaperEditors.length === 0 && <p className="text-xs text-muted-foreground">אין עורכ/ת עיתון ממונ/ה</p>}
                {newspaperEditors.map((ed) => (
                  <div key={ed.councilRowId} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{ed.full_name}</span>
                    <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive gap-1" onClick={() => revokeRole(ed.councilRowId)}>
                      <X className="h-3.5 w-3.5" /> בטל
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="חיפוש תלמיד/ה לפי שם..."
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchStudents()}
              />
              <Button variant="outline" onClick={searchStudents} disabled={searchingStudents} className="gap-1 shrink-0">
                <Search className="h-3.5 w-3.5" /> חפש
              </Button>
            </div>
            {studentResults.length > 0 && (
              <div className="space-y-1.5">
                {studentResults.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                    <span className="text-sm">{s.full_name}</span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" disabled={appointing === s.id + "head"} onClick={() => appointRole(s.id, "head")}>
                        מנה כראש/ת מועצה
                      </Button>
                      <Button size="sm" variant="secondary" disabled={appointing === s.id + "newspaper_editor"} onClick={() => appointRole(s.id, "newspaper_editor")}>
                        מנה כעורכ/ת עיתון
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canReviewCandidacies && pendingReview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" /> מועמדויות לבדיקה
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {canManageCouncil ? "כל המועמדויות הממתינות בבית הספר" : "מועמדויות התלמידים שבחינוכך"}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingReview.map((c) => (
              <div key={c.id} className="p-3 rounded-lg bg-muted/40 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-heading font-bold">{profiles[c.student_id]?.full_name || "מועמד/ת"}</p>
                    <p className="text-xs text-muted-foreground">{c.election_title}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" className="gap-1" onClick={() => reviewCandidate(c.id, "approved")}>
                      <Check className="h-3.5 w-3.5" /> אשר
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setReviewDialog({ id: c.id, action: "needs_revision" })}>
                      <Undo2 className="h-3.5 w-3.5" /> החזר לעריכה
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive gap-1"
                      onClick={() => setReviewDialog({ id: c.id, action: "rejected" })}
                    >
                      <X className="h-3.5 w-3.5" /> דחה
                    </Button>
                    {canManageCouncil && (
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

      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">חברי המועצה הנוכחית</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {members.map((m) => (
              <div key={m.id} className="text-center p-3 rounded-lg bg-muted/40">
                {m.avatar ? <AvatarPreview config={m.avatar} size={56} /> : <div className="h-14 w-14 rounded-full bg-muted mx-auto" />}
                <p className="text-sm font-heading font-bold mt-2 flex items-center justify-center gap-1">
                  {m.roleType === "head" && <Crown className="h-3.5 w-3.5 text-warning" />}
                  {m.full_name}
                </p>
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
            <p className="font-heading font-medium">אין בחירות פתוחות למועמדות כרגע</p>
            {!canManageCouncil && <p className="text-xs mt-1">כשהאחראית על המועצה תפתח בחירות חדשות, אפשרות ההגשה תופיע כאן</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {elections.map((e) => {
            const allCandidates = candidatesByElection[e.id] || [];
            const candidates = allCandidates.filter((c) => c.status === "approved");
            const myCandidacy = allCandidates.find((c) => c.student_id === profile.id);
            const alreadyCandidate = !!myCandidacy;
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
                      {isManagement && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1">
                              <Trash2 className="h-3.5 w-3.5" /> מחק
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>מחיקת סבב הבחירות "{e.title}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                הפעולה תמחק לצמיתות את כל המועמדים וההצבעות של הבחירות הללו. לא ניתן לבטל פעולה זו.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteElection(e.id)}>
                                מחק לצמיתות
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
                  {myCandidacy && myCandidacy.status !== "approved" && (
                    <div className="p-2.5 rounded-lg border border-dashed mb-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">המועמדות שלך</span>
                        <Badge variant="outline" className={`text-[10px] ${CANDIDACY_STATUS_LABELS[myCandidacy.status].color}`}>
                          {CANDIDACY_STATUS_LABELS[myCandidacy.status].label}
                        </Badge>
                      </div>
                      {myCandidacy.review_notes && <p className="text-xs text-muted-foreground">הערה: {myCandidacy.review_notes}</p>}
                      {myCandidacy.status === "needs_revision" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          onClick={() => {
                            setEditDialog(myCandidacy);
                            setEditStatement(myCandidacy.statement || "");
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> ערוך והגש מחדש
                        </Button>
                      )}
                    </div>
                  )}
                  {candidates.length === 0 && <p className="text-xs text-muted-foreground">עדיין אין מועמדים מאושרים</p>}
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
                        {(e.status === "closed" || (canManageCouncil && e.status === "voting")) && (
                          <Badge variant="outline" className="shrink-0">{counts[c.id] || 0} קולות</Badge>
                        )}
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
          <p className="text-xs text-muted-foreground -mt-2">המועמדות תישלח לאישור המחנך/ת שלך לפני שתופיע לכלל בית הספר</p>
          <Textarea placeholder="למה שיצביעו לך? כמה מילים על עצמך..." value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} />
          <Button onClick={nominate} className="w-full">שלח/י מועמדות</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDialog} onOpenChange={(o) => !o && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">עריכה והגשה מחדש</DialogTitle>
          </DialogHeader>
          {editDialog?.review_notes && (
            <p className="text-xs text-muted-foreground -mt-2">הערת המחנך/ת: {editDialog.review_notes}</p>
          )}
          <Textarea placeholder="עדכן/י את המצע שלך..." value={editStatement} onChange={(e) => setEditStatement(e.target.value)} rows={4} />
          <Button onClick={resubmitCandidacy} className="w-full">שלח/י מחדש לאישור</Button>
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
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default CouncilPage;
