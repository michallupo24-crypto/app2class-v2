import { useState, useEffect, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, Heart, ChevronLeft, UserRound,
  HeartHandshake, MessageSquare, Activity, Percent,
  FileText, ArrowLeft, GraduationCap,
  XCircle, CalendarDays, ShieldCheck, Scale, Eye, ClipboardCheck,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ───────────────────────────────────────────── */
interface ChildInfo {
  id: string;
  fullName: string;
  grade: string | null;
  classNumber: number | null;
  schoolName: string | null;
  classId: string | null;
  schoolId: string | null;
}

interface WeeklyItem {
  id: string;
  title: string;
  type: 'exam' | 'holiday' | 'assignment' | 'event';
  date: string;
  dayLabel: string;
}

const ParentDashboardPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [selectedChild, setSelectedChild] = useState<ChildInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [state, setState] = useState({
    overallAvg: null as number | null,
    classAvg: null as number | null,
    attendancePct: 100,
    absentCount: 0,
    weeklyRoadmap: [] as WeeklyItem[],
    educators: { teacherId: "", educatorName: "", counselorId: "", counselorName: "" },
    classComparison: null as {
      childAbsenceRate: number; classAbsenceRate: number;
      childFocusAvg: number; classFocusAvg: number;
      childSubmissionRate: number; classSubmissionRate: number;
    } | null,
  });
  const [aiInsight, setAiInsight] = useState<string>("");
  const [aiInsightLoading, setAiInsightLoading] = useState(false);

  const syncCommunity = useCallback(async (child: ChildInfo) => {
    if (!child.classId || !child.schoolId) return;
    try {
      const { data: convos } = await supabase.from("conversations")
        .select("id")
        .or(`class_id.eq.${child.classId},and(type.eq.parent_grade,school_id.eq.${child.schoolId})`);

      if (convos?.length) {
        const participants = convos.map(c => ({ conversation_id: c.id, user_id: profile.id }));
        const { error } = await supabase.from("conversation_participants").upsert(participants, { onConflict: 'conversation_id,user_id' });
        if (error) throw error;
      }
    } catch (e) { console.error("Sync error", e); }
  }, [profile.id]);

  const loadData = useCallback(async (child: ChildInfo) => {
    const today = new Date().toISOString().split('T')[0];
    await syncCommunity(child);

    // 1. PERFORMANCE: Factual Grades
    const { data: subs } = await supabase.from("submissions")
      .select("grade, assignments(max_grade, weight_percent)")
      .eq("student_id", child.id)
      .not("grade", "is", null);
      
    let cAvg = null;
    if (subs?.length) {
       let wSum = 0, wTotal = 0;
       subs.forEach((s: any) => {
         const assign = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
         if (assign) {
           const w = assign.weight_percent || 10;
           wSum += (s.grade / (assign.max_grade || 100)) * 100 * w;
           wTotal += w;
         }
       });
       if (wTotal > 0) cAvg = Math.round(wSum / wTotal);
    }

    // 2. STAFF: Unified Educator & Counselor Lookup
    let staff = { teacherId: "", educatorName: "", counselorId: "", counselorName: "" };
    if (child.classId) {
       const { data: roles } = await supabase.from("user_roles")
         .select("user_id, role, profiles!inner(full_name)")
         .or(`homeroom_class_id.eq.${child.classId},and(role.eq.counselor,grade.eq.${child.grade})`);
       
       roles?.forEach(r => {
         if (r.role === 'educator') {
            staff.teacherId = r.user_id;
            staff.educatorName = (r.profiles as any)?.full_name;
         } else if (r.role === 'counselor') {
            staff.counselorId = r.user_id;
            staff.counselorName = (r.profiles as any)?.full_name;
         }
       });
    }

    // 3. ROADMAP: Triple-Source Sync
    const [{ data: gEvs }, { data: sEvs }, { data: assigns }, { data: attH }] = await Promise.all([
       supabase.from("grade_events").select("id, title, event_date").eq("school_id", child.schoolId).gte("event_date", today),
       supabase.from("school_events").select("id, title, start_date").eq("school_id", child.schoolId).gte("start_date", today),
       supabase.from("assignments").select("id, title, due_date, type").eq("class_id", child.classId).gte("due_date", today),
       supabase.from("attendance").select("status").eq("student_id", child.id)
    ]);

    const combined: WeeklyItem[] = [];
    gEvs?.forEach(e => combined.push({ id: e.id, title: e.title, type: 'exam', date: e.event_date, dayLabel: new Date(e.event_date).toLocaleDateString("he-IL", { weekday: "short" }) }));
    sEvs?.forEach(e => combined.push({ id: e.id, title: e.title, type: 'event', date: e.start_date, dayLabel: new Date(e.start_date).toLocaleDateString("he-IL", { weekday: "short" }) }));
    assigns?.forEach(e => {
       if (e.due_date) combined.push({ id: e.id, title: e.title, type: e.type === 'exam' ? 'exam' : 'assignment', date: e.due_date, dayLabel: new Date(e.due_date).toLocaleDateString("he-IL", { weekday: "short" }) });
    });

    const finalRoadmap = combined
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);

    const absences = (attH || []).filter(a => a.status === "absent").length;
    const attPct = attH?.length ? Math.round(((attH.length - absences) / attH.length) * 100) : 100;

    let classAvg: number | null = null;
    if (child.classId) {
      const { data: avgData } = await supabase.rpc("get_class_average", { p_class_id: child.classId });
      classAvg = avgData ?? null;
    }

    // "Soft" comparisons alongside grades: is my kid's attendance/focus/
    // homework-follow-through normal for this class, or a real outlier?
    // Previously each showed only the child's own raw number.
    const { data: cmpRows } = await supabase.rpc("get_child_class_comparison", { p_student_id: child.id });
    const cmp = cmpRows?.[0];
    const classComparison = cmp ? {
      childAbsenceRate: cmp.child_absence_rate,
      classAbsenceRate: cmp.class_absence_rate,
      childFocusAvg: cmp.child_focus_avg,
      classFocusAvg: cmp.class_focus_avg,
      childSubmissionRate: cmp.child_submission_rate,
      classSubmissionRate: cmp.class_submission_rate,
    } : null;

    setState({
      overallAvg: cAvg,
      classAvg,
      attendancePct: attPct,
      absentCount: absences,
      weeklyRoadmap: finalRoadmap,
      educators: staff,
      classComparison,
    });

    setAiInsightLoading(true);
    setAiInsight("");
    try {
      const contextStr = `ילד/ה: ${child.fullName}, כיתה ${child.grade || ""}'${child.classNumber || ""}.
ממוצע ציונים אישי: ${cAvg ?? "אין נתונים"}. ממוצע כיתה: ${classAvg ?? "אין נתונים"}.
אחוז נוכחות: ${attPct}%. מספר היעדרויות: ${absences}.
אירועים קרובים: ${finalRoadmap.length > 0 ? finalRoadmap.map(r => r.title).join(", ") : "אין אירועים קרובים"}.`;
      const { data } = await supabase.functions.invoke("ai-tutor", {
        body: { context: "parent_insight", message: contextStr, studentId: child.id },
      });
      setAiInsight(data?.message || "לא ניתן לטעון תובנה כרגע");
    } catch {
      setAiInsight("שגיאה בטעינת התובנה, נסה שוב מאוחר יותר");
    } finally {
      setAiInsightLoading(false);
    }
  }, [syncCommunity]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const { data: lks } = await supabase.from("parent_student").select("student_id").eq("parent_id", profile.id);
      if (!lks?.length) { setLoading(false); return; }
      const ids = lks.map(l => l.student_id);
      const { data: prs } = await supabase.from("profiles").select("id, full_name, class_id, school_id, schools(name), classes(grade, class_number)").in("id", ids);
      if (prs) {
        const kids = prs.map((p: any) => ({
          id: p.id, fullName: p.full_name, grade: p.classes?.grade || null, classNumber: p.classes?.class_number || null,
          schoolName: p.schools?.name || null, classId: p.class_id || null, schoolId: p.school_id || null,
        }));
        setChildren(kids);
        if (kids.length) setSelectedChild(kids[0]);
      }
      setLoading(false);
    };
    init();
  }, [profile.id]);

  useEffect(() => { if (selectedChild) loadData(selectedChild); }, [selectedChild, loadData]);

  // Live attendance alerts: attendance realtime + RLS were already set up
  // server-side for this, but nothing ever subscribed to it.
  useEffect(() => {
    if (!selectedChild) return;
    const channel = supabase
      .channel(`parent-attendance-${selectedChild.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `student_id=eq.${selectedChild.id}` },
        (payload) => {
          const status = (payload.new as any)?.status;
          if (status === "absent" || status === "late") {
            toast({
              title: status === "absent" ? `${selectedChild.fullName} סומן/ה נעדר/ת` : `${selectedChild.fullName} סומן/ה כמאחר/ת`,
              description: "עודכן כרגע במערכת הנוכחות",
              variant: status === "absent" ? "destructive" : "default",
            });
          }
          loadData(selectedChild);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChild, loadData, toast]);

  const goToGrades = () => selectedChild && navigate(`/dashboard/grades/${selectedChild.id}`);
  const goToAttendance = () => selectedChild && navigate(`/dashboard/attendance/${selectedChild.id}`);
  const goToChat = (id?: string) => id && navigate("/dashboard/chat", { state: { targetUserId: id } });
  const goToCommunity = (type: string) => navigate("/dashboard/chat", { state: { initialType: type } });

  if (loading) return <div className="h-screen flex items-center justify-center text-muted-foreground">טוען...</div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24 text-right" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
           <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-4">
                 <div className="w-14 h-14 bg-primary rounded-lg flex items-center justify-center text-primary-foreground"><Heart className="h-7 w-7" /></div>
                 <span className="text-foreground font-heading">אזור ההורה</span>
              </h1>
              <div className="flex flex-wrap gap-3">
                 {children.map(c => (
                   <button key={c.id} onClick={() => setSelectedChild(c)} className={`px-6 py-2.5 rounded-lg text-xs font-black transition-colors border ${selectedChild?.id === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}>
                      {c.fullName}
                   </button>
                 ))}
              </div>
           </div>
           <Button onClick={goToGrades} className="w-full md:w-auto h-14 px-8 rounded-lg bg-success hover:bg-success/90 text-success-foreground font-black gap-3">
              <FileText className="h-5 w-5" />
              דוחות וציונים מפורטים
              <ChevronLeft className="h-4 w-4 mr-2" />
           </Button>
        </div>

        {selectedChild && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              
              {/* MAIN CONTENT */}
              <div className="lg:col-span-2 space-y-12">
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card className="bg-primary text-primary-foreground rounded-lg p-8 flex flex-col justify-between">
                       <div className="space-y-8">
                          <div>
                             <h2 className="text-3xl font-black">{selectedChild.fullName}</h2>
                             <p className="text-xs text-primary-foreground/70 font-bold italic">כיתה {selectedChild.grade}'{selectedChild.classNumber} • {selectedChild.schoolName}</p>
                          </div>

                          <div className="flex items-center gap-12">
                             <div className="text-center">
                                <p className="text-7xl font-black tracking-tighter tabular-nums leading-none">{state.overallAvg ?? "—"}</p>
                                <p className="text-[10px] uppercase font-black tracking-widest text-primary-foreground/60 mt-3">GPA משוקלל</p>
                             </div>
                             <div className="w-px h-20 bg-primary-foreground/20" />
                             <div className="text-center opacity-70">
                                <p className="text-4xl font-black tabular-nums leading-none tracking-tight">{state.classAvg ?? "—"}</p>
                                <p className="text-[10px] uppercase font-black tracking-widest text-primary-foreground/60 mt-3">ממוצע כיתה</p>
                             </div>
                          </div>
                       </div>
                    </Card>

                    <div className="grid grid-cols-2 gap-8">
                       <Card
                         className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 transition-colors"
                         onClick={goToAttendance}
                       >
                          <div className="w-16 h-16 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive mb-6"><XCircle className="h-8 w-8" /></div>
                          <p className="text-5xl font-black tabular-nums tracking-tighter">{state.absentCount}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-4">היעדרויות סה"כ</p>
                       </Card>
                       <Card className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 rounded-lg bg-success/10 flex items-center justify-center text-success mb-6"><Percent className="h-8 w-8" /></div>
                          <p className="text-5xl font-black tabular-nums tracking-tighter">{state.attendancePct}%</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-4">נוכחות שנתית</p>
                       </Card>
                    </div>

                    {/* SOFT COMPARISONS: previously only grades were
                        compared to the class average - attendance, focus
                        and homework follow-through each showed only the
                        child's own raw number, with no context for whether
                        that's normal or a real outlier. */}
                    {state.classComparison && (
                      <Card className="bg-card border border-border rounded-lg p-8 space-y-6">
                         <div className="flex items-center gap-3">
                            <Scale className="h-5 w-5 text-primary" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">השוואה לממוצע הכיתה</h3>
                         </div>
                         {[
                           {
                             icon: Percent, color: "bg-success",
                             label: "נוכחות",
                             childPct: Math.round((1 - state.classComparison.childAbsenceRate) * 100),
                             classPct: Math.round((1 - state.classComparison.classAbsenceRate) * 100),
                             childDisplay: `${Math.round((1 - state.classComparison.childAbsenceRate) * 100)}%`,
                             classDisplay: `${Math.round((1 - state.classComparison.classAbsenceRate) * 100)}% ממוצע`,
                           },
                           {
                             icon: Eye, color: "bg-info",
                             label: "ריכוז בשיעור",
                             childPct: Math.round((state.classComparison.childFocusAvg / 5) * 100),
                             classPct: Math.round((state.classComparison.classFocusAvg / 5) * 100),
                             childDisplay: state.classComparison.childFocusAvg > 0 ? `${state.classComparison.childFocusAvg.toFixed(1)}/5` : "אין נתונים",
                             classDisplay: state.classComparison.classFocusAvg > 0 ? `${state.classComparison.classFocusAvg.toFixed(1)}/5 ממוצע` : "אין נתונים",
                           },
                           {
                             icon: ClipboardCheck, color: "bg-warning",
                             label: "הגשת מטלות בזמן",
                             childPct: Math.round(state.classComparison.childSubmissionRate * 100),
                             classPct: Math.round(state.classComparison.classSubmissionRate * 100),
                             childDisplay: `${Math.round(state.classComparison.childSubmissionRate * 100)}%`,
                             classDisplay: `${Math.round(state.classComparison.classSubmissionRate * 100)}% ממוצע`,
                           },
                         ].map((row) => (
                           <div key={row.label} className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                 <span className="flex items-center gap-2 font-bold text-foreground">
                                    <row.icon className="h-3.5 w-3.5" />{row.label}
                                 </span>
                                 <span className="font-black tabular-nums">{row.childDisplay}</span>
                              </div>
                              <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
                                 <div className={`absolute inset-y-0 right-0 rounded-full ${row.color}`} style={{ width: `${Math.min(100, Math.max(0, row.childPct))}%` }} />
                                 <div className="absolute inset-y-0 w-0.5 bg-muted-foreground" style={{ right: `${Math.min(100, Math.max(0, row.classPct))}%` }} title={row.classDisplay} />
                              </div>
                              <p className="text-[10px] text-muted-foreground text-left">{row.classDisplay}</p>
                           </div>
                         ))}
                      </Card>
                    )}
                 </div>

                 {/* CALENDAR ROADMAP */}
                 <div className="space-y-6">
                    <div className="flex justify-between items-center px-4">
                       <h3 className="text-xl font-black flex items-center gap-3">
                          <CalendarDays className="h-6 w-6 text-primary" /> לו"ז אירועים ומבצעי למידה
                       </h3>
                       <div className="px-4 py-1.5 rounded-lg border border-border text-[10px] font-black text-muted-foreground uppercase">מתעדכן בזמן אמת</div>
                    </div>
                    <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide px-4">
                       {["א'", "ב'", "ג'", "ד'", "ה'"].map(day => {
                          const items = state.weeklyRoadmap.filter(r => r.dayLabel === day);
                          return (
                            <div key={day} className="flex-none w-56 space-y-4">
                               <p className="text-xs font-black text-muted-foreground border-b border-border pb-3 text-center tracking-widest">{day}</p>
                               {items.map(i => (
                                 <div key={i.id} className={`p-6 rounded-lg text-xs font-black text-center border ${
                                   i.type === 'exam' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                                   i.type === 'holiday' ? "bg-info/10 border-info/20 text-info" :
                                   "bg-primary/10 border-primary/20 text-primary"
                                 }`}>
                                    <div className="opacity-60 text-[9px] mb-2 uppercase tracking-tightest">
                                       {i.type === 'exam' ? "מבחן הרשום בלוח" : i.type === 'event' ? "אירוע בית ספר" : "מטלה להגשה"}
                                    </div>
                                    {i.title}
                                 </div>
                               ))}
                               {items.length === 0 && <div className="h-28 w-full border-2 border-dashed border-border rounded-lg opacity-50 flex items-center justify-center text-muted-foreground text-xs font-bold">אין אירועים</div>}
                            </div>
                          );
                       })}
                    </div>
                 </div>
              </div>

              {/* SIDEBAR PANEL */}
              <div className="space-y-12">
                 
                 {/* STAFF CONTACTS */}
                 <Card className="bg-card border border-border rounded-lg p-8">
                    <h3 className="text-xl font-black mb-8 text-foreground">ערוצי קשר ישירים</h3>
                    <div className="space-y-4">
                       <button onClick={() => goToChat(state.educators.teacherId)} className="w-full flex items-center gap-5 p-6 rounded-lg bg-muted hover:bg-muted/70 transition-colors border border-border active:scale-[0.99]">
                          <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><UserRound className="h-6 w-6" /></div>
                          <div className="flex-1 text-right">
                             <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">מחנכת הכיתה</p>
                             <p className="text-md font-black text-foreground">{state.educators.educatorName || "—"}</p>
                          </div>
                          <ChevronLeft className="h-5 w-5 opacity-40" />
                       </button>

                       <button onClick={() => goToChat(state.educators.counselorId)} className="w-full flex items-center gap-5 p-6 rounded-lg bg-muted hover:bg-muted/70 transition-colors border border-border active:scale-[0.99]">
                          <div className="w-14 h-14 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive"><HeartHandshake className="h-6 w-6" /></div>
                          <div className="flex-1 text-right">
                             <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">יועצת השכבה</p>
                             <p className="text-md font-black text-foreground italic opacity-80">{state.educators.counselorName || "—"}</p>
                          </div>
                          <ChevronLeft className="h-5 w-5 opacity-40" />
                       </button>
                    </div>
                 </Card>

                 {/* COMMUNITY HUB */}
                 <div className="p-8 rounded-lg bg-card border border-border space-y-6">
                    <div className="flex items-center gap-3 justify-end leading-none">
                       <h4 className="text-[11px] font-black uppercase text-primary tracking-widest">קהילת הורים</h4>
                       <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-4">
                       <button onClick={() => goToCommunity('parent_class')} className="w-full h-14 rounded-lg bg-muted hover:bg-muted/70 transition-colors flex items-center justify-between px-6 text-xs font-black border border-border active:scale-[0.99]">
                         קבוצת הורי כיתה {selectedChild.grade}'{selectedChild.classNumber}
                         <ArrowLeft className="h-5 w-5 text-primary" />
                       </button>
                       <button onClick={() => goToCommunity('parent_grade')} className="w-full h-14 rounded-lg border border-border hover:bg-muted transition-colors flex items-center justify-between px-6 text-xs font-black active:scale-[0.99]">
                         פורום הורי שכבת {selectedChild.grade}
                         <ArrowLeft className="h-5 w-5 text-primary" />
                       </button>
                    </div>
                 </div>

                 {/* SYSTEM INSIGHT */}
                 <div className="p-8 rounded-lg bg-primary/10 border border-primary/20 text-right">
                    <div className="flex items-center gap-3 mb-4 justify-end">
                       <p className="text-[10px] font-black uppercase text-primary tracking-widest">תובנת AI</p>
                       <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground leading-relaxed italic">
                       {aiInsightLoading ? "טוען תובנה..." : aiInsight}
                    </p>
                 </div>

              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default ParentDashboardPage;
