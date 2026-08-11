import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Plus, X, Loader2, User, History } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SlotRow {
  id: string;
  teacher_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  booked_by_parent_id: string | null;
  student_id: string | null;
  teacherName?: string;
  studentName?: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const MeetingSlotsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isEducator = profile.roles.includes("educator");

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [children, setChildren] = useState<{ id: string; fullName: string; classId: string | null }[]>([]);
  const [pastMeetings, setPastMeetings] = useState<SlotRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Educator: new slot form
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bookingChildFor, setBookingChildFor] = useState<Record<string, string>>({});

  const loadEducator = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("meeting_slots")
      .select("id, teacher_id, start_time, end_time, is_booked, booked_by_parent_id, student_id")
      .eq("teacher_id", profile.id)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true });
    const list: SlotRow[] = data || [];
    const studentIds = Array.from(new Set(list.filter((s) => s.student_id).map((s) => s.student_id as string)));
    let names: Record<string, string> = {};
    if (studentIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
      (profs || []).forEach((p: any) => { names[p.id] = p.full_name; });
    }
    setSlots(list.map((s) => ({ ...s, studentName: s.student_id ? names[s.student_id] : undefined })));
    setLoading(false);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data } = await (supabase as any)
      .from("meeting_slots")
      .select("id, teacher_id, start_time, end_time, is_booked, booked_by_parent_id, student_id")
      .eq(isEducator ? "teacher_id" : "booked_by_parent_id", profile.id)
      .eq("is_booked", true)
      .lt("start_time", new Date().toISOString())
      .order("start_time", { ascending: false })
      .limit(30);
    const list: SlotRow[] = data || [];
    const studentIds = Array.from(new Set(list.filter((s) => s.student_id).map((s) => s.student_id as string)));
    let names: Record<string, string> = {};
    if (studentIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
      (profs || []).forEach((p: any) => { names[p.id] = p.full_name; });
    }
    setPastMeetings(list.map((s) => ({ ...s, studentName: s.student_id ? names[s.student_id] : undefined })));
    setLoadingHistory(false);
  };

  const loadParent = async () => {
    setLoading(true);
    const { data: links } = await supabase.from("parent_student").select("student_id").eq("parent_id", profile.id);
    const studentIds = (links || []).map((l: any) => l.student_id);
    if (studentIds.length === 0) { setSlots([]); setChildren([]); setLoading(false); return; }

    const { data: profs } = await supabase.from("profiles").select("id, full_name, class_id").in("id", studentIds);
    const kids = (profs || []).map((p: any) => ({ id: p.id, fullName: p.full_name, classId: p.class_id }));
    setChildren(kids);

    const classIds = kids.map((k) => k.classId).filter(Boolean) as string[];
    let teacherIds: string[] = [];
    let teacherNames: Record<string, string> = {};
    if (classIds.length > 0) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, homeroom_class_id")
        .eq("role", "educator")
        .in("homeroom_class_id", classIds);
      teacherIds = (roles || []).map((r: any) => r.user_id);
      if (teacherIds.length > 0) {
        const { data: teacherProfs } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);
        (teacherProfs || []).forEach((p: any) => { teacherNames[p.id] = p.full_name; });
      }
    }

    const { data: openData } = teacherIds.length > 0
      ? await (supabase as any).from("meeting_slots").select("id, teacher_id, start_time, end_time, is_booked, booked_by_parent_id, student_id")
          .in("teacher_id", teacherIds).eq("is_booked", false).gte("start_time", new Date().toISOString()).order("start_time", { ascending: true })
      : { data: [] };
    const { data: mineData } = await (supabase as any).from("meeting_slots").select("id, teacher_id, start_time, end_time, is_booked, booked_by_parent_id, student_id")
      .eq("booked_by_parent_id", profile.id).order("start_time", { ascending: true });

    const combined: SlotRow[] = [...(openData || []), ...(mineData || [])]
      .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
      .map((s: any) => ({ ...s, teacherName: teacherNames[s.teacher_id], studentName: kids.find((k) => k.id === s.student_id)?.fullName }));
    setSlots(combined);
    setLoading(false);
  };

  useEffect(() => {
    if (isEducator) loadEducator(); else loadParent();
  }, [profile.id, isEducator]);

  const createSlot = async () => {
    if (!newDate || !newStart || !newEnd || !profile.schoolId) return;
    setCreating(true);
    try {
      const { data: myProfile } = await supabase.from("profiles").select("class_id").eq("id", profile.id).single();
      const { error } = await (supabase as any).from("meeting_slots").insert({
        teacher_id: profile.id,
        school_id: profile.schoolId,
        class_id: myProfile?.class_id || null,
        start_time: new Date(`${newDate}T${newStart}`).toISOString(),
        end_time: new Date(`${newDate}T${newEnd}`).toISOString(),
      });
      if (error) throw error;
      toast({ title: "המשבצת נוספה ✅" });
      setNewDate(""); setNewStart(""); setNewEnd("");
      loadEducator();
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const deleteSlot = async (id: string) => {
    setProcessingId(id);
    await supabase.from("meeting_slots").delete().eq("id", id);
    setSlots((prev) => prev.filter((s) => s.id !== id));
    setProcessingId(null);
  };

  const cancelSlot = async (id: string) => {
    setProcessingId(id);
    const { error } = await (supabase as any).rpc("cancel_meeting_slot", { p_slot_id: id });
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else { toast({ title: "הפגישה בוטלה" }); isEducator ? loadEducator() : loadParent(); }
    setProcessingId(null);
  };

  const bookSlot = async (id: string) => {
    const childId = bookingChildFor[id] || children[0]?.id;
    if (!childId) return;
    setProcessingId(id);
    const { error } = await (supabase as any).rpc("book_meeting_slot", { p_slot_id: id, p_student_id: childId });
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else { toast({ title: "הפגישה נקבעה ✅" }); loadParent(); }
    setProcessingId(null);
  };

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <CalendarClock className="h-7 w-7 text-primary" />פגישות הורים
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          {isEducator ? "פרסם/י משבצות פנויות לפגישה עם הורים" : "קביעת פגישה עם מחנך/ת הכיתה"}
        </p>
        <Button
          variant="ghost" size="sm" className="gap-1.5 text-xs mt-2"
          onClick={() => { setShowHistory((v) => !v); if (!showHistory && pastMeetings.length === 0) loadHistory(); }}
        >
          <History className="h-3.5 w-3.5" />
          {showHistory ? "הסתר יומן פגישות" : "הצג יומן פגישות קודמות"}
        </Button>
      </motion.div>

      {showHistory && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">יומן פגישות קודמות</CardTitle></CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : pastMeetings.length === 0 ? (
                <p className="text-xs text-muted-foreground font-body text-center py-4">אין פגישות קודמות</p>
              ) : (
                <div className="space-y-1.5">
                  {pastMeetings.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                      <span className="font-body">{fmt(m.start_time)}</span>
                      {m.studentName && <Badge variant="outline" className="text-[10px]">{m.studentName}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isEducator && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">הוספת משבצת פנויה</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-body">תאריך</label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-body">שעת התחלה</label>
                <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-28" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-body">שעת סיום</label>
                <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-28" />
              </div>
              <Button size="sm" className="gap-1 font-heading" onClick={createSlot} disabled={creating || !newDate || !newStart || !newEnd}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}הוסף
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : slots.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground font-body">אין משבצות זמינות כרגע</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {slots.map((s) => (
            <motion.div key={s.id} variants={item}>
              <Card>
                <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-heading font-medium">{fmt(s.start_time)} - {new Date(s.end_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</p>
                      {!isEducator && s.teacherName && <p className="text-[11px] text-muted-foreground">{s.teacherName}</p>}
                      {s.is_booked && s.studentName && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{s.studentName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.is_booked ? (
                      <>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">נקבעה</Badge>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => cancelSlot(s.id)} disabled={processingId === s.id}>
                          <X className="h-3 w-3" />בטל
                        </Button>
                      </>
                    ) : isEducator ? (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-destructive border-destructive/30" onClick={() => deleteSlot(s.id)} disabled={processingId === s.id}>
                        <X className="h-3 w-3" />מחק
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {children.length > 1 && (
                          <Select value={bookingChildFor[s.id] || children[0]?.id} onValueChange={(v) => setBookingChildFor((prev) => ({ ...prev, [s.id]: v }))}>
                            <SelectTrigger className="h-7 text-[11px] w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {children.map((c) => <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        <Button size="sm" className="h-7 text-[11px] font-heading" onClick={() => bookSlot(s.id)} disabled={processingId === s.id}>
                          קבע פגישה
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default MeetingSlotsPage;
