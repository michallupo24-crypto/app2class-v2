import { useState, useRef, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Brain, Send, Sparkles, BookOpen, FileText, Calendar,
  Zap, Target, ChevronDown, ChevronUp, Loader2, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { UserProfile } from "@/hooks/useAuth";
import { useStudentSubjects } from "@/hooks/useStudentSubjects";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  { label: "סכם שיעור", icon: FileText, prompt: "תסכם לי את הנושא האחרון בצורה מסודרת" },
  { label: "תוכנית מבחן", icon: Calendar, prompt: "עזור לי לבנות תוכנית לימודים למבחן" },
  { label: "הסבר מושג", icon: BookOpen, prompt: "הסבר לי מושג שאני לא מבין" },
  { label: "בדוק תשובה", icon: Sparkles, prompt: "בדוק לי תשובה שכתבתי" },
];

const AITutorPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const isStudent = profile.roles.includes("student");
  const { subjects: mySubjects, trackNames } = useStudentSubjects(
    isStudent ? profile.id : undefined,
    profile.schoolId
  );

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Chat History
  const [sessions, setSessions] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Load chat history
  useEffect(() => {
    if (!isStudent || !profile.id) return;
    const fetchSessions = async () => {
      const { data } = await supabase.from('ai_chat_sessions').select('id, title, created_at').eq('student_id', profile.id).order('updated_at', { ascending: false });
      if (data) setSessions(data);
    };
    fetchSessions();
  }, [profile.id, isStudent]);

  const startNewChat = () => {
    setIsLoading(false);
    setMessages([]);
    setActiveSessionId(null);
    setIsSidebarOpen(false);
  };

  const loadSession = async (id: string) => {
    setActiveSessionId(id);
    setMessages([]);
    setIsLoading(true);
    setIsSidebarOpen(false);
    const { data } = await supabase.from('ai_chat_messages').select('role, content').eq('session_id', id).order('created_at', { ascending: true });
    if (data) setMessages(data as Msg[]);
    setIsLoading(false);
  };

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let currentSessionId = activeSessionId;
    if (!currentSessionId && isStudent) {
      const { data } = await supabase.from('ai_chat_sessions').insert({ student_id: profile.id, title: text.slice(0, 30) }).select('id').single();
      if (data) {
        currentSessionId = data.id;
        setActiveSessionId(data.id);
        setSessions(prev => [{ id: data.id, title: text.slice(0, 30), created_at: new Date().toISOString() }, ...prev]);
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke("ai-tutor", {
        body: { messages: newMessages, studentId: profile.id },
      });
      if (error) throw error;
      const replyText: string = data?.response || data?.error || "לא הצלחתי לענות כרגע, נסה שוב";
      setMessages(prev => [...prev, { role: "assistant", content: replyText }]);
      if (currentSessionId && isStudent) {
        const { error: historyError } = await supabase.from('ai_chat_messages').insert({ session_id: currentSessionId, role: "assistant", content: replyText });
        if (historyError) console.error("Failed to save chat history:", historyError);
      }
    } catch (e: any) {
      toast.error(e.message || "שגיאה בחיבור ל-AI");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)] max-w-3xl mx-auto rounded-3xl overflow-hidden bg-background border shadow-2xl relative">
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold">C.H.E.E.S.E.</h1>
            <p className="text-[10px] text-muted-foreground font-black">AI TUTOR ACTIVE</p>
          </div>
        </div>
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild><Button variant="ghost" size="sm">היסטוריה</Button></SheetTrigger>
          <SheetContent>
            <SheetHeader><SheetTitle>שיחות אחרונות</SheetTitle></SheetHeader>
            <div className="mt-4 space-y-2">
              {sessions.map(s => <button key={s.id} onClick={() => loadSession(s.id)} className={cn("w-full text-right p-3 rounded-lg border text-sm", activeSessionId === s.id ? "bg-indigo-600 text-white" : "")}>{s.title}</button>)}
              <Button onClick={startNewChat} className="w-full mt-4">שיחה חדשה</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl">
              <Brain className="h-12 w-12 text-white" />
            </div>
            <h2 className="font-heading text-2xl font-black tracking-tight">היי {profile.fullName.split(" ")[0]}!</h2>
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              {QUICK_PROMPTS.map(qp => (
                <button key={qp.label} onClick={() => send(qp.prompt)} className="p-4 rounded-3xl border bg-card hover:bg-muted transition-all text-center flex flex-col items-center gap-2">
                  <qp.icon className="h-5 w-5 text-indigo-500" />
                  <span className="text-xs font-bold">{qp.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <Card className={cn("max-w-[85%] px-5 py-3 rounded-3xl", msg.role === "user" ? "bg-indigo-600 text-white" : "bg-muted/30")}>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </Card>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-background border-t">
        <div className="flex gap-2 items-end relative">
          <Textarea
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send(input))}
            placeholder="שאל אותי משהו..." className="resize-none min-h-[60px] max-h-[150px] rounded-3xl bg-muted/40 border-none pr-14" disabled={isLoading}
          />
          <Button size="icon" className="absolute left-3 bottom-2.5 h-10 w-10 rounded-2xl bg-indigo-600" onClick={() => send(input)} disabled={!input.trim() || isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AITutorPage;
