import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { computeWeightedAverage } from "@/lib/gradeMath";
import { Loader2 } from "lucide-react";
import { SubjectSticker } from "@/components/SubjectSticker";
import { ToolSticker } from "@/components/ToolSticker";

/* ─── Types ───────────────────────────────────────────── */
interface GradeEntry {
  id: string;
  assignmentId: string;
  title: string;
  subject: string;
  type: string;
  grade: number;
  maxGrade: number;
  weight: number;
  gradedAt: string;
  feedback: string | null;
  classAvg?: number | null;
  normalizedGrade: number;
}

interface SubjectSummary {
  subject: string;
  average: number;
  classAverage: number | null;
  count: number;
  trend: "up" | "down" | "stable";
  isTopPerformer: boolean;
  grades: GradeEntry[];
}

const TYPE_LABELS: Record<string, string> = {
  homework: "שיעורי בית", exam: "מבחן", quiz: "בוחן", project: "פרויקט", exercise: "תרגיל",
};

const StudentGradesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { studentId: paramId } = useParams();
  const studentId = paramId || profile.id;
  const isParentView = !!paramId && paramId !== profile.id;
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [appealGrade, setAppealGrade] = useState<GradeEntry | null>(null);
  const [feedbackGrade, setFeedbackGrade] = useState<GradeEntry | null>(null);
  const [appealText, setAppealText] = useState("");
  const [sendingAppeal, setSendingAppeal] = useState(false);
  const [studentName, setStudentName] = useState<string>("");
  const [classId, setClassId] = useState<string | null>(null);
  const [distribution, setDistribution] = useState<{ bucket_label: string; bucket_min: number; student_count: number }[]>([]);
  const [distributionLoading, setDistributionLoading] = useState(false);


  /* ── Academic Pulse (NO FILLERS) ────────────────────── */
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      let targetId = studentId;

      // Parent Context Recovery: If no ID in URL, find first child
      if (profile.roles.includes('parent') && !paramId) {
        const { data: kids } = await supabase.from("parent_student").select("student_id").eq("parent_id", profile.id).limit(1);
        if (kids?.[0]?.student_id) targetId = kids[0].student_id;
      }

      const { data: p } = await supabase.from("profiles").select("full_name, class_id").eq("id", targetId).single();
      if (p) { setStudentName(p.full_name); setClassId(p.class_id); }

      const { data: subs, error } = await supabase
        .from("submissions")
        .select("id, grade, graded_at, feedback, assignment_id, assignments(id, title, subject, type, weight_percent, max_grade)")
        .eq("student_id", targetId)
        .not("grade", "is", null)
        .order("graded_at", { ascending: false });

      if (error || !subs) { setLoading(false); return; }

      const assignmentIds = subs.map((s: any) => s.assignment_id).filter(Boolean);
      let avgMap = new Map<string, number>();
      if (assignmentIds.length > 0) {
        const { data: classData } = await supabase.rpc('get_assignment_averages', { p_assignment_ids: assignmentIds });
        if (classData) (classData as any[]).forEach(row => avgMap.set(row.assignment_id, row.avg_grade));
      }

      const enriched: GradeEntry[] = subs.map((s: any) => {
        const assign = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
        return {
          id: s.id,
          assignmentId: s.assignment_id,
          title: assign?.title || "ללא כותרת",
          subject: assign?.subject || "כללי",
          type: assign?.type || "homework",
          grade: s.grade,
          maxGrade: assign?.max_grade || 100,
          weight: assign?.weight_percent || 0,
          gradedAt: s.graded_at,
          feedback: s.feedback,
          classAvg: avgMap.has(s.assignment_id) ? Math.round(avgMap.get(s.assignment_id)!) : null,
          normalizedGrade: Math.round((s.grade / (assign?.max_grade || 100)) * 100),
        };
      });

      setGrades(enriched);
      setLoading(false);
    };
    loadData();
  }, [studentId, isParentView]);

  /* ── Subject Analysis ────────────────────────────────── */
  const subjectSummaries = useMemo<SubjectSummary[]>(() => {
    const map = new Map<string, GradeEntry[]>();
    grades.forEach(g => { const l = map.get(g.subject) || []; l.push(g); map.set(g.subject, l); });

    return Array.from(map.entries()).map(([subject, entries]) => {
      const avg = computeWeightedAverage(entries.map(g => ({ grade: g.grade, maxGrade: g.maxGrade, weightPercent: g.weight }))) ?? 0;
      const cAvg = entries.some(g => g.classAvg !== null) 
                   ? Math.round(entries.reduce((s, g) => s + (g.classAvg || 0), 0) / entries.filter(g => g.classAvg !== null).length) 
                   : null;
      let trend: "up" | "down" | "stable" = "stable";
      if (entries.length >= 2) {
        const diff = entries[0].normalizedGrade - entries[1].normalizedGrade;
        if (diff > 5) trend = "up"; else if (diff < -5) trend = "down";
      }
      return { 
        subject, average: avg, classAverage: cAvg, count: entries.length, trend, 
        isTopPerformer: cAvg !== null && avg > cAvg + 10,
        grades: entries 
      };
    }).sort((a, b) => b.average - a.average);
  }, [grades]);

  const overallAvg = useMemo(() =>
    subjectSummaries.length === 0 ? 0 : Math.round(subjectSummaries.reduce((s, ss) => s + ss.average, 0) / subjectSummaries.length),
    [subjectSummaries]
  );

  // Default the subject selector to the student's top subject once grades load
  useEffect(() => {
    if (selectedSubject === "all" && subjectSummaries.length > 0) {
      setSelectedSubject(subjectSummaries[0].subject);
    }
  }, [subjectSummaries, selectedSubject]);

  const activeSubjectSummary = useMemo(
    () => subjectSummaries.find(ss => ss.subject === selectedSubject) || null,
    [subjectSummaries, selectedSubject]
  );

  /* ── Anonymous Bell Curve (spec: Grade Benchmark) ─────── */
  useEffect(() => {
    if (!classId || !selectedSubject || selectedSubject === "all") { setDistribution([]); return; }
    const load = async () => {
      setDistributionLoading(true);
      const { data } = await supabase.rpc("get_grade_distribution", { p_class_id: classId, p_subject: selectedSubject });
      setDistribution((data as any[]) || []);
      setDistributionLoading(false);
    };
    load();
  }, [classId, selectedSubject]);

  // Spec: "relative improvement trend" — is the child improving faster or
  // slower than the class average, not just their own raw trend
  const trendInsight = useMemo(() => {
    const entries = activeSubjectSummary?.grades || [];
    const withClassAvg = entries.filter(g => g.classAvg !== null);
    if (withClassAvg.length < 2) return null;

    const recent = withClassAvg.slice(0, Math.min(2, Math.floor(withClassAvg.length / 2)) || 1);
    const previous = withClassAvg.slice(recent.length, recent.length * 2);
    if (previous.length === 0) return null;

    const avg = (arr: GradeEntry[], key: "normalizedGrade" | "classAvg") =>
      arr.reduce((s, g) => s + (Number(g[key]) || 0), 0) / arr.length;

    const studentDelta = Math.round(avg(recent, "normalizedGrade") - avg(previous, "normalizedGrade"));
    const classDelta = Math.round(avg(recent, "classAvg") - avg(previous, "classAvg"));
    const relative = studentDelta - classDelta;
    if (Math.abs(relative) < 2) return null;

    if (relative > 0 && classDelta < 0) {
      return studentDelta >= 0
        ? `הילד/ה שמר/ה על הציון בעוד שממוצע הכיתה ירד ב-${Math.abs(classDelta)} נקודות`
        : `הציון ירד, אך פחות מהכיתה שירדה ב-${Math.abs(classDelta)} נקודות`;
    }
    if (relative > 0) return `הילד/ה משתפר/ת מהר יותר מממוצע הכיתה (${studentDelta > 0 ? "+" : ""}${studentDelta} מול ${classDelta > 0 ? "+" : ""}${classDelta})`;
    return `הקצב מול הכיתה איטי יותר לאחרונה (${studentDelta > 0 ? "+" : ""}${studentDelta} מול ${classDelta > 0 ? "+" : ""}${classDelta})`;
  }, [activeSubjectSummary]);

  const bellCurveData = useMemo(() => {
    const ORDER = [0, 60, 70, 80, 90];
    const LABELS: Record<number, string> = { 0: "מתחת ל-60", 60: "60-69", 70: "70-79", 80: "80-89", 90: "90-100" };
    const myBucketMin = activeSubjectSummary
      ? ([...ORDER].reverse().find(min => activeSubjectSummary.average >= min) ?? 0)
      : null;
    return ORDER.map(min => {
      const row = distribution.find(d => d.bucket_min === min);
      return { bucket: LABELS[min], min, count: row?.student_count || 0, isMine: min === myBucketMin };
    });
  }, [distribution, activeSubjectSummary]);

  const chartData = useMemo(() => {
    return [...grades].reverse().slice(-10).map((g, i) => ({
      name: i + 1,
      grade: g.normalizedGrade,
      avg: g.classAvg || 0,
      title: g.title
    }));
  }, [grades]);

  const sendAppeal = async () => {
    if (!appealGrade || !appealText.trim()) return;
    setSendingAppeal(true);
    const { error } = await supabase.from("submissions").update({
      feedback: `[ערעור הורה/תלמיד]: ${appealText}\n${appealGrade.feedback || ""}`
    }).eq("id", appealGrade.id);
    
    if (!error) {
      toast({ title: "הערעור נשלח לבדיקת מורה" });
      setAppealGrade(null); setAppealText("");
    }
    setSendingAppeal(false);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  const classAvgAll = (() => {
    const xs = subjectSummaries.filter(s => s.classAverage !== null);
    return xs.length ? Math.round(xs.reduce((a, s) => a + (s.classAverage || 0), 0) / xs.length) : null;
  })();
  const vsClass = classAvgAll !== null ? overallAvg - classAvgAll : null;
  const fmt = (d: string) => new Date(d).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
  const me = isParentView ? "הילד/ה" : "אני";

  // Learning curve: last 10 graded items vs. the class average, on a 400x150 canvas.
  const lo = Math.min(60, ...chartData.flatMap(d => [d.grade, d.avg || 100])), span = Math.max(10, 100 - lo);
  const pt = (v: number, i: number) => [chartData.length > 1 ? i * 400 / (chartData.length - 1) : 200, 150 - (v - lo) / span * 140];
  const path = (vals: number[]) => vals.map((v, i) => (i ? "L" : "M") + pt(v, i).map(n => n.toFixed(1)).join(" ")).join(" ");
  const withAvg = chartData.filter(d => d.avg);
  const maxBucket = Math.max(1, ...bellCurveData.map(b => b.count));

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4 md:gap-[22px]">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <ToolSticker id="grades" size={52} className="max-md:w-10 max-md:h-10" />
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading font-black text-[26px] md:text-[30px] leading-none">{isParentView ? `הציונים של ${studentName}` : "הציונים שלי"}</h1>
            <p className="font-body font-semibold text-sm leading-none text-muted-foreground max-md:hidden">כל המטלות והמבחנים שנבדקו השנה</p>
          </div>
        </div>
        <button type="button" onClick={() => navigate(`/dashboard/report/${studentId}`)}
          className="max-md:hidden px-4 py-3 rounded-xl bg-primary text-primary-foreground font-body font-extrabold text-sm leading-none">
          הפק גיליון ציונים
        </button>
      </div>

      {grades.length === 0 ? (
        <div className="py-16 text-center rounded-[22px] border-2 border-dashed border-input font-body font-bold text-muted-foreground">עדיין אין ציונים שנבדקו</div>
      ) : (
        <>
          {/* Average + top subjects */}
          <div className="grid grid-cols-1 md:grid-cols-[200px_repeat(3,minmax(0,1fr))] gap-3.5">
            <div className="flex md:flex-col md:justify-center items-center md:items-start gap-4 md:gap-2 px-5 py-[18px] md:p-5 rounded-[22px] md:rounded-[22px] bg-[#1B2333] text-white shadow-raised">
              <span className="font-body font-extrabold text-[13px] leading-none text-white/75 max-md:hidden">ממוצע שנתי</span>
              <span className="font-heading font-black text-[52px] md:text-[60px] leading-none">{overallAvg}</span>
              <div className="flex flex-col gap-1.5">
                <span className="md:hidden font-heading font-extrabold text-[15px] leading-none">ממוצע שנתי</span>
                {vsClass !== null && (
                  <span className="font-body font-semibold text-[13px] leading-snug text-white/80">
                    {vsClass === 0 ? "בדיוק כמו ממוצע הכיתה" : `${vsClass > 0 ? "+" : ""}${vsClass} מממוצע הכיתה`}
                  </span>
                )}
              </div>
            </div>
            {/* Desktop: top 3 subjects with trend */}
            {subjectSummaries.slice(0, 3).map(ss => {
              const diff = ss.classAverage !== null ? ss.average - ss.classAverage : null;
              const tag = ss.trend === "up" ? { t: "בשיפור", c: "bg-success-soft text-success" } : ss.trend === "down" ? { t: "בירידה", c: "bg-destructive-soft text-destructive" } : { t: "יציב", c: "bg-muted text-muted-foreground" };
              return (
                <div key={ss.subject} className="max-md:hidden flex flex-col gap-2.5 p-[18px] rounded-[22px] bg-card shadow-card">
                  <div className="flex items-start justify-between">
                    <SubjectSticker subject={ss.subject} size={46} />
                    <span className={`px-[9px] py-[5px] rounded-[9px] border-2 border-white dark:border-card font-body font-extrabold text-xs leading-none rotate-2 shadow-sticker ${tag.c}`}>{tag.t}</span>
                  </div>
                  <span className="font-heading font-extrabold text-sm leading-none text-text-secondary">{ss.subject}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading font-black text-4xl leading-none">{ss.average}</span>
                    {diff !== null && <span className={`font-body font-extrabold text-[13px] ${diff >= 0 ? "text-success" : "text-destructive"}`}>{diff > 0 ? "+" : ""}{diff} מהכיתה</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phone: every subject as a small tile */}
          <div className="md:hidden grid grid-cols-3 gap-2">
            {subjectSummaries.map(ss => (
              <div key={ss.subject} className="flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-[18px] bg-card shadow-[0_6px_14px_-10px_rgba(40,30,15,.45)]">
                <SubjectSticker subject={ss.subject} size={38} />
                <span className="font-heading font-black text-xl leading-none">{ss.average}</span>
                <span className="font-body font-bold text-[11.5px] leading-none text-muted-foreground truncate max-w-full px-1">{ss.subject}</span>
              </div>
            ))}
          </div>

          <div className="max-md:hidden grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3.5">
            {/* Learning curve */}
            <div className="flex flex-col gap-3.5 p-5 rounded-[22px] bg-card shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-[5px]">
                  <h2 className="font-heading font-black text-[17px] leading-tight">עקומת למידה</h2>
                  <p className="font-body font-semibold text-[12.5px] leading-none text-muted-foreground">{chartData.length} המטלות האחרונות, מול ממוצע הכיתה</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1.5 font-body font-extrabold text-xs"><span className="w-3.5 h-1 rounded-sm bg-foreground" />{me}</span>
                  <span className="flex items-center gap-1.5 font-body font-extrabold text-xs text-muted-foreground"><span className="w-3.5 border-t-[3px] border-dashed border-[#B5AA98]" />הכיתה</span>
                </div>
              </div>
              <svg viewBox="0 0 400 150" className="w-full h-[170px] overflow-visible" role="img" aria-label={`עקומת ציונים: ${chartData.map(d => d.grade).join(", ")}`}>
                <path d="M0 30 H400 M0 75 H400 M0 120 H400" className="stroke-border" strokeWidth="1.5" fill="none" />
                {withAvg.length > 1 && <path d={path(chartData.map(d => d.avg || d.grade))} stroke="#B5AA98" strokeWidth="3" strokeDasharray="8 6" fill="none" strokeLinecap="round" />}
                <path d={path(chartData.map(d => d.grade))} className="stroke-foreground" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {chartData.map((d, i) => { const [x, y] = pt(d.grade, i); return <circle key={i} cx={x} cy={y} r="5" className="fill-card stroke-foreground" strokeWidth="3"><title>{`${d.title}: ${d.grade}`}</title></circle>; })}
              </svg>
            </div>

            {/* Anonymous distribution */}
            <div className="flex flex-col gap-3.5 p-5 rounded-[22px] bg-card shadow-card">
              <div className="flex flex-col gap-[5px]">
                <h2 className="font-heading font-black text-[17px] leading-tight">{isParentView ? "איפה הילד/ה בכיתה" : "איפה אני בכיתה"}</h2>
                <p className="font-body font-semibold text-[12.5px] leading-snug text-muted-foreground">כמה תלמידים בכל טווח. בלי שמות.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subjectSummaries.map(ss => (
                  <button key={ss.subject} type="button" onClick={() => setSelectedSubject(ss.subject)} aria-pressed={selectedSubject === ss.subject}
                    className={`px-[11px] py-[7px] rounded-full font-body font-extrabold text-[12.5px] leading-none ${selectedSubject === ss.subject ? "bg-primary text-primary-foreground" : "bg-muted text-text-secondary"}`}>
                    {ss.subject}
                  </button>
                ))}
              </div>
              {trendInsight && <p className="font-body font-bold text-[12.5px] leading-snug text-info">{trendInsight}</p>}
              <div className="flex-1 flex items-end gap-2.5 min-h-[120px]">
                {distributionLoading ? (
                  <div className="w-full flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : bellCurveData.map(b => (
                  <div key={b.bucket} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className={`font-heading font-black text-[13px] leading-none ${b.isMine ? "text-link" : "text-muted-foreground"}`}>{b.count}</span>
                    <div className={`w-full rounded-t-[9px] rounded-b ${b.isMine ? "bg-[#1268E8]" : "bg-muted"}`} style={{ height: Math.max(10, b.count / maxBucket * 110) }} title={b.isMine ? "הטווח שלך" : undefined} />
                    <span className="font-body font-bold text-[11.5px] leading-none text-muted-foreground" dir="ltr">{b.bucket.replace("מתחת ל-60", "<60").replace("90-100", "90+")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* All grades */}
          <div className="flex items-center justify-between px-1">
            <h2 className="font-heading font-black text-[17px] md:text-lg leading-none"><span className="md:hidden">אחרונים</span><span className="max-md:hidden">כל הציונים</span></h2>
            <span className="font-body font-bold text-[13px] leading-none text-hint">{grades.length} מטלות</span>
          </div>
          <div className="flex flex-col gap-2">
            {grades.map(g => {
              const diff = g.classAvg != null ? g.normalizedGrade - g.classAvg : null;
              return (
                <div key={g.id} className="grid grid-cols-[40px_minmax(0,1fr)_48px] md:grid-cols-[44px_minmax(0,1fr)_54px_80px_200px] items-center gap-3 md:gap-4 px-3.5 md:px-4 py-3 rounded-[20px] bg-card shadow-[0_8px_16px_-12px_rgba(40,30,15,.4)]">
                  <SubjectSticker subject={g.subject} size={42} />
                  <div className="flex flex-col gap-[5px] min-w-0">
                    <span className="font-heading font-extrabold text-[15px] md:text-[15.5px] leading-tight truncate">{g.title}</span>
                    <span className="font-body font-semibold text-[12.5px] leading-none text-muted-foreground truncate">
                      <span className="max-md:hidden">{g.subject} · </span>{TYPE_LABELS[g.type] || g.type} · {fmt(g.gradedAt)}
                      {g.classAvg != null && <span className="md:hidden"> · כיתה {g.classAvg}</span>}
                    </span>
                  </div>
                  <span className={`w-12 md:w-[54px] h-12 md:h-[46px] rounded-[15px] md:rounded-[14px] flex items-center justify-center font-heading font-black text-[21px] md:text-[22px] leading-none ${toneCls(g.normalizedGrade)}`}>{g.normalizedGrade}</span>
                  <div className="max-md:hidden flex flex-col gap-1">
                    <span className="font-body font-bold text-[11.5px] leading-none text-hint">כיתה</span>
                    <span className="font-heading font-extrabold text-[15px] leading-none">
                      {g.classAvg ?? "—"}{" "}
                      {diff !== null && <span className={`font-body text-[12.5px] ${diff >= 0 ? "text-success" : "text-destructive"}`}>{diff > 0 ? "+" : ""}{diff}</span>}
                    </span>
                  </div>
                  <div className="max-md:col-span-3 flex gap-1.5 justify-end">
                    {g.feedback && (
                      <button type="button" onClick={() => setFeedbackGrade(g)} className="px-3 py-[9px] rounded-xl bg-card border-[1.5px] border-input font-body font-extrabold text-[13px] leading-none whitespace-nowrap">משוב המורה</button>
                    )}
                    <button type="button" onClick={() => setAppealGrade(g)} className="px-3 py-[9px] rounded-xl text-text-secondary font-body font-extrabold text-[13px] leading-none whitespace-nowrap hover:bg-muted">ערעור</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Teacher feedback */}
      <Dialog open={!!feedbackGrade} onOpenChange={o => !o && setFeedbackGrade(null)}>
        <DialogContent className="rounded-[22px] max-w-md text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="font-heading font-black">משוב המורה · {feedbackGrade?.title}</DialogTitle>
          </DialogHeader>
          <p className="font-body text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">{feedbackGrade?.feedback}</p>
        </DialogContent>
      </Dialog>

      {/* Appeal */}
      <Dialog open={!!appealGrade} onOpenChange={o => !o && setAppealGrade(null)}>
        <DialogContent className="rounded-[22px] max-w-lg text-right gap-4" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="font-heading font-black text-xl">ערעור על ציון</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[14px] bg-soft">
            <span className="font-heading font-extrabold">{appealGrade?.title}</span>
            <span className={`px-3 py-2 rounded-xl font-heading font-black ${toneCls(appealGrade?.normalizedGrade ?? null)}`}>{appealGrade?.grade}/{appealGrade?.maxGrade}</span>
          </div>
          <Textarea
            value={appealText}
            onChange={e => setAppealText(e.target.value)}
            aria-label="נימוק הערעור"
            placeholder="למה לדעתך כדאי לבדוק שוב את הציון?"
            className="rounded-[14px] min-h-[140px] text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={() => setAppealGrade(null)} variant="ghost" className="flex-1 h-12 rounded-xl font-extrabold">ביטול</Button>
            <Button onClick={sendAppeal} disabled={sendingAppeal || !appealText.trim()} className="flex-1 h-12 rounded-xl font-extrabold gap-2">
              {sendingAppeal && <Loader2 className="h-5 w-5 animate-spin" />}
              שליחה למורה
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Score chip colors per the "Grades" design.
function toneCls(v: number | null): string {
  if (v == null) return "bg-muted text-muted-foreground";
  if (v >= 90) return "bg-success-soft text-success";
  if (v >= 75) return "bg-info-soft text-info";
  if (v >= 60) return "bg-warning-soft text-warning";
  return "bg-destructive-soft text-destructive";
}

export default StudentGradesPage;
