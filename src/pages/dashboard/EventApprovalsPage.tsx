import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Check, X, Calendar, ChevronDown, ChevronUp, Users } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface GradeEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  grade: string;
  school_id: string;
}
interface ChildLite {
  id: string;
  fullName: string;
  grade: string | null;
  schoolId: string | null;
}
interface ApprovalRow {
  id: string;
  event_id: string;
  student_id: string;
  parent_id: string;
  approved: boolean;
  signed_at: string | null;
}

const EventApprovalsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isParent = profile.roles.includes("parent") && !profile.roles.some((r) => ["management", "system_admin", "grade_coordinator", "educator"].includes(r));
  const isStaff = profile.roles.some((r) => ["grade_coordinator", "management", "system_admin", "educator"].includes(r));

  const [loading, setLoading] = useState(true);

  // Parent state
  const [children, setChildren] = useState<ChildLite[]>([]);
  const [parentEvents, setParentEvents] = useState<GradeEvent[]>([]);
  const [myApprovals, setMyApprovals] = useState<ApprovalRow[]>([]);

  // Staff state
  const [staffEvents, setStaffEvents] = useState<GradeEvent[]>([]);
  const [approvalsByEvent, setApprovalsByEvent] = useState<Record<string, ApprovalRow[]>>({});
  const [studentsByGrade, setStudentsByGrade] = useState<Record<string, { id: string; full_name: string }[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadParent = async () => {
    const { data: links } = await supabase.from("parent_student").select("student_id").eq("parent_id", profile.id);
    const studentIds = (links || []).map((l: any) => l.student_id);
    if (!studentIds.length) {
      setLoading(false);
      return;
    }
    const { data: kids } = await supabase
      .from("profiles")
      .select("id, full_name, school_id, classes(grade)")
      .in("id", studentIds);

    const kidsList: ChildLite[] = (kids || []).map((k: any) => ({
      id: k.id, fullName: k.full_name, grade: k.classes?.grade || null, schoolId: k.school_id,
    }));
    setChildren(kidsList);

    const grades = Array.from(new Set(kidsList.map((k) => k.grade).filter(Boolean)));
    const schoolIds = Array.from(new Set(kidsList.map((k) => k.schoolId).filter(Boolean)));
    if (grades.length && schoolIds.length) {
      const { data: events } = await supabase
        .from("grade_events")
        .select("id, title, description, event_date, grade, school_id")
        .eq("requires_parent_approval", true)
        .eq("status", "approved")
        .in("grade", grades as any)
        .in("school_id", schoolIds as string[])
        .order("event_date", { ascending: true });
      setParentEvents(events || []);
    }

    const { data: approvals } = await (supabase as any)
      .from("event_approvals")
      .select("id, event_id, student_id, parent_id, approved, signed_at")
      .eq("parent_id", profile.id);
    setMyApprovals(approvals || []);
    setLoading(false);
  };

  const loadStaff = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    const { data: events } = await supabase
      .from("grade_events")
      .select("id, title, description, event_date, grade, school_id")
      .eq("school_id", profile.schoolId)
      .eq("requires_parent_approval", true)
      .order("event_date", { ascending: false });
    const list: GradeEvent[] = events || [];
    setStaffEvents(list);

    if (list.length) {
      const { data: approvals } = await (supabase as any)
        .from("event_approvals")
        .select("id, event_id, student_id, parent_id, approved, signed_at")
        .in("event_id", list.map((e) => e.id));
      const grouped: Record<string, ApprovalRow[]> = {};
      (approvals || []).forEach((a: ApprovalRow) => {
        grouped[a.event_id] = grouped[a.event_id] || [];
        grouped[a.event_id].push(a);
      });
      setApprovalsByEvent(grouped);

      const grades = Array.from(new Set(list.map((e) => e.grade)));
      const gradeMap: Record<string, { id: string; full_name: string }[]> = {};
      for (const grade of grades) {
        const { data: classes } = await supabase.from("classes").select("id").eq("school_id", profile.schoolId!).eq("grade", grade as any);
        const classIds = (classes || []).map((c: any) => c.id);
        if (classIds.length) {
          const { data: students } = await supabase.from("profiles").select("id, full_name").in("class_id", classIds);
          gradeMap[grade] = students || [];
        }
      }
      setStudentsByGrade(gradeMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    if (isParent) loadParent();
    else if (isStaff) loadStaff();
    else setLoading(false);
  }, [profile.id, profile.schoolId]);

  const respond = async (event: GradeEvent, child: ChildLite, approved: boolean) => {
    const existing = myApprovals.find((a) => a.event_id === event.id && a.student_id === child.id);
    if (existing) {
      const { error } = await (supabase as any)
        .from("event_approvals")
        .update({ approved, signed_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    } else {
      const { error } = await (supabase as any).from("event_approvals").insert({
        event_id: event.id, parent_id: profile.id, student_id: child.id, approved, signed_at: new Date().toISOString(),
      });
      if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    }
    toast({ title: approved ? "האישור נשלח" : "העדכון נקלט" });
    loadParent();
  };

  if (!isParent && !isStaff) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <p>עמוד זה מיועד להורים ולצוות ניהול בלבד</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <FileSignature className="h-7 w-7 text-primary" /> אישורי הורים
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          {isParent ? "אישור דיגיטלי לטיולים ואירועים הדורשים חתימת הורה" : "מעקב חתימות הורים לאירועים ולטיולים"}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : isParent ? (
        parentEvents.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <FileSignature className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-heading font-medium">אין כרגע אירועים הדורשים אישור</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {children.map((child) => {
              const childEvents = parentEvents.filter((e) => e.grade === child.grade && e.school_id === child.schoolId);
              if (!childEvents.length) return null;
              return (
                <Card key={child.id}>
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">{child.fullName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {childEvents.map((e) => {
                      const mine = myApprovals.find((a) => a.event_id === e.id && a.student_id === child.id);
                      return (
                        <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                          <div className="min-w-0">
                            <p className="text-sm font-heading font-medium">{e.title}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3" /> {format(new Date(e.event_date), "dd/MM/yyyy")}
                            </p>
                            {e.description && <p className="text-xs text-muted-foreground mt-1">{e.description}</p>}
                          </div>
                          {mine ? (
                            <Badge variant={mine.approved ? "secondary" : "destructive"} className="shrink-0">
                              {mine.approved ? "אושר" : "לא מאשר/ת"}
                            </Badge>
                          ) : (
                            <div className="flex gap-2 shrink-0">
                              <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => respond(e, child, false)}>
                                <X className="h-3.5 w-3.5" /> לא
                              </Button>
                              <Button size="sm" className="gap-1" onClick={() => respond(e, child, true)}>
                                <Check className="h-3.5 w-3.5" /> מאשר/ת
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : staffEvents.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileSignature className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-heading font-medium">אין אירועים הדורשים אישור הורים</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {staffEvents.map((e) => {
            const allStudents = studentsByGrade[e.grade] || [];
            const approvals = approvalsByEvent[e.id] || [];
            const signedIds = new Set(approvals.filter((a) => a.approved).map((a) => a.student_id));
            const notSigned = allStudents.filter((s) => !signedIds.has(s.id));
            const isOpen = expanded === e.id;
            return (
              <Card key={e.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-heading font-bold">{e.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" /> {format(new Date(e.event_date), "dd/MM/yyyy")} · שכבה {e.grade}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" /> {signedIds.size} / {allStudents.length} חתמו
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : e.id)} className="gap-1">
                        מי לא חתם {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
                      {notSigned.length === 0 ? (
                        <p className="text-xs text-success">כולם חתמו!</p>
                      ) : (
                        notSigned.map((s) => (
                          <span key={s.id} className="text-[11px] px-2 py-1 rounded-full bg-warning/10 text-warning-foreground border border-warning/30">
                            {s.full_name}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default EventApprovalsPage;
