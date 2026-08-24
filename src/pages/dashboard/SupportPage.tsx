import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LifeBuoy, Plus, ChevronDown, ChevronUp, Search, Bug, HelpCircle, User as UserIcon, MoreHorizontal, Check } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}
interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  status: "open" | "in_progress" | "resolved";
  admin_notes: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  registration: "רישום", general: "כללי", bug: "באג", question: "שאלה", account: "חשבון", other: "אחר",
};
const CATEGORY_ICONS: Record<string, any> = { bug: Bug, question: HelpCircle, account: UserIcon, other: MoreHorizontal };
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "נפתחה", color: "bg-info/10 text-info border-info/30" },
  in_progress: { label: "בטיפול", color: "bg-warning/10 text-warning border-warning/30" },
  resolved: { label: "נפתרה", color: "bg-success/10 text-success border-success/30" },
};

const SupportPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isManagement = profile.roles.some((r) => ["management", "system_admin"].includes(r));

  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [ticketAuthors, setTicketAuthors] = useState<Record<string, string>>({});
  const [showAllTickets, setShowAllTickets] = useState(false);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", category: "question" });

  const load = async () => {
    setLoading(true);
    const [faqRes, myRes] = await Promise.all([
      (supabase as any).from("faq_items").select("id, category, question, answer").order("order_index"),
      (supabase as any).from("support_tickets").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }),
    ]);
    setFaqs(faqRes.data || []);
    setMyTickets(myRes.data || []);

    if (isManagement && profile.schoolId) {
      const { data } = await (supabase as any)
        .from("support_tickets").select("*").eq("school_id", profile.schoolId).order("created_at", { ascending: false });
      const list: Ticket[] = data || [];
      setAllTickets(list);
      const userIds = Array.from(new Set(list.map((t) => t.user_id)));
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => (map[p.id] = p.full_name));
        setTicketAuthors(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile.id, profile.schoolId]);

  const submitTicket = async () => {
    if (!form.subject || !form.description) {
      toast({ title: "נא למלא נושא ותיאור", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("support_tickets").insert({
      school_id: profile.schoolId,
      user_id: profile.id,
      subject: form.subject,
      description: form.description,
      category: form.category,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "הפנייה נשלחה" });
    setDialogOpen(false);
    setForm({ subject: "", description: "", category: "question" });
    load();
  };

  const resolveTicket = async (ticket: Ticket, status: "in_progress" | "resolved") => {
    const { error } = await (supabase as any)
      .from("support_tickets")
      .update({ status, resolved_by: status === "resolved" ? profile.id : null, resolved_at: status === "resolved" ? new Date().toISOString() : null })
      .eq("id", ticket.id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    load();
  };

  const filteredFaqs = faqs.filter((f) => !search || f.question.includes(search) || f.answer.includes(search));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <LifeBuoy className="h-7 w-7 text-primary" /> עזרה ותמיכה
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">שאלות נפוצות ופנייה ישירה לצוות</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> פתח פנייה</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">פנייה חדשה</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">באג / תקלה</SelectItem>
                  <SelectItem value="question">שאלה</SelectItem>
                  <SelectItem value="account">בעיית חשבון</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="נושא" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              <Textarea placeholder="תארו מה קרה או במה תרצו עזרה..." rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Button onClick={submitTicket} className="w-full">שלח פנייה</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pr-10" placeholder="חפש בשאלות נפוצות..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div>
        <h2 className="font-heading font-bold text-lg mb-3">שאלות נפוצות</h2>
        <div className="space-y-2">
          {filteredFaqs.length === 0 && <p className="text-sm text-muted-foreground">לא נמצאו תוצאות</p>}
          {filteredFaqs.map((f) => (
            <Card key={f.id} className="cursor-pointer" onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-heading font-medium">{f.question}</p>
                  {openFaq === f.id ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </div>
                {openFaq === f.id && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{f.answer}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-heading font-bold text-lg mb-3">הפניות שלי</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">טוען...</p>
        ) : myTickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">עדיין לא פתחת פניות</p>
        ) : (
          <div className="space-y-2">
            {myTickets.map((t) => {
              const Icon = CATEGORY_ICONS[t.category] || MoreHorizontal;
              const statusConf = STATUS_LABELS[t.status];
              return (
                <Card key={t.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-medium truncate">{t.subject}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(t.created_at), "dd/MM/yyyy")}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusConf.color}>{statusConf.label}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {isManagement && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-lg">כל הפניות בבית הספר</h2>
            <Button size="sm" variant="ghost" onClick={() => setShowAllTickets(!showAllTickets)}>
              {showAllTickets ? "הסתר" : "הצג"} ({allTickets.filter((t) => t.status !== "resolved").length} פתוחות)
            </Button>
          </div>
          {showAllTickets && (
            <div className="space-y-2">
              {allTickets.length === 0 && <p className="text-sm text-muted-foreground">אין פניות</p>}
              {allTickets.map((t) => {
                const statusConf = STATUS_LABELS[t.status];
                return (
                  <Card key={t.id}>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-heading font-medium">{t.subject}</p>
                          <p className="text-[11px] text-muted-foreground">{ticketAuthors[t.user_id] || "משתמש/ת"} · {CATEGORY_LABELS[t.category]}</p>
                        </div>
                        <Badge variant="outline" className={statusConf.color}>{statusConf.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      {t.status !== "resolved" && (
                        <div className="flex gap-2">
                          {t.status === "open" && (
                            <Button size="sm" variant="outline" onClick={() => resolveTicket(t, "in_progress")}>קבל טיפול</Button>
                          )}
                          <Button size="sm" className="gap-1" onClick={() => resolveTicket(t, "resolved")}>
                            <Check className="h-3.5 w-3.5" /> סמן כנפתרה
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default SupportPage;
