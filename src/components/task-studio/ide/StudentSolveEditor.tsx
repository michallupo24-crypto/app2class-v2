import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Send, Loader2, CheckCircle2, Code2 } from 'lucide-react';
import { LivePreviewPanel } from './LivePreviewPanel';
import { buildSandboxHtml } from './sandboxBuilder';
import type { ConsoleLog } from './types';

interface StudentSolveEditorProps {
  starterCode: string;
  initialCode: string | null;
  instructions: string;
  submitted: boolean;
  saving: boolean;
  onRun: (code: string) => void;
  onSaveDraft: (code: string) => void;
  onSubmit: (code: string) => void;
  onAutoScore?: (score: number, total: number) => void;
}

export const StudentSolveEditor: React.FC<StudentSolveEditorProps> = ({
  starterCode,
  initialCode,
  instructions,
  submitted,
  saving,
  onRun,
  onSaveDraft,
  onSubmit,
  onAutoScore,
}) => {
  const [code, setCode] = useState<string>(initialCode ?? starterCode);
  const [srcDoc, setSrcDoc] = useState<string>('');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasRun) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'console-log') {
        setConsoleLogs((prev) => [
          ...prev,
          { id: `log-${Date.now()}-${Math.random()}`, level: data.level || 'log', args: data.args || [], timestamp: data.timestamp || new Date().toISOString(), line: data.line },
        ]);
      }
      if (data.type === 'score' && typeof data.score === 'number' && onAutoScore) {
        onAutoScore(data.score, typeof data.total === 'number' && data.total > 0 ? data.total : 100);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [hasRun, onAutoScore]);

  const handleChange = (value: string | undefined) => {
    const val = value || '';
    setCode(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSaveDraft(val), 1500);
  };

  const handleRun = () => {
    setConsoleLogs([]);
    setSrcDoc(buildSandboxHtml({ language: 'python', htmlCode: '', cssCode: '', jsCode: '', pythonCode: code, libraries: [] }));
    setHasRun(true);
    onRun(code);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="bg-card border rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-bold text-sm">הוראות המשימה</h3>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{instructions || 'כתוב/כתבי את הפתרון שלך בעורך הקוד למטה.'}</p>
        {submitted && (
          <div className="flex items-center gap-2 text-success text-xs font-bold bg-success/10 rounded-lg px-3 py-2 w-fit">
            <CheckCircle2 className="h-4 w-4" /> המשימה הוגשה. אפשר עדיין לערוך ולהגיש שוב.
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden min-h-[400px]">
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col rounded-2xl border overflow-hidden">
          <div className="bg-[#1A1A1A] px-3 py-2 flex items-center justify-between border-b border-[#2A2A2A]">
            <span className="text-xs font-mono text-gray-300">main.py</span>
            <div className="flex gap-2">
              <button
                onClick={handleRun}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" /> הרץ
              </button>
              <button
                onClick={() => onSubmit(code)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1 bg-success hover:opacity-90 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} הגש/י
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <Editor
              height="100%"
              language="python"
              theme="vs-dark"
              value={code}
              onChange={handleChange}
              options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true, wordWrap: 'on', lineNumbers: 'on' }}
            />
          </div>
        </div>

        <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col">
          {hasRun ? (
            <LivePreviewPanel srcDoc={srcDoc} consoleLogs={consoleLogs} onClearLogs={() => setConsoleLogs([])} />
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
              לחצ/י "הרץ" כדי לראות את הפלט
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
