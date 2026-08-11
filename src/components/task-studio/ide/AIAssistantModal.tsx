import React, { useState } from 'react';
import { Sparkles, Bug, X, Check, Loader2, Lightbulb } from 'lucide-react';
import { ConsoleLog, TaskLanguage, AIDebugResult } from './types';
import { supabase } from '@/integrations/supabase/client';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  languageMode: TaskLanguage;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  pythonCode: string;
  selectedLibraries: string[];
  consoleLogs: ConsoleLog[];
  onApplyGeneratedCode: (data: {
    title?: string;
    description?: string;
    htmlCode?: string;
    cssCode?: string;
    jsCode?: string;
    pythonCode?: string;
    libraries?: string[];
  }) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  languageMode,
  htmlCode,
  cssCode,
  jsCode,
  pythonCode,
  selectedLibraries,
  consoleLogs,
  onApplyGeneratedCode
}) => {
  const [tab, setTab] = useState<'prompt' | 'debug'>('prompt');
  const [promptInput, setPromptInput] = useState<string>('');
  const [subjectInput, setSubjectInput] = useState<string>('מתמטיקה');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<any>(null);
  const [debugResult, setDebugResult] = useState<AIDebugResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateCode = async () => {
    if (!promptInput.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    setGeneratedResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('task-studio-ai', {
        body: {
          action: 'generate-interactive-code',
          prompt: promptInput,
          subject: subjectInput,
          language: languageMode,
          libraries: selectedLibraries,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedResult(data?.result || data);
    } catch (err: any) {
      setErrorMessage(err.message || 'נכשל ביצירת הקוד');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunDebugger = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setDebugResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('task-studio-ai', {
        body: {
          action: 'debug-interactive-code',
          language: languageMode,
          htmlCode,
          cssCode,
          jsCode,
          pythonCode,
          consoleLogs,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDebugResult(data?.result || data);
    } catch (err: any) {
      setErrorMessage(err.message || 'נכשל בניפוי השגיאה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyGen = () => {
    if (generatedResult) {
      onApplyGeneratedCode({
        title: generatedResult.title,
        description: generatedResult.description,
        htmlCode: generatedResult.htmlCode,
        cssCode: generatedResult.cssCode,
        jsCode: generatedResult.jsCode,
        pythonCode: generatedResult.pythonCode,
        libraries: generatedResult.libraries
      });
      onClose();
    }
  };

  const handleApplyDebugFix = () => {
    if (debugResult?.fixedCode) {
      onApplyGeneratedCode({
        htmlCode: debugResult.fixedCode.html,
        cssCode: debugResult.fixedCode.css,
        jsCode: debugResult.fixedCode.js,
        pythonCode: debugResult.fixedCode.python
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#E0E0E0]">
        <div className="flex items-center justify-between px-6 py-4 bg-[#1A1A1A] border-b border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('prompt')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === 'prompt' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>יצירת משימה מתיאור (Prompt-to-Code)</span>
            </button>

            <button
              onClick={() => setTab('debug')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                tab === 'debug' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
              <span>ניפוי שגיאות AI (Debugger)</span>
            </button>
          </div>

          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs">
              {errorMessage}
            </div>
          )}

          {tab === 'prompt' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">נושא ותחום לימוד</label>
                <select
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-2.5 text-xs font-medium text-white focus:outline-none"
                >
                  <option value="מתמטיקה">מתמטיקה</option>
                  <option value="מדעי המחשב">מדעי המחשב</option>
                  <option value="פיזיקה">פיזיקה</option>
                  <option value="ביולוגיה">ביולוגיה</option>
                  <option value="היסטוריה/אזרחות">היסטוריה / אזרחות</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">תאר את המשימה האינטראקטיבית שתרצה לייצר</label>
                <textarea
                  rows={4}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="לדוגמה: צור משחק התאמת מושגים בהיסטוריה עם כרטיסיות נגררות, משוב מיידי וחישוב ציון..."
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleGenerateCode}
                disabled={isLoading || !promptInput.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 text-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>בונה קוד אינטראקטיבי...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-300" />
                    <span>ייצר קוד מבוסס AI</span>
                  </>
                )}
              </button>

              {generatedResult && (
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-gray-300 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                    <h4 className="font-bold text-blue-400 text-xs">{generatedResult.title || 'תוצר אינטראקטיבי חדש'}</h4>
                    <span className="text-[10px] bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">מוכן לייבוא</span>
                  </div>
                  <p className="text-xs text-gray-400">{generatedResult.description}</p>

                  <button
                    onClick={handleApplyGen}
                    className="w-full bg-white text-black hover:bg-gray-200 font-semibold py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-2 text-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>ייבא קוד זה לעורך ה-IDE</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'debug' && (
            <div className="space-y-4">
              <div className="bg-[#1A1A1A] border border-[#2A2A2A] p-3 rounded-xl text-gray-400 text-xs leading-relaxed">
                מנוע ה-AI יסרוק את הקוד הנוכחי שלך יחד עם הלוגים והשגיאות שנתפסו ב-Console של ה-Preview, ויזהה את מספר השורה ואת סיבת השגיאה האמיתית.
              </div>

              <div className="bg-[#0A0A0A] text-gray-300 p-3 rounded-xl text-xs font-mono max-h-32 overflow-y-auto border border-[#2A2A2A]">
                <span className="text-gray-500 block mb-1 font-sans text-[11px]">לוגים אחרונים מה-Console:</span>
                {consoleLogs.length === 0 ? (
                  <span className="text-gray-600 italic">אין שגיאות פעילות בלוג.</span>
                ) : (
                  consoleLogs.map((l) => (
                    <div key={l.id} className={l.level === 'error' ? 'text-rose-400 font-semibold' : 'text-gray-400'}>
                      [{l.level.toUpperCase()}] {l.args.join(' ')}
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={handleRunDebugger}
                disabled={isLoading}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 text-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>מנתח קוד ושגיאות...</span>
                  </>
                ) : (
                  <>
                    <Bug className="w-4 h-4" />
                    <span>בדוק וזהה שגיאה בקוד</span>
                  </>
                )}
              </button>

              {debugResult && (
                <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-4 text-gray-300 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Lightbulb className="w-4 h-4" />
                    <span>ממצא ה-AI {debugResult.line ? `(שורה ${debugResult.line})` : ''}:</span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed bg-[#1A1A1A] p-3 rounded-lg border border-[#2A2A2A]">
                    {debugResult.explanation}
                  </p>

                  <div className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                    <span className="font-bold block mb-1">הצעת התיקון:</span>
                    {debugResult.suggestion}
                  </div>

                  {debugResult.fixedCode && (
                    <button
                      onClick={handleApplyDebugFix}
                      className="w-full bg-white text-black hover:bg-gray-200 font-semibold py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-2 text-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>החל את תיקון ה-AI על הקוד בעורך</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
