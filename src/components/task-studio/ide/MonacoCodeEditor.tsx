import React, { useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Sparkles, Copy, Check, WrapText, ZoomIn, ZoomOut, Save } from 'lucide-react';
import { TaskLanguage } from './types';

interface MonacoCodeEditorProps {
  languageMode: TaskLanguage;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  pythonCode: string;
  onChangeHtml: (code: string) => void;
  onChangeCss: (code: string) => void;
  onChangeJs: (code: string) => void;
  onChangePython: (code: string) => void;
  onOpenAI: () => void;
  autosavedAt: string | null;
}

type CodeTab = 'html' | 'css' | 'js' | 'python';

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  languageMode,
  htmlCode,
  cssCode,
  jsCode,
  pythonCode,
  onChangeHtml,
  onChangeCss,
  onChangeJs,
  onChangePython,
  onOpenAI,
  autosavedAt
}) => {
  const [activeTab, setActiveTab] = useState<CodeTab>(languageMode === 'python' ? 'python' : 'html');
  const [fontSize, setFontSize] = useState<number>(14);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [copied, setCopied] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  const getActiveCode = (): string => {
    switch (activeTab) {
      case 'html': return htmlCode;
      case 'css': return cssCode;
      case 'js': return jsCode;
      case 'python': return pythonCode;
    }
  };

  const getMonacoLanguage = (): string => {
    switch (activeTab) {
      case 'html': return 'html';
      case 'css': return 'css';
      case 'js': return 'javascript';
      case 'python': return 'python';
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    const val = value || '';
    switch (activeTab) {
      case 'html': onChangeHtml(val); break;
      case 'css': onChangeCss(val); break;
      case 'js': onChangeJs(val); break;
      case 'python': onChangePython(val); break;
    }
  };

  const handleEditorDidMount: OnMount = (editor) => {
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column
      });
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#111111] text-[#E0E0E0] rounded-2xl border border-[#2A2A2A] shadow-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between bg-[#1A1A1A] px-4 py-2 border-b border-[#2A2A2A] gap-2">
        <div className="flex items-center gap-1 bg-[#0A0A0A] p-1 rounded-lg border border-[#2A2A2A]">
          {languageMode === 'web' && (
            <>
              <button
                onClick={() => setActiveTab('html')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'html' ? 'bg-[#2A2A2A] text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                index.html
              </button>
              <button
                onClick={() => setActiveTab('css')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'css' ? 'bg-[#2A2A2A] text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                styles.css
              </button>
              <button
                onClick={() => setActiveTab('js')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  activeTab === 'js' ? 'bg-[#2A2A2A] text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                script.js
              </button>
            </>
          )}

          {languageMode === 'python' && (
            <button
              onClick={() => setActiveTab('python')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                activeTab === 'python' ? 'bg-[#2A2A2A] text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              main.py (Python)
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAI}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 rounded-lg text-xs font-semibold transition cursor-pointer"
            title="עוזר בינה מלאכותית ליצירת קוד או ניפוי שגיאות"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>AI Tutor</span>
          </button>

          <button
            onClick={handleCopyCode}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded-lg transition cursor-pointer"
            title="העתק קוד ללוח"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              wordWrap === 'on' ? 'bg-[#2A2A2A] text-blue-400' : 'text-gray-400 hover:bg-[#2A2A2A]'
            }`}
            title="גלישת שורות"
          >
            <WrapText className="w-4 h-4" />
          </button>

          <div className="flex items-center bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-1">
            <button
              onClick={() => setFontSize(Math.max(10, fontSize - 1))}
              className="p-1 text-gray-400 hover:text-white transition cursor-pointer"
              title="הקטן פונט"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-1.5 text-gray-300">{fontSize}px</span>
            <button
              onClick={() => setFontSize(Math.min(24, fontSize + 1))}
              className="p-1 text-gray-400 hover:text-white transition cursor-pointer"
              title="הגדל פונט"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
            className="text-xs px-2 py-1 bg-[#2A2A2A] hover:bg-[#333333] text-gray-300 rounded-lg transition cursor-pointer"
            title="החלף ערכת נושא"
          >
            {editorTheme === 'vs-dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[350px] relative bg-[#111111]">
        <Editor
          height="100%"
          language={getMonacoLanguage()}
          theme={editorTheme}
          value={getActiveCode()}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: fontSize,
            wordWrap: wordWrap,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            lineNumbers: 'on',
            folding: true,
            glyphMargin: false,
            padding: { top: 12, bottom: 12 }
          }}
        />
      </div>

      <div className="flex items-center justify-between bg-[#1A1A1A] px-4 py-1.5 border-t border-[#2A2A2A] text-[10px] text-gray-500 font-mono">
        <div className="flex items-center gap-4">
          <span>שורה {cursorPos.line}, עמודה {cursorPos.col}</span>
          <span className="capitalize">שפה: {activeTab.toUpperCase()}</span>
        </div>

        <div className="flex items-center gap-2 text-gray-500">
          {autosavedAt && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Save className="w-3 h-3" />
              <span>נשמר בטיוטה: {autosavedAt}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
