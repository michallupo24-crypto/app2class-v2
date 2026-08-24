import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, Plus, ChevronDown, ChevronUp, Check, X, Ban } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GRADES } from "@/lib/constants";
import { format } from "date-fns";

interface PaymentItem {
  id: string;
  grade: string | null;
  title: string;
  description: string | null;
  amount: number;
  due_date: string | null;
}
interface PaymentRecord {
  id: string;
  payment_item_id: string;
  student_id: string;
  status: "pending" | "paid" | "waived";
  payment_method: string | null;
}

const METHOD_LABELS: Record<string, string> = { cash: "מזומן", bit: "ביט", bank_transfer: "העברה בנקאית", other: "אחר" };

const FinanceHubPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isManagement = profile.roles.some((r) => ["management", "system_admin"].includes(r));
  const isParent = profile.roles.includes("parent") && !isManagement;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Staff: students-by-grade + records per item
  const [studentsByGrade, setStudentsByGrade] = useState<Record<string, { id: string; full_name: string }[]>>({});
  const [recordsByItem, setRecordsByItem] = useState<Record<string, PaymentRecord[]>>({});

  // Parent: children + their records
  const [children, setChildren] = useState<{ id: string; fullName: string; grade: string | null }[]>([]);
  const [myRecords, setMyRecords] = useState<PaymentRecord[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", amount: "", grade: "all", due_date: "" });

  const loadStaff = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("payment_items").select("*").eq("school_id", profile.schoolId).order("created_at", { ascending: false });
    const list: PaymentItem[] = data || [];
    setItems(list);

    if (list.length) {
      const { data: records } = await (supabase as any)
        .from("payment_records").select("*").in("payment_item_id", list.map((i) => i.id));
      const grouped: Record<string, PaymentRecord[]> = {};
      (records || []).forEach((r: PaymentRecord) => {
        grouped[r.payment_item_id] = grouped[r.payment_item_id] || [];
        grouped[r.payment_item_id].push(r);
      });
      setRecordsByItem(grouped);

      const grades = Array.from(new Set(list.map((i) => i.grade).filter(Boolean))) as string[];
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

  const loadParent = async () => {
    const { data: links } = await supabase.from("parent_student").select("student_id").eq("parent_id", profile.id);
    const studentIds = (links || []).map((l: any) => l.student_id);
    if (!studentIds.length) {
      setLoading(false);
      return;
    }
    const { data: kids } = await supabase.from("profiles").select("id, full_name, school_id, classes(grade)").in("id", studentIds);
    const kidsList = (kids || []).map((k: any) => ({ id: k.id, fullName: k.full_name, grade: k.classes?.grade || null }));
    setChildren(kidsList);

    const schoolIds = Array.from(new Set((kids || []).map((k: any) => k.school_id)));
    if (schoolIds.length) {
      const { data } = await supabase.from("payment_items").select("*").in("school_id", schoolIds as string[]);
      setItems(data || []);
    }
    const { data: records } = await (supabase as any).from("payment_records").select("*").in("student_id", studentIds);
    setMyRecords(records || []);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    if (isManagement) loadStaff();
    else if (isParent) loadParent();
    else setLoading(false);
  }, [profile.id, profile.schoolId]);

  const createItem = async () => {
    if (!form.title || !form.amount || !profile.schoolId) {
      toast({ title: "נא למלא כותרת וסכום", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("payment_items").insert({
      school_id: profile.schoolId,
      grade: form.grade === "all" ? null : (form.grade as any),
      title: form.title,
      description: form.description || null,
      amount: Number(form.amount),
      due_date: form.due_date || null,
      created_by: profile.id,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "פריט התשלום נוצר" });
    setDialogOpen(false);
    setForm({ title: "", description: "", amount: "", grade: "all", due_date: "" });
    loadStaff();
  };

  const markStatus = async (item: PaymentItem, studentId: string, status: "paid" | "pending" | "waived", method?: string) => {
    const existing = recordsByItem[item.id]?.find((r) => r.student_id === studentId);
    const payload: any = {
      payment_item_id: item.id, student_id: studentId, status,
      payment_method: method || null,
      paid_amount: status === "paid" ? item.amount : null,
      marked_by: profile.id,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    };
    const { error } = existing
      ? await (supabase as any).from("payment_records").update(payload).eq("id", existing.id)
      : await (supabase as any).from("payment_records").insert(payload);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    loadStaff();
  };

  if (!isManagement && !isParent) {
    return <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground"><p>עמוד זה מיועד להורים ולהנהלה בלבד</p></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" /> {isManagement ? "מרכז תשלומי הורים" : "התשלומים שלי"}
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {isManagement ? "מעקב גבייה - טיולים, ביטוח, ציוד. תשלום בפועל (מזומן/ביט/העברה) נגבה מחוץ למערכת." : "פירוט מה שולם ומה נותר לשלם"}
          </p>
        </div>
        {isManagement && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> פריט תשלום חדש</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">פריט תשלום חדש</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <Input placeholder="כותרת (למשל: טיול שנתי)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea placeholder="תיאור (אופציונלי)" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <Input type="number" placeholder="סכום (₪)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל בית הספר</SelectItem>
                    {GRADES.map((g) => <SelectItem key={g} value={g}>שכבה {g}׳</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">תאריך אחרון לתשלום (אופציונלי)</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <Button onClick={createItem} className="w-full">צור פריט</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-heading font-medium">אין עדיין פריטי תשלום</p>
        </CardContent></Card>
      ) : isManagement ? (
        <div className="space-y-3">
          {items.map((item) => {
            const students = item.grade ? studentsByGrade[item.grade] || [] : [];
            const records = recordsByItem[item.id] || [];
            const paidCount = records.filter((r) => r.status === "paid").length;
            const isOpen = expanded === item.id;
            return (
              <Card key={item.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-heading font-bold">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ₪{item.amount} · {item.grade ? `שכבה ${item.grade}׳` : "כל בית הספר"}
                        {item.due_date && ` · עד ${format(new Date(item.due_date), "dd/MM/yyyy")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{paidCount} / {students.length} שילמו</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(isOpen ? null : item.id)} className="gap-1">
                        פירוט {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t space-y-1.5">
                      {students.length === 0 && <p className="text-xs text-muted-foreground">לא נמצאו תלמידים בשכבה זו</p>}
                      {students.map((s) => {
                        const rec = records.find((r) => r.student_id === s.id);
                        const status = rec?.status || "pending";
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40">
                            <span className="text-sm font-body">{s.full_name}</span>
                            <div className="flex items-center gap-1.5">
                              {status === "paid" ? (
                                <Badge className="bg-success/10 text-success border-success/30">שולם{rec?.payment_method ? ` (${METHOD_LABELS[rec.payment_method]})` : ""}</Badge>
                              ) : status === "waived" ? (
                                <Badge variant="secondary">פטור</Badge>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => markStatus(item, s.id, "paid", "cash")}>
                                    <Check className="h-3 w-3" /> סמן ששולם
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 text-muted-foreground" onClick={() => markStatus(item, s.id, "waived")}>
                                    <Ban className="h-3 w-3" /> פטור
                                  </Button>
                                </>
                              )}
                              {status !== "pending" && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => markStatus(item, s.id, "pending")}>
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {children.map((child) => {
            const childItems = items.filter((i) => !i.grade || i.grade === child.grade);
            if (!childItems.length) return null;
            const owed = childItems.reduce((sum, i) => {
              const rec = myRecords.find((r) => r.payment_item_id === i.id && r.student_id === child.id);
              return rec?.status === "paid" || rec?.status === "waived" ? sum : sum + i.amount;
            }, 0);
            return (
              <Card key={child.id}>
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center justify-between">
                    <span>{child.fullName}</span>
                    <Badge variant={owed > 0 ? "destructive" : "secondary"}>{owed > 0 ? `נותר לשלם ₪${owed}` : "הכל שולם"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {childItems.map((i) => {
                    const rec = myRecords.find((r) => r.payment_item_id === i.id && r.student_id === child.id);
                    const status = rec?.status || "pending";
                    return (
                      <div key={i.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                        <div>
                          <p className="text-sm font-heading font-medium">{i.title}</p>
                          <p className="text-xs text-muted-foreground">₪{i.amount}{i.due_date && ` · עד ${format(new Date(i.due_date), "dd/MM/yyyy")}`}</p>
                        </div>
                        <Badge variant={status === "paid" ? "secondary" : status === "waived" ? "outline" : "destructive"}>
                          {status === "paid" ? "שולם" : status === "waived" ? "פטור" : "ממתין"}
                        </Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default FinanceHubPage;
