
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Send,
  Pin,
  Trash2,
  MessageCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AvatarPreview from "@/components/avatar/AvatarPreview";

interface ClassMessage {
  id: string;
  class_id: string;
  author_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  author_name: string;
  author_avatar: any;
}

const FACE_TO_BODY: Record<string, string> = {
  round: "basic", oval: "basic", square: "wider", long: "taller",
  basic: "basic", wider: "wider", taller: "taller",
};

const ClassMessenger = ({ classId, userId, isTeacher }: { classId: string; userId: string; isTeacher: boolean }) => {
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const loadMessages = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data: posts, error } = await supabase
        .from("class_announcements")
        .select("id, class_id, author_id, content, is_pinned, created_at")
        .eq("class_id", classId)
        .eq("is_removed", false)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const authorIds = [...new Set((posts || []).map((p) => p.author_id))];
      const nameById = new Map<string, string>();
      const avatarById = new Map<string, any>();
      if (authorIds.length > 0) {
        const [{ data: profs }, { data: avatars }] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", authorIds),
          // avatars.user_id -> auth.users, no FK to profiles for PostgREST to embed - fetch separately
          supabase.from("avatars").select("user_id, face_shape, eye_color, skin_color, hair_style, hair_color").in("user_id", authorIds),
        ]);
        for (const p of profs || []) nameById.set(p.id, p.full_name);
        for (const a of avatars || []) avatarById.set(a.user_id, a);
      }

      setMessages((posts || []).map((p) => {
        const av = avatarById.get(p.author_id);
        return {
          id: p.id,
          class_id: p.class_id,
          author_id: p.author_id,
          content: p.content,
          is_pinned: p.is_pinned,
          created_at: p.created_at,
          author_name: nameById.get(p.author_id) || "מורה",
          author_avatar: av ? {
            body_type: FACE_TO_BODY[av.face_shape] || "basic",
            eye_color: av.eye_color || "brown",
            skin: av.skin_color || "#FDDBB4",
            hair_style: av.hair_style || "boy",
            hair_color: av.hair_color || "#2C1A0E",
          } : null,
        };
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [classId]);

  const postMessage = async () => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from("class_announcements").insert({
        class_id: classId,
        author_id: userId,
        content: newMsg,
      });
      if (error) throw error;
      setNewMsg("");
      await loadMessages();
      toast({ title: "ההודעה פורסמה לכל הכיתה!" });
    } catch (e: any) {
      toast({ title: "שגיאה בפרסום", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const togglePin = async (msgId: string, currentStatus: boolean) => {
      const { error } = await supabase.from("class_announcements").update({ is_pinned: !currentStatus }).eq("id", msgId);
      if (error) {
        toast({ title: "שגיאה בעדכון הנעיצה", variant: "destructive" });
        return;
      }
      loadMessages();
  };

  const deleteMessage = async (msgId: string) => {
      const { error } = await supabase.from("class_announcements").update({ is_removed: true }).eq("id", msgId);
      if (error) {
        toast({ title: "שגיאה במחיקת ההודעה", variant: "destructive" });
        return;
      }
      loadMessages();
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="border border-border bg-card overflow-hidden">
      <CardHeader className="p-5 border-b border-border bg-muted/50">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-primary" />
               </div>
               <div>
                  <CardTitle className="text-sm font-heading font-black">לוח הודעות כיתתי</CardTitle>
                  <CardDescription className="text-[10px] font-medium">עדכונים רשמיים ונושאים לדיון</CardDescription>
               </div>
            </div>
            {isTeacher && (
               <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] px-2">ניהול מורה</Badge>
            )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col h-[450px]">
           <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              <AnimatePresence initial={false}>
                 {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-30">
                       <MessageCircle className="h-12 w-12 mb-2" />
                       <p className="text-sm font-medium">עדיין אין הודעות בכיתה</p>
                    </div>
                 ) : (
                    messages.map((m, idx) => (
                       <motion.div
                         key={m.id}
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ delay: idx * 0.05 }}
                         className={`relative p-4 rounded-lg border transition-all ${
                            m.is_pinned ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-card border-border shadow-sm hover:shadow-md'
                         }`}
                       >
                          {m.is_pinned && (
                             <div className="absolute -left-1 -top-1 bg-primary text-white p-1 rounded-lg">
                                <Pin className="h-3 w-3" />
                             </div>
                          )}
                          <div className="flex items-start gap-3">
                             {m.author_avatar ? (
                                <AvatarPreview config={m.author_avatar} size={36} />
                             ) : (
                                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center text-sm">👤</div>
                             )}
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                   <p className="text-xs font-heading font-black text-foreground">{m.author_name}</p>
                                   <span className="text-[9px] text-muted-foreground font-medium">
                                      {new Date(m.created_at).toLocaleDateString('he-IL')} • {new Date(m.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                   </span>
                                </div>
                                <p className="text-sm text-foreground font-medium leading-relaxed whitespace-pre-wrap">{m.content}</p>

                                {isTeacher && (
                                   <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                                      <Button variant="ghost" size="sm" onClick={() => togglePin(m.id, m.is_pinned)} className="h-7 px-2 text-[10px] gap-1 hover:text-primary">
                                         <Pin className="h-3 w-3" /> {m.is_pinned ? 'בטל נעילה' : 'נעץ הודעה'}
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => deleteMessage(m.id)} className="h-7 px-2 text-[10px] gap-1 text-destructive hover:bg-destructive/10">
                                         <Trash2 className="h-3 w-3" /> מחק
                                      </Button>
                                   </div>
                                )}
                             </div>
                          </div>
                       </motion.div>
                    ))
                 )}
              </AnimatePresence>
           </div>

           {/* Input Area */}
           {isTeacher ? (
              <div className="p-4 bg-muted/50 border-t border-border">
                 <div className="relative">
                    <Textarea
                       value={newMsg}
                       onChange={(e) => setNewMsg(e.target.value)}
                       placeholder="כתוב הודעה לכיתה..."
                       className="min-h-[80px] rounded-lg bg-card border-border focus:ring-primary/20 pr-4 pt-3 text-sm resize-none shadow-sm"
                    />
                    <div className="flex items-center justify-end mt-3">
                       <Button
                         onClick={postMessage}
                         disabled={!newMsg.trim() || sending}
                         className="rounded-xl h-9 px-6 font-bold gap-2"
                       >
                          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          שלח הודעה
                       </Button>
                    </div>
                 </div>
              </div>
           ) : (
             <div className="p-4 bg-primary/5 border-t border-primary/10 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-primary" />
                <p className="text-[10px] font-bold text-primary">רק מורים יכולים לפרסם הודעות בלוח זה. התלמידים וההורים יכולים לקרוא ולהתעדכן בלבד.</p>
             </div>
           )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ClassMessenger;
