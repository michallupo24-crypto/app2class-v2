import { useState, useEffect } from "react";
import { Code2, Sparkles, BookOpen, Save, Loader2, Layers, BarChart3, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import StudioModeWrapper from "./StudioModeWrapper";
import ClassLoadMeter from "./ClassLoadMeter";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MonacoCodeEditor } from "./ide/MonacoCodeEditor";
import { LivePreviewPanel } from "./ide/LivePreviewPanel";
import { LibrarySelectorModal } from "./ide/LibrarySelectorModal";
import { AIAssistantModal } from "./ide/AIAssistantModal";
import { CommunityGallery } from "./ide/CommunityGallery";
import { TeacherAnalyticsDashboard } from "./ide/TeacherAnalyticsDashboard";
import { buildSandboxHtml } from "./ide/sandboxBuilder";
import type { TaskLanguage, TaskMode, ConsoleLog, InteractiveTask } from "./ide/types";

interface Props {
  profile: UserProfile;
  assignmentId: string | null;
  onBack: () => void;
  initialGeneratedCode?: { title?: string; description?: string; htmlCode?: string; cssCode?: string; jsCode?: string } | null;
  onConsumedInitialCode?: () => void;
}

const SUBJECTS = ["מתמטיקה", "מדעי המחשב", "פיזיקה", "ביולוגיה", "היסטוריה/אזרחות", "אנגלית", "לשון", "כללי"];

type PanelView = "editor" | "gallery" | "analytics";

const InteractiveTaskBuilderMode = ({ profile, assignmentId, onBack, initialGeneratedCode, onConsumedInitialCode }: Props) => {
  const { toast } = useToast();

  const [taskId, setTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState("משימה אינטראקטיבית חדשה");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("מתמטיקה");
  const [language, setLanguage] = useState<TaskLanguage>("web");
  const [taskMode, setTaskMode] = useState<TaskMode>("consume");
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");
  const [pythonCode, setPythonCode] = useState("");
  const [libraries, setLibraries] = useState<string[]>(["tailwindcss"]);
  const [forkedFrom, setForkedFrom] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [debouncedSrcDoc, setDebouncedSrcDoc] = useState("");

  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>("editor");
  const [galleryTasks, setGalleryTasks] = useState<InteractiveTask[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Load existing interactive task for this assignment, if any, + the assignment's class
  useEffect(() => {
    if (!assignmentId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const [{ data }, { data: assignment }] = await Promise.all([
        supabase.from("interactive_tasks").select("*").eq("assignment_id", assignmentId).maybeSingle(),
        supabase.from("assignments").select("class_id").eq("id", assignmentId).maybeSingle(),
      ]);

      setClassId(assignment?.class_id || null);

      if (data) {
        setTaskId(data.id);
        setTitle(data.title);
        setDescription(data.description || "");
        setSubject(data.subject || "מתמטיקה");
        setLanguage((data.language as TaskLanguage) || "web");
        setTaskMode((data.mode as TaskMode) || "consume");
        setHtmlCode(data.html_code || "");
        setCssCode(data.css_code || "");
        setJsCode(data.js_code || "");
        setPythonCode(data.python_code || "");
        setLibraries(data.libraries || []);
        setForkedFrom(data.forked_from);
      }
      setLoading(false);
    };
    load();
  }, [assignmentId]);

  // Debounced compile -> live preview iframe
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSrcDoc(buildSandboxHtml({ language, htmlCode, cssCode, jsCode, pythonCode, libraries }));
    }, 500);
    return () => clearTimeout(timer);
  }, [language, htmlCode, cssCode, jsCode, pythonCode, libraries]);

  // Author-mode console log capture from the preview iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object" || data.type !== "console-log") return;
      setConsoleLogs((prev) => [
        ...prev,
        { id: `log-${Date.now()}-${Math.random()}`, level: data.level || "log", args: data.args || [], timestamp: data.timestamp || new Date().toISOString(), line: data.line },
      ]);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleToggleLibrary = (libId: string) => {
    setLibraries((prev) => (prev.includes(libId) ? prev.filter((id) => id !== libId) : [...prev, libId]));
  };

  const handleInsertCodeSample = (snippet: string) => {
    if (language === "python") {
      setPythonCode((prev) => `${prev}\n\n# --- דוגמת קוד מספרייה ---\n${snippet}`);
    } else {
      setJsCode((prev) => `${prev}\n\n// --- דוגמת קוד מספרייה ---\n${snippet}`);
    }
  };

  const handleApplyGeneratedCode = (generated: {
    title?: string; description?: string; htmlCode?: string; cssCode?: string; jsCode?: string; pythonCode?: string; libraries?: string[];
  }) => {
    if (generated.title) setTitle(generated.title);
    if (generated.description) setDescription(generated.description);
    if (generated.htmlCode !== undefined) setHtmlCode(generated.htmlCode);
    if (generated.cssCode !== undefined) setCssCode(generated.cssCode);
    if (generated.jsCode !== undefined) setJsCode(generated.jsCode);
    if (generated.pythonCode !== undefined) setPythonCode(generated.pythonCode);
    if (generated.libraries) setLibraries(generated.libraries);
  };

  // Code handed off from the AI Prompt Builder mode (pasted from an external
  // AI chat) - applied once, then the parent clears it so re-entering this
  // mode later doesn't silently overwrite in-progress edits.
  useEffect(() => {
    if (initialGeneratedCode) {
      handleApplyGeneratedCode(initialGeneratedCode);
      onConsumedInitialCode?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGeneratedCode]);

  const performSave = async () => {
    if (!assignmentId) {
      toast({ variant: "destructive", title: "בחר משימה קודם" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        assignment_id: assignmentId,
        author_id: profile.id,
        school_id: profile.schoolId || null,
        title,
        description,
        subject,
        language: taskMode === "solve" ? "python" : language,
        mode: taskMode,
        html_code: htmlCode,
        css_code: cssCode,
        js_code: jsCode,
        python_code: pythonCode,
        libraries,
        forked_from: forkedFrom,
      };

      if (taskId) {
        const { error } = await supabase.from("interactive_tasks").update(payload).eq("id", taskId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("interactive_tasks").insert(payload).select("id").single();
        if (error) throw error;
        setTaskId(data.id);
      }

      await supabase.from("assignments").update({ published: true }).eq("id", assignmentId);
      setAutosavedAt(new Date().toLocaleTimeString("he-IL"));
      toast({ title: "המשימה נשמרה ושוגרה לכיתה! 🚀" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "שגיאה בשמירה", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const openGallery = async () => {
    setPanelView("gallery");
    setGalleryLoading(true);
    const { data } = await supabase
      .from("interactive_tasks")
      .select("id, title, description, subject, language, mode, libraries, author_id, html_code, css_code, js_code, python_code, forked_from")
      .eq("is_public_template", true)
      .order("created_at", { ascending: false })
      .limit(60);

    const rows = data || [];
    const authorIds = Array.from(new Set(rows.map((r: any) => r.author_id)));
    const { data: authors } = authorIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
      : { data: [] as any[] };
    const nameMap = new Map((authors || []).map((a: any) => [a.id, a.full_name]));

    setGalleryTasks(
      rows.map((r: any) => ({
        id: r.id,
        authorId: r.author_id,
        authorName: nameMap.get(r.author_id) || "מורה",
        title: r.title,
        description: r.description || "",
        subject: r.subject || "",
        gradeLevel: "",
        language: r.language,
        mode: (r.mode as TaskMode) || "consume",
        htmlCode: r.html_code,
        cssCode: r.css_code,
        jsCode: r.js_code,
        pythonCode: r.python_code,
        libraries: r.libraries || [],
        isPublicTemplate: true,
        forkedFrom: r.forked_from,
        createdAt: "",
        updatedAt: "",
      }))
    );
    setGalleryLoading(false);
  };

  const handleLoadTemplate = (task: InteractiveTask) => {
    setTaskId(null); // becomes a new row for this assignment on next save
    setTitle(`${task.title} (עותק)`);
    setDescription(task.description);
    setSubject(task.subject || "מתמטיקה");
    setLanguage(task.language);
    setTaskMode(task.mode || "consume");
    setHtmlCode(task.htmlCode);
    setCssCode(task.cssCode);
    setJsCode(task.jsCode);
    setPythonCode(task.pythonCode);
    setLibraries(task.libraries);
    setForkedFrom(task.id);
    setPanelView("editor");
    toast({ title: "הטמפלט נטען לעורך", description: "ערוך ולחץ 'שמור' כדי לשגר לכיתה שלך." });
  };

  const consoleClear = () => setConsoleLogs([]);

  if (loading) {
    return (
      <StudioModeWrapper title="בונה משימות אינטראקטיביות" description="עורך קוד, Live Preview, ו-AI" icon={<Code2 className="h-6 w-6 text-primary" />} onBack={onBack}>
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </StudioModeWrapper>
    );
  }

  return (
    <StudioModeWrapper
      title="בונה משימות אינטראקטיביות"
      description="עורך קוד מלא (HTML/CSS/JS/Python), תצוגה חיה, וסייען AI"
      icon={<Code2 className="h-6 w-6 text-primary" />}
      badge="AI + IDE"
      onBack={onBack}
    >
      <div className="flex flex-col h-[calc(100vh-220px)] min-h-[600px] gap-3">
        {/* Compact toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-card border rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted rounded-lg px-3 py-1.5 text-xs font-bold outline-none min-w-[180px]"
              placeholder="שם המשימה"
            />
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-muted rounded-lg px-2 py-1.5 text-xs outline-none">
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={taskMode}
              onChange={(e) => setTaskMode(e.target.value as TaskMode)}
              className="bg-muted rounded-lg px-2 py-1.5 text-xs outline-none"
              title="מצב יצירה: אני בונה חוויה מלאה, או שהתלמיד כותב את הפתרון בעצמו"
            >
              <option value="consume">🧩 מורה בונה משימה/משחק</option>
              <option value="solve">💻 תלמיד כותב פתרון (Python)</option>
            </select>
            {taskMode === "consume" && (
              <select value={language} onChange={(e) => setLanguage(e.target.value as TaskLanguage)} className="bg-muted rounded-lg px-2 py-1.5 text-xs outline-none">
                <option value="web">🌐 Web (HTML/CSS/JS)</option>
                <option value="python">🐍 Python (Pyodide)</option>
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openGallery}>
              <Layers className="h-3.5 w-3.5" /> גלריית קהילה
            </Button>
            {taskId && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setPanelView("analytics")}>
                <BarChart3 className="h-3.5 w-3.5" /> מעקב תלמידים
              </Button>
            )}
            {panelView !== "editor" && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setPanelView("editor")}>
                חזרה לעורך
              </Button>
            )}
            {panelView === "editor" && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setIsLibraryModalOpen(true)}>
                  <BookOpen className="h-3.5 w-3.5" /> ספריות ({libraries.length})
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setIsAIModalOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5" /> AI Tutor
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => (classId ? setIsWorkloadModalOpen(true) : performSave())}
                  disabled={saving || !assignmentId}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  שמור ושגר
                </Button>
              </>
            )}
          </div>
        </div>

        {!assignmentId && (
          <div className="text-xs text-muted-foreground bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
            בחר/י משימה מהרשימה למעלה לפני שמירה — אפשר לערוך ולנסות בינתיים.
          </div>
        )}
        {taskMode === "solve" && panelView === "editor" && (
          <div className="text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
            במצב זה עורך הקוד הוא <strong>קוד הפתיחה</strong> שהתלמיד/ה יראה ויוכל לערוך — לא חוויה סגורה. כתוב/י שלד/תבנית, ובתיאור למטה הסבר/י מה נדרש.
          </div>
        )}

        {/* Main workspace */}
        {panelView === "gallery" ? (
          <CommunityGallery tasks={galleryTasks} loading={galleryLoading} onSelectTaskToFork={handleLoadTemplate} onPreviewTask={handleLoadTemplate} />
        ) : panelView === "analytics" && taskId ? (
          <TeacherAnalyticsDashboard taskId={taskId} classId={classId} taskTitle={title} onBack={() => setPanelView("editor")} />
        ) : (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={taskMode === "solve" ? "הוראות למשימת התכנות (מה על התלמיד לכתוב/לפתור)..." : "תיאור קצר של המשימה (אופציונלי)..."}
              className="bg-muted rounded-lg px-3 py-2 text-xs outline-none resize-none h-14"
            />
            <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden">
              <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col">
                <MonacoCodeEditor
                  languageMode={taskMode === "solve" ? "python" : language}
                  htmlCode={htmlCode}
                  cssCode={cssCode}
                  jsCode={jsCode}
                  pythonCode={pythonCode}
                  onChangeHtml={setHtmlCode}
                  onChangeCss={setCssCode}
                  onChangeJs={setJsCode}
                  onChangePython={setPythonCode}
                  onOpenAI={() => setIsAIModalOpen(true)}
                  autosavedAt={autosavedAt}
                />
              </div>
              <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col">
                <LivePreviewPanel
                  srcDoc={debouncedSrcDoc}
                  consoleLogs={consoleLogs}
                  onClearLogs={consoleClear}
                  onOpenAIDebugger={() => setIsAIModalOpen(true)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <LibrarySelectorModal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        selectedLibraries={libraries}
        onToggleLibrary={handleToggleLibrary}
        onInsertCodeSample={handleInsertCodeSample}
      />

      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        languageMode={language}
        htmlCode={htmlCode}
        cssCode={cssCode}
        jsCode={jsCode}
        pythonCode={pythonCode}
        selectedLibraries={libraries}
        consoleLogs={consoleLogs}
        onApplyGeneratedCode={handleApplyGeneratedCode}
      />

      <Dialog open={isWorkloadModalOpen} onOpenChange={setIsWorkloadModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /> בקרת עומס לפני פרסום</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            עומס המטלות בפועל בכיתה השבוע, לפני שאתה משגר עוד משימה:
          </p>
          {classId && <ClassLoadMeter profile={profile} classId={classId} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsWorkloadModalOpen(false)}>ביטול</Button>
            <Button onClick={async () => { setIsWorkloadModalOpen(false); await performSave(); }} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              אישור ופרסום המשימה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioModeWrapper>
  );
};

export default InteractiveTaskBuilderMode;
