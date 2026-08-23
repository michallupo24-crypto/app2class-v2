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
import { Newspaper, Plus, Heart, Check, X, Clock } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Article {
  id: string;
  author_id: string;
  title: string;
  content: string;
  cover_image_url: string | null;
  category: string;
  status: "draft" | "published" | "rejected";
  likes: number;
  published_at: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  news: "חדשות", sports: "ספורט", culture: "תרבות", opinion: "דעות", council: "מהמועצה",
};

const NewspaperPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isStaff = profile.roles.some((r) => ["educator", "management", "system_admin", "counselor"].includes(r));

  const [articles, setArticles] = useState<Article[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"published" | "pending">("published");
  const [selected, setSelected] = useState<Article | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", cover_image_url: "", category: "news" });

  const load = async () => {
    setLoading(true);
    const query = tab === "published"
      ? (supabase as any).from("newspaper_articles").select("*").eq("status", "published").order("published_at", { ascending: false })
      : (supabase as any).from("newspaper_articles").select("*").eq("status", "draft").order("created_at", { ascending: false });

    const { data } = await query;
    const list: Article[] = data || [];
    setArticles(list);

    const authorIds = Array.from(new Set(list.map((a) => a.author_id)));
    if (authorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", authorIds);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => (map[p.id] = p.full_name));
      setAuthors(map);
    }

    const { data: likeRows } = await (supabase as any).from("newspaper_article_likes").select("article_id").eq("user_id", profile.id);
    setMyLikes(new Set((likeRows || []).map((l: any) => l.article_id)));

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tab, profile.id]);

  const submitArticle = async () => {
    if (!form.title || !form.content || !profile.schoolId) {
      toast({ title: "נא למלא כותרת ותוכן", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("newspaper_articles").insert({
      school_id: profile.schoolId,
      author_id: profile.id,
      title: form.title,
      content: form.content,
      cover_image_url: form.cover_image_url || null,
      category: form.category,
    });
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: "✅ הכתבה נשלחה לאישור המערכת" });
    setComposeOpen(false);
    setForm({ title: "", content: "", cover_image_url: "", category: "news" });
    if (tab === "pending") load();
  };

  const review = async (article: Article, approve: boolean) => {
    const { error } = await (supabase as any)
      .from("newspaper_articles")
      .update(approve ? { status: "published", published_at: new Date().toISOString() } : { status: "rejected" })
      .eq("id", article.id);
    if (error) return toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    toast({ title: approve ? "✅ הכתבה פורסמה" : "הכתבה נדחתה" });
    load();
  };

  const toggleLike = async (article: Article) => {
    const liked = myLikes.has(article.id);
    try {
      if (liked) {
        const { error: unlikeError } = await (supabase as any).from("newspaper_article_likes").delete().eq("article_id", article.id).eq("user_id", profile.id);
        if (unlikeError) throw unlikeError;
        const { error: updateError } = await (supabase as any).from("newspaper_articles").update({ likes: Math.max(0, article.likes - 1) }).eq("id", article.id);
        if (updateError) throw updateError;
      } else {
        const { error: likeError } = await (supabase as any).from("newspaper_article_likes").insert({ article_id: article.id, user_id: profile.id });
        if (likeError) throw likeError;
        const { error: updateError } = await (supabase as any).from("newspaper_articles").update({ likes: article.likes + 1 }).eq("id", article.id);
        if (updateError) throw updateError;
      }
      load();
      if (selected?.id === article.id) setSelected({ ...article, likes: article.likes + (liked ? -1 : 1) });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Newspaper className="h-7 w-7 text-primary" /> העיתון הדיגיטלי
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">חדשות, ספורט ותרבות - כתוב/כתבי על ידי התלמידים</p>
        </div>
        <div className="flex items-center gap-2">
          {isStaff && (
            <div className="flex rounded-lg border overflow-hidden">
              <button onClick={() => setTab("published")} className={`px-3 py-1.5 text-xs font-heading ${tab === "published" ? "bg-primary text-primary-foreground" : ""}`}>פורסמו</button>
              <button onClick={() => setTab("pending")} className={`px-3 py-1.5 text-xs font-heading ${tab === "pending" ? "bg-primary text-primary-foreground" : ""}`}>ממתינות לאישור</button>
            </div>
          )}
          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> כתבה חדשה</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-heading">כתיבת כתבה</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <Input placeholder="כותרת" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="קישור לתמונת נושא (אופציונלי)" value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
                <Textarea placeholder="תוכן הכתבה..." rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                <Button onClick={submitArticle} className="w-full">שלח/י לאישור</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : articles.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-heading font-medium">{tab === "published" ? "עדיין אין כתבות שפורסמו" : "אין כתבות הממתינות לאישור"}</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a) => (
            <Card key={a.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(a)}>
              {a.cover_image_url && <img src={a.cover_image_url} alt="" className="w-full h-36 object-cover" />}
              <CardContent className="p-4">
                <Badge variant="outline" className="text-[10px] mb-2">{CATEGORY_LABELS[a.category]}</Badge>
                <h3 className="font-heading font-bold text-sm line-clamp-2">{a.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] text-muted-foreground">{authors[a.author_id] || "תלמיד/ה"}</span>
                  {tab === "published" ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Heart className={`h-3 w-3 ${myLikes.has(a.id) ? "fill-destructive text-destructive" : ""}`} /> {a.likes}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" /> ממתין</span>
                  )}
                </div>
                {tab === "pending" && isStaff && (
                  <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="default" className="flex-1 gap-1" onClick={() => review(a, true)}><Check className="h-3 w-3" /> אשר ופרסם</Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => review(a, false)}><X className="h-3 w-3" /> דחה</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              {selected.cover_image_url && <img src={selected.cover_image_url} alt="" className="w-full h-48 object-cover rounded-lg" />}
              <DialogHeader>
                <Badge variant="outline" className="text-[10px] w-fit mb-1">{CATEGORY_LABELS[selected.category]}</Badge>
                <DialogTitle className="font-heading text-xl">{selected.title}</DialogTitle>
                <p className="text-xs text-muted-foreground">{authors[selected.author_id]} · {selected.published_at && format(new Date(selected.published_at), "dd/MM/yyyy")}</p>
              </DialogHeader>
              <p className="whitespace-pre-line text-sm leading-relaxed">{selected.content}</p>
              {tab === "published" && (
                <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => toggleLike(selected)}>
                  <Heart className={`h-4 w-4 ${myLikes.has(selected.id) ? "fill-destructive text-destructive" : ""}`} /> {selected.likes} אהבו
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default NewspaperPage;
