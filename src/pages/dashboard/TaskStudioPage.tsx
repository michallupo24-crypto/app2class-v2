import { useState, useEffect } from "react";
import { useOutletContext, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToolSticker } from "@/components/ToolSticker";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ManualQuestionEditor from "@/components/task-studio/ManualQuestionEditor";
import FolderScanMode from "@/components/task-studio/FolderScanMode";
import LiveFeedbackMode from "@/components/task-studio/LiveFeedbackMode";
import FlashcardsMode from "@/components/task-studio/FlashcardsMode";
import SmartTemplateMode from "@/components/task-studio/SmartTemplateMode";
import MountainClimbMode from "@/components/task-studio/MountainClimbMode";
import SnakesAndLaddersMode from "@/components/task-studio/SnakesAndLaddersMode";
import CoopGameMode from "@/components/task-studio/CoopGameMode";
import GamePromptMode from "@/components/task-studio/GamePromptMode";
import DataHookMode from "@/components/task-studio/DataHookMode";
import InteractiveTaskBuilderMode from "@/components/task-studio/InteractiveTaskBuilderMode";
import AIPromptBuilderMode from "@/components/task-studio/AIPromptBuilderMode";
import BagrutCoverageBar from "@/components/task-studio/BagrutCoverageBar";
import AdaptiveTierMode from "@/components/task-studio/AdaptiveTierMode";
import MisconceptionCoachMode from "@/components/task-studio/MisconceptionCoachMode";
import BagrutHunterMode from "@/components/task-studio/BagrutHunterMode";
import AiOptimizationMode from "@/components/task-studio/AiOptimizationMode";

interface StudioMode {
  id: string;
  title: string;
  description: string;
  /** Tool sticker id. */
  icon: string;
  category: "create" | "game" | "ai" | "tools";
  ai?: boolean;
}

// Texts and stickers per the "Task Studio" design.
const STUDIO_MODES: StudioMode[] = [
  { id: "manual", title: "הזנה ידנית", description: "כתיבת בנק שאלות ותשובות במגוון פורמטים", icon: "quiz", category: "create" },
  { id: "folder-scan", title: "סריקת תיקייה", description: "הופך מצגות וקבצי PDF למשימה", icon: "folder", category: "ai", ai: true },
  { id: "live-feedback", title: "Live Feedback", description: "שאלות מהשיעור האחרון הופכות למטלת חזרה", icon: "chat", category: "create" },
  { id: "flashcards", title: "Flashcards", description: "כרטיסיות שינון מהחומר", icon: "cards", category: "create" },
  { id: "smart-template", title: "טמפלטים חכמים", description: "מבחן או דף עבודה, עם ייבוא מ-PDF", icon: "docs", category: "create" },
  { id: "adaptive-tier", title: "מסלול מותאם אישית", description: "שאלה אחת בשלוש רמות. כל תלמיד/ה מקבל/ת את הרמה שמתאימה", icon: "learn_stack", category: "ai", ai: true },
  { id: "misconception-coach", title: "בוחן עם מאמן AI", description: "כשטועים, ה-AI מסביר את הטעות לפני שממשיכים", icon: "learn_cap", category: "ai", ai: true },
  { id: "mountain-climb", title: "טיפוס על הר", description: "תשובה נכונה מקדמת את האווטאר לפסגה", icon: "mountain", category: "game" },
  { id: "snakes-ladders", title: "נחשים וסולמות", description: "לוח משחק שמתקדמים בו בפתרון תרגילים", icon: "dice", category: "game" },
  { id: "coop-game", title: "בן האש ובת המים", description: "משימה זוגית בשיתוף פעולה", icon: "flame", category: "game" },
  { id: "game-prompt", title: "Game Prompt", description: "מתארים במילים, הבוט בונה משחק", icon: "ai", category: "ai", ai: true },
  { id: "blank-html", title: "בונה משימות אינטראקטיביות", description: "עורך קוד מלא עם תצוגה חיה ועוזר AI", icon: "code", category: "tools", ai: true },
  { id: "ai-prompt-builder", title: "בונה פרומפט ל-AI חיצוני", description: "תיאור המשימה הופך לפרומפט מדויק ל-ChatGPT או Claude", icon: "wand", category: "ai", ai: true },
  { id: "data-hook", title: "Data Hook", description: "ציונים ממשחק נכנסים ישר לגיליון", icon: "gamepad", category: "tools" },
  { id: "bagrut-coverage", title: "בר הספק לבגרות", description: "כמה מחומר הבגרות המשימות שלך מכסות", icon: "target", category: "tools" },
  { id: "bagrut-hunter", title: "ציד שאלות בגרות", description: "חיפוש שאלות בסגנון בגרות לפי נושא", icon: "search", category: "ai", ai: true },
  { id: "ai-optimization", title: "אופטימיזציית קוד", description: "שיפור קוד HTML/JS קיים: רספונסיביות, RTL ואנימציות", icon: "gear", category: "tools", ai: true },
];

const CATEGORIES = [["all", "הכל"], ["create", "יצירה"], ["game", "משחקים"], ["ai", "AI"], ["tools", "כלים"]] as const;

const AiTag = ({ small }: { small?: boolean }) => (
  <span className={`rounded-[9px] border-2 border-white dark:border-card bg-[#D9F6F1] text-[#0F6B66] font-body font-extrabold leading-none rotate-3 shadow-sticker ${small ? "px-[7px] py-1 text-[11px]" : "px-[9px] py-[5px] text-xs"}`}>AI</span>
);

const TaskStudioPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  // "הוסף שאלות" on the assignments page deep-links here with the assignment preselected.
  const location = useLocation();
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(
    (location.state as { assignmentId?: string } | null)?.assignmentId ?? null,
  );
  const [assignments, setAssignments] = useState<any[]>([]);
  const [pendingGeneratedCode, setPendingGeneratedCode] = useState<{ title?: string; description?: string; htmlCode?: string; cssCode?: string; jsCode?: string } | null>(null);

  useEffect(() => {
    const loadAssignments = async () => {
      const { data } = await supabase
        .from("assignments")
        .select("id, title, subject, type, classes(grade, class_number)")
        .eq("teacher_id", profile.id)
        .order("created_at", { ascending: false });
      setAssignments(data || []);
    };
    loadAssignments();
  }, [profile.id]);

  const filteredModes = filterCategory === "all"
    ? STUDIO_MODES
    : STUDIO_MODES.filter((m) => m.category === filterCategory);

  const renderActiveMode = () => {
    if (!activeMode) return null;
    const commonProps = { profile, assignmentId: selectedAssignment, onBack: () => setActiveMode(null) };
    switch (activeMode) {
      case "manual": return <ManualQuestionEditor {...commonProps} />;
      case "folder-scan": return <FolderScanMode {...commonProps} />;
      case "live-feedback": return <LiveFeedbackMode {...commonProps} />;
      case "flashcards": return <FlashcardsMode {...commonProps} />;
      case "smart-template": return <SmartTemplateMode {...commonProps} />;
      case "adaptive-tier": return <AdaptiveTierMode {...commonProps} />;
      case "misconception-coach": return <MisconceptionCoachMode {...commonProps} />;
      case "mountain-climb": return <MountainClimbMode {...commonProps} />;
      case "snakes-ladders": return <SnakesAndLaddersMode {...commonProps} />;
      case "coop-game": return <CoopGameMode {...commonProps} />;
      case "game-prompt": return <GamePromptMode {...commonProps} />;
      case "blank-html": return (
        <InteractiveTaskBuilderMode
          {...commonProps}
          initialGeneratedCode={pendingGeneratedCode}
          onConsumedInitialCode={() => setPendingGeneratedCode(null)}
        />
      );
      case "ai-prompt-builder": return (
        <AIPromptBuilderMode
          {...commonProps}
          onSendToEditor={(code) => { setPendingGeneratedCode(code); setActiveMode("blank-html"); }}
        />
      );
      case "data-hook": return <DataHookMode {...commonProps} />;
      case "bagrut-coverage": return <BagrutCoverageBar {...commonProps} />;
      case "bagrut-hunter": return <BagrutHunterMode {...commonProps} />;
      case "ai-optimization": return <AiOptimizationMode {...commonProps} />;
      default: return null;
    }
  };

  if (activeMode) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        {renderActiveMode()}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <ToolSticker id="wand" size={52} className="max-md:w-10 max-md:h-10" />
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading font-black text-2xl md:text-[30px] leading-none">סטודיו משימות</h1>
            <p className="font-body font-semibold text-sm leading-none text-muted-foreground max-md:hidden">בחר/י איך לבנות את המשימה הבאה</p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-card border-[1.5px] border-input min-w-[200px]">
            <span className="font-body font-bold text-[11px] leading-none text-hint">משימה פעילה</span>
            <Select value={selectedAssignment || ""} onValueChange={setSelectedAssignment}>
              <SelectTrigger className="h-auto p-0 border-0 shadow-none bg-transparent font-body font-extrabold text-[13.5px] focus:ring-0" aria-label="משימה פעילה">
                <SelectValue placeholder="בחר/י משימה קיימת..." />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.title} · {a.subject}{a.classes ? ` · ${a.classes.grade}'-${a.classes.class_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/teacher-assignments")}
            className="px-4 py-[13px] rounded-xl bg-primary text-primary-foreground font-body font-extrabold text-sm leading-none">
            משימה חדשה
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 md:gap-0.5 md:p-1 md:rounded-[13px] md:bg-muted md:self-start overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="סוג מצב">
        {CATEGORIES.map(([k, label]) => {
          const on = filterCategory === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setFilterCategory(k)}
              className={`flex-none px-[13px] md:px-3.5 py-2 md:py-[9px] rounded-full md:rounded-[10px] font-body font-extrabold text-[13px] leading-none max-md:shadow-[0_3px_8px_-5px_rgba(40,30,15,.35)] ${
                on ? "max-md:bg-primary max-md:text-primary-foreground md:bg-card md:shadow-[0_3px_8px_-4px_rgba(40,30,15,.35)]" : "max-md:bg-card md:text-muted-foreground"}`}>
              {label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 md:gap-3.5">
        {filteredModes.map((mode) => (
          <button key={mode.id} type="button" onClick={() => setActiveMode(mode.id)}
            className="text-right flex sm:flex-col items-center sm:items-stretch gap-3 sm:gap-2.5 px-3.5 py-3 sm:px-4 sm:pt-[18px] sm:pb-4 rounded-[20px] sm:rounded-[22px] bg-card shadow-card hover:shadow-raised transition-shadow">
            <div className="flex sm:items-start sm:justify-between flex-none">
              <ToolSticker id={mode.icon} size={54} className="max-sm:w-11 max-sm:h-11" />
              {mode.ai && <span className="max-sm:hidden"><AiTag /></span>}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-[5px] sm:gap-2.5">
              <span className="font-heading font-extrabold sm:font-black text-[15px] sm:text-[15.5px] leading-tight">{mode.title}</span>
              <span className="font-body font-semibold text-[12.5px] sm:text-[13px] leading-snug text-muted-foreground sm:text-text-secondary [text-wrap:pretty]">{mode.description}</span>
            </div>
            {mode.ai && <span className="sm:hidden flex-none"><AiTag small /></span>}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default TaskStudioPage;
