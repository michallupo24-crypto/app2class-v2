import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Archive, Plus, FileText, Download, Trash2, Loader2, Search } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SUBJECTS, GRADES } from "@/lib/constants";

interface ExamEntry {
  id: string;
  subject: string;
  grade: string | null;
  year: number | null;
  title: string;
  topic: string | null;
  file_url: string;
  uploaded_by: string;
}

const ExamArchivePage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const canUpload = profile.roles.some((r) =>
    ["professional_teacher", "subject_coordinator", "grade_coordinator", "management", "system_admin"].includes(r)
  );

  const [entries, setEntries] = useState<ExamEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ subject: SUBJECTS[0] as string, grade: "none", year: "", title: "", topic: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("exam_archive").select("*").eq("school_id", profile.schoolId).order("year", { ascending: false });
    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile.schoolId]);

  const upload = async () => {
    if (!file || !form.title || !profile.schoolId) {
      toast({ title: "נא לבחור קובץ ולמלא כותרת", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `exam-archive/${profile.schoolId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("lesson-files").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("lesson-files").getPublicUrl(path);

      const { error } = await (supabase as any).from("exam_archive").insert({
        school_id: profile.schoolId,
        subject: form.subject,
        grade: form.grade === "none" ? null : form.grade,
        year: form.year ? Number(form.year) : null,
        title: form.title,
        topic: form.topic || null,
        file_url: urlData.publicUrl,
        uploaded_by: profile.id,
      });
      if (error) throw error;

      toast({ title: "✅ המבחן נוסף לארכיון" });
      setDialogOpen(false);
      setForm({ subject: SUBJECTS[0], grade: "none", year: "", title: "", topic: "" });
      setFile(null);
      load();
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("exam_archive").delete().eq("id", id);
    if (error) {
      toast({ title: "שגיאה במחיקה", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const filtered = entries.filter(
    (e) => (subjectFilter === "all" || e.subject === subjectFilter) && (!search || e.title.includes(search) || (e.topic || "").includes(search))
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Archive className="h-7 w-7 text-primary" /> ארכיון מבחנים ובגרויות
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">מבחנים אמיתיים מהעבר, מסודרים לפי מקצוע ושנה</p>
        </div>
        {canUpload && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> העלה מבחן</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">העלאת מבחן לארכיון</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                    <SelectTrigger><SelectValue placeholder="שכבה" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">כלל השכבות</SelectItem>
                      {GRADES.map((g) => <SelectItem key={g} value={g}>{g}׳</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="שנה (2023)" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                </div>
                <Input placeholder="כותרת (למשל: בגרות קיץ תשפ״ג מועד א׳)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Input placeholder="נושאים (אופציונלי, מופרד בפסיקים)" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
                <Input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <Button onClick={upload} className="w-full gap-2" disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {uploading ? "מעלה..." : "העלה לארכיון"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל המקצועות</SelectItem>
            {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pr-10" placeholder="חיפוש לפי כותרת/נושא..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-heading font-medium">הארכיון עדיין ריק</p>
          {canUpload && <p className="text-xs mt-1">היו הראשונים להעלות מבחן!</p>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-heading font-bold truncate">{e.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <Badge variant="outline" className="text-[10px]">{e.subject}</Badge>
                      {e.grade && <Badge variant="outline" className="text-[10px]">שכבה {e.grade}׳</Badge>}
                      {e.year && <Badge variant="outline" className="text-[10px]">{e.year}</Badge>}
                    </div>
                    {e.topic && <p className="text-[11px] text-muted-foreground mt-1">{e.topic}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" asChild>
                    <a href={e.file_url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /> פתח</a>
                  </Button>
                  {(e.uploaded_by === profile.id || profile.roles.some((r) => ["management", "system_admin"].includes(r))) && (
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ExamArchivePage;
