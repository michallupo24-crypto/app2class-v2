import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Send,
  Loader2, BookOpen, Clock, FileText,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RightsCheck {
  id: string;
  label: string;
  description: string;
  status: "ok" | "violation" | "unknown";
  detail?: string;
  subject?: string;
  canAppeal: boolean;
}

interface SubjectStat {
  id: string;
  title: string;
  subject: string;
  dueDate: string | null;
  createdAt: string;
  gradedAt: string | null;
  hasGrade: boolean;
  daysSinceSubmission: number | null;
}

const StudentRightsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rightsChecks, setRightsChecks] = useState<RightsCheck[]>([]);
  const [violations, setViolations] = useState<RightsCheck[]>([]);

  // Appeal
  const [appealDialog, setAppealDialog] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<RightsCheck | null>(null);
  const [appealText, setAppealText] = useState("");
  const [appealTarget, setAppealTarget] = useState("homeroom");
  const [generatingAppeal, setGeneratingAppeal] = useState(false);
  const [sendingAppeal, setSendingAppeal] = useState(false);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const checks: RightsCheck[] = [];

      const { data: prof } = await supabase
        .from("profiles").select("class_id").eq("id", profile.id).single();
      if (!prof?.class_id) { setLoading(false); return; }

      // 1. Fetch assignments + submissions for this student's class
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, title, subject, due_date, created_at")
        .eq("class_id", prof.class_id)
        .eq("published", true)
        .order("due_date", { ascending: false })
        .limit(30);

      if (!assignments) { setLoading(false); return; }

      const aIds = assignments.map((a: any) => a.id);
      const { data: submissions } = await supabase
        .from("submissions")
        .select("assignment_id, grade, graded_at, submitted_at, status")
        .eq("student_id", profile.id)
        .in("assignment_id", aIds);

      const subMap = new Map((submissions || []).map((s: any) => [s.assignment_id, s]));

      // Check 1: "מבחן" requires advance notice; "בוחן" by definition does not.
      // Source: חוזר הוראות קבע תשע"ו/1(א), סעיף 3.1-51 ("מבחנים פנימיים כחלק
      // מההערכה על פני הרצף החינוכי"), הערות [4]-[5]: "[4] מבחן: בדיקת הישגים
      // לאחר הודעה מוקדמת. [5] בוחן: בדיקת הישגים ללא הודעה מוקדמת..."
      // https://apps.education.gov.il/mankal/horaa.aspx?siduri=72
      // No specific day-count is given in the source for "advance," so this only
      // flags the clearest case: a מבחן announced the same day it's due.
      const noNoticeExams: string[] = [];
      for (const a of assignments) {
        if (a.due_date && a.created_at && a.title.includes("מבחן") && !a.title.includes("בוחן")) {
          const days = Math.floor(
            (new Date(a.due_date).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (days < 1) {
            noNoticeExams.push(`"${a.title}" פורסם באותו יום שבו התקיים, ללא הודעה מוקדמת`);
          }
        }
      }
      checks.push({
        id: "exam_advance_notice",
        label: "הודעה מוקדמת למבחן",
        description: "מבחן (להבדיל מבוחן) טעון הודעה מוקדמת לתלמידים",
        status: noNoticeExams.length === 0 ? "ok" : "violation",
        detail: noNoticeExams[0],
        canAppeal: noNoticeExams.length > 0,
      });

      // Check: a new בוחן in the same subject may not be given before the
      // previous בוחן in that subject was returned. Source: same circular,
      // פרק ו' ("בחנים כאחת מחלופות ההערכה"): "יוכל מורה לערוך בוחן רק בתנאי
      // שבוחן שערך קודם כבר הוחזר לתלמידים." Note this rule is specifically
      // about בוחן↔בוחן in the same subject, not מבחן.
      const quizzesBySubject = new Map<string, typeof assignments>();
      for (const a of assignments) {
        if (a.due_date && a.title.includes("בוחן")) {
          const list = quizzesBySubject.get(a.subject) || [];
          list.push(a);
          quizzesBySubject.set(a.subject, list);
        }
      }
      const unreturnedQuizzes: string[] = [];
      quizzesBySubject.forEach((quizzes) => {
        const sorted = [...quizzes].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const prevSub = subMap.get(prev.id);
          const nextDue = new Date(sorted[i].due_date).getTime();
          const prevReturned = prevSub?.graded_at ? new Date(prevSub.graded_at).getTime() : null;
          if (!prevReturned || prevReturned > nextDue) {
            unreturnedQuizzes.push(`"${sorted[i].title}" נערך לפני שהבוחן הקודם ("${prev.title}") הוחזר`);
          }
        }
      });
      checks.push({
        id: "prior_quiz_returned",
        label: "בוחן קודם באותו מקצוע הוחזר",
        description: "בוחן חדש טעון החזרת הבוחן הקודם באותו מקצוע לתלמידים",
        status: unreturnedQuizzes.length === 0 ? "ok" : "violation",
        detail: unreturnedQuizzes[0],
        canAppeal: unreturnedQuizzes.length > 0,
      });

      // Check 2: No more than 3 assessment events per week, and no more than
      // one per day. Source: same circular, section 4, item 2:
      // "...אך בשום מקרה אין לקיים יותר מאירוע הערכה אחד ביום ויותר משלושה
      // מועדי הערכה בשבוע."
      const examsByWeek = new Map<string, string[]>();
      for (const a of assignments) {
        if (a.due_date && (a.title.includes("מבחן") || a.title.includes("בוחן") || a.title.includes("בחן"))) {
          const d = new Date(a.due_date);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const key = weekStart.toISOString().split("T")[0];
          const list = examsByWeek.get(key) || [];
          list.push(a.title);
          examsByWeek.set(key, list);
        }
      }

      let maxWeekExams = 0;
      let overloadWeek: string[] = [];
      examsByWeek.forEach((exams) => {
        if (exams.length > maxWeekExams) { maxWeekExams = exams.length; overloadWeek = exams; }
      });

      checks.push({
        id: "max_3_exams",
        label: "לא יותר מ-3 מבחנים בשבוע",
        description: "על פי חוזר משרד החינוך, אין לקיים יותר מאירוע הערכה אחד ביום ויותר מ-3 בשבוע",
        status: maxWeekExams > 3 ? "violation" : "ok",
        detail: maxWeekExams > 3 ? `שבוע עמוס: ${overloadWeek.join(", ")}` : undefined,
        canAppeal: maxWeekExams > 3,
      });

      // Check 3: Feedback within two weeks. Source: same circular, section ד(2)(ג):
      // "המורה מתבקש להחזיר לתלמיד התייחסות עניינית לכל היותר תוך שבועיים
      // מהמועד שבו בוצעה או הוגשה המשימה להערכה." Note this is phrased as a
      // recommendation ("מתבקש"), not a binding requirement ("חייב") - the
      // label reflects that.
      const lateGrades: string[] = [];
      for (const a of assignments) {
        const sub = subMap.get(a.id);
        if (sub?.submitted_at && !sub?.graded_at) {
          const daysSince = Math.floor(
            (Date.now() - new Date(sub.submitted_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSince > 14) {
            lateGrades.push(`"${a.title}" הוגש לפני ${daysSince} ימים ועדיין ללא ציון`);
          }
        }
      }

      checks.push({
        id: "grade_14days",
        label: "משוב תוך שבועיים",
        description: "המורה מתבקש (על פי חוזר משרד החינוך) להחזיר ציון/משוב תוך שבועיים מהגשת המטלה",
        status: lateGrades.length === 0 ? "ok" : "violation",
        detail: lateGrades.length > 0 ? lateGrades[0] : undefined,
        canAppeal: lateGrades.length > 0,
      });

      // Informational rights (same section as check 3) - not auto-checkable
      // against the current data model, so shown as "unknown" (info) rather
      // than pass/fail.
      checks.push({
        id: "rubric_right",
        label: "משוב לפי מחוון שניתן מראש",
        description: "\"התלמיד יקבל משוב על עבודתו - בהתייחס למחוון שניתן מראש ובאופן מפורט וישיר על כל שאלה/מטלה\" - חוזר משרד החינוך, סעיף 3.1-51",
        status: "unknown",
        canAppeal: false,
      });
      checks.push({
        id: "makeup_exam_right",
        label: "מועד חלופי בהיעדרות מוצדקת",
        description: "\"תלמיד שנעדר מהכיתה מסיבה מוצדקת... יהיה זכאי לקבל מועד חלופי... על אותו החומר... וזמן זהה\" - חוזר משרד החינוך, סעיף 3.1-51",
        status: "unknown",
        canAppeal: false,
      });
      checks.push({
        id: "appeal_escalation_right",
        label: "זכות ערעור על כל ציון (מורה ← רכז ← מחנך)",
        description: "\"תלמיד המבקש לערער על ציון... רשאי לפנות למורה המקצוע בכתב... במידת הצורך, יהיה התלמיד רשאי להמשיך ולערער בפני רכז המקצוע ומחנך הכיתה\" - חוזר משרד החינוך, סעיף 3.1-51",
        status: "unknown",
        canAppeal: false,
      });

      setRightsChecks(checks);
      setViolations(checks.filter(c => c.status === "violation"));
      setLoading(false);
    };
    load();
  }, [profile.id]);

  const generateAppealText = async () => {
    if (!selectedViolation) return;
    setGeneratingAppeal(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: "generate_questions",
          prompt: `כתוב פנייה מקצועית ומכובדת בעברית מתלמיד/ה בשם ${profile.fullName} על הפרה של הנוהל הבא:
"${selectedViolation.label}"
פרטים: ${selectedViolation.detail || selectedViolation.description}
הפנייה צריכה להיות מנומסת, עניינית ולציין את הנוהל הרלוונטי של משרד החינוך. לא יותר מ-4 משפטים.`,
          numQuestions: 1,
        }),
      });
      const data = await resp.json();
      // The prompt returns a "question" but we use the first result's question_text as the generated text
      if (data.result?.[0]) {
        setAppealText(data.result[0].question_text || "");
      } else {
        // Fallback: generate inline
        setAppealText(
          `שלום,\n\nאני ${profile.fullName}, תלמיד/ה בכיתה.\nברצוני לפנות בנושא: ${selectedViolation.label}.\n${selectedViolation.detail || ""}\n\nאבקש לבדוק את הנושא בהתאם לנהלי משרד החינוך.\n\nבברכה,\n${profile.fullName}`
        );
      }
    } catch {
      setAppealText(
        `שלום,\n\nאני ${profile.fullName}.\nברצוני לפנות בנושא: ${selectedViolation.label}.\n${selectedViolation.detail || ""}\n\nבברכה,\n${profile.fullName}`
      );
    } finally {
      setGeneratingAppeal(false);
    }
  };

  const sendAppeal = async () => {
    if (!selectedViolation || !appealText.trim()) return;
    setSendingAppeal(true);
    try {
      const { data: prof } = await supabase
        .from("profiles").select("class_id").eq("id", profile.id).single();

      let targetUserId: string | null = null;

      if (appealTarget === "homeroom" && prof?.class_id) {
        const { data: tc } = await supabase
          .from("teacher_classes")
          .select("user_id")
          .eq("class_id", prof.class_id)
          .eq("is_homeroom", true)
          .maybeSingle();
        targetUserId = tc?.user_id || null;
      } else if (appealTarget === "coordinator" && prof?.class_id) {
        const { data: cls } = await supabase.from("classes").select("grade").eq("id", prof.class_id).maybeSingle();
        if (cls?.grade) {
          const { data: coordRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "grade_coordinator" as any)
            .eq("grade", cls.grade as any);
          const candidateIds = (coordRoles || []).map((r: any) => r.user_id);
          if (candidateIds.length > 0) {
            const { data: schoolCoord } = await supabase.from("profiles")
              .select("id").eq("school_id", profile.schoolId).in("id", candidateIds).limit(1).maybeSingle();
            targetUserId = schoolCoord?.id || null;
          }
        }
      } else if (appealTarget === "management") {
        const { data: mgmtRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "management" as any);
        const candidateIds = (mgmtRoles || []).map((r: any) => r.user_id);
        if (candidateIds.length > 0) {
          const { data: schoolMgmt } = await supabase.from("profiles")
            .select("id").eq("school_id", profile.schoolId).in("id", candidateIds).limit(1).maybeSingle();
          targetUserId = schoolMgmt?.id || null;
        }
      }

      if (!targetUserId) {
        toast({ title: "לא נמצא איש קשר מתאים לשליחת הפנייה", variant: "destructive" });
        return;
      }

      const { data: conv, error: convError } = await supabase.from("conversations")
        .insert({ school_id: profile.schoolId, created_by: profile.id }).select("id").single();
      if (convError || !conv?.id) {
        toast({ title: "שגיאה בשליחת הפנייה", description: convError?.message, variant: "destructive" });
        return;
      }

      const { error: participantsError } = await supabase.from("conversation_participants").insert([
        { conversation_id: conv.id, user_id: profile.id },
        { conversation_id: conv.id, user_id: targetUserId },
      ]);
      if (participantsError) {
        toast({ title: "שגיאה בשליחת הפנייה", description: participantsError.message, variant: "destructive" });
        return;
      }

      const { error: messageError } = await supabase.from("messages").insert({
        conversation_id: conv.id,
        sender_id: profile.id,
        content: `[פנייה על הפרת זכויות] ${appealText}`,
      });
      if (messageError) {
        toast({ title: "שגיאה בשליחת הפנייה", description: messageError.message, variant: "destructive" });
        return;
      }

      toast({ title: "הפנייה נשלחה!" });
      setAppealDialog(false);
      setAppealText("");
      setSelectedViolation(null);
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSendingAppeal(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const okCount = rightsChecks.filter(c => c.status === "ok").length;
  const violationCount = violations.length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />מגן הזכויות שלי
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          בדיקת עמידת הצוות בנהלי משרד החינוך
        </p>
      </motion.div>

      {/* Score banner */}
      <motion.div variants={item}>
        <Card className={`${violationCount === 0 ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${violationCount === 0 ? "bg-success/20" : "bg-warning/20"}`}>
                {violationCount === 0 ? <CheckCircle2 className="h-7 w-7 text-success" /> : <AlertTriangle className="h-7 w-7 text-warning" />}
              </div>
              <div>
                <p className="font-heading font-bold text-lg">
                  {violationCount === 0 ? "הכל תקין!" : `נמצאו ${violationCount} חריגות`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {okCount} בדיקות עברו • {violationCount} חריגות
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Rights checks */}
      <div className="space-y-3">
        {rightsChecks.map((check) => (
          <motion.div key={check.id} variants={item}>
            <Card className={
              check.status === "ok" ? "border-success/20"
              : check.status === "violation" ? "border-destructive/40"
              : "border-border"
            }>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {check.status === "ok"
                      ? <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      : check.status === "violation"
                      ? <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      : <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <p className="font-heading font-medium text-sm">{check.label}</p>
                      <p className="text-xs text-muted-foreground font-body mt-0.5">{check.description}</p>
                      {check.detail && (
                        <p className={`text-xs mt-1 font-body ${check.status === "violation" ? "text-destructive" : "text-muted-foreground"}`}>
                          {check.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <Badge variant={check.status === "ok" ? "default" : check.status === "violation" ? "destructive" : "secondary"} className="text-[10px]">
                      {check.status === "ok" ? "תקין" : check.status === "violation" ? "חריגה" : "מידע"}
                    </Badge>
                    {check.canAppeal && check.status === "violation" && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] font-heading gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => { setSelectedViolation(check); setAppealText(""); setAppealDialog(true); }}>
                        <FileText className="h-3 w-3" />הגש פנייה
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Info footer */}
      <motion.div variants={item}>
        <Card className="border-dashed">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground font-body text-center">
              הבדיקות מתבצעות על בסיס נתוני המשימות שהועלו למערכת.
              לחץ "הגש פנייה" על חריגה כדי לשלוח הודעה מנומסת לגורם הרלוונטי.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Appeal Dialog */}
      <Dialog open={appealDialog} onOpenChange={o => { if (!o) setAppealDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />הגשת פנייה
            </DialogTitle>
          </DialogHeader>
          {selectedViolation && (
            <div className="space-y-4">
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="font-heading font-medium text-sm">{selectedViolation.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedViolation.detail}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-heading">שלח אל</p>
                <Select value={appealTarget} onValueChange={setAppealTarget}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homeroom">מחנך כיתה</SelectItem>
                    <SelectItem value="coordinator">רכז שכבה</SelectItem>
                    <SelectItem value="management">הנהלה</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-heading">נוסח הפנייה</p>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 font-heading"
                    onClick={generateAppealText} disabled={generatingAppeal}>
                    {generatingAppeal ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    נסח עם AI
                  </Button>
                </div>
                <Textarea
                  placeholder="כתב את הפנייה שלך כאן, או לחץ 'נסח עם AI' לנוסח מקצועי..."
                  value={appealText}
                  onChange={e => setAppealText(e.target.value)}
                  className="font-body text-sm resize-none" rows={5}
                />
              </div>

              <Button className="w-full gap-2 font-heading" onClick={sendAppeal}
                disabled={sendingAppeal || !appealText.trim()}>
                {sendingAppeal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendingAppeal ? "שולח..." : "שלח פנייה"}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                הפנייה תתועד ותישלח לגורם שנבחר — כל הפניות נשמרות במערכת
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default StudentRightsPage;
