import React, { useState } from 'react';
import {
  RefreshCw, Smartphone, Tablet, Monitor,
  Terminal, AlertTriangle, AlertCircle, Trash2, Bug, ChevronUp, ChevronDown
} from 'lucide-react';
import { ConsoleLog, ResponsiveDevice } from './types';

interface LivePreviewPanelProps {
  srcDoc: string;
  consoleLogs: ConsoleLog[];
  onClearLogs: () => void;
  onOpenAIDebugger?: () => void;
}

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({
  srcDoc,
  consoleLogs,
  onClearLogs,
  onOpenAIDebugger
}) => {
  const [device, setDevice] = useState<ResponsiveDevice>('desktop');
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(true);
  const [logFilter, setLogFilter] = useState<'all' | 'log' | 'warn' | 'error'>('all');
  const [key, setKey] = useState<number>(0);

  const errorCount = consoleLogs.filter((l) => l.level === 'error').length;
  const warnCount = consoleLogs.filter((l) => l.level === 'warn').length;

  const handleRefresh = () => setKey((prev) => prev + 1);

  const getIframeWidth = (): string => {
    switch (device) {
      case 'desktop': return 'w-full';
      case 'tablet': return 'w-[768px] max-w-full';
      case 'mobile': return 'w-[375px] max-w-full';
      case 'phone_small': return 'w-[320px] max-w-full';
    }
  };

  const filteredLogs = consoleLogs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.level === logFilter;
  });

  return (
    <div className="flex flex-col h-full bg-[#111111] rounded-2xl border border-[#2A2A2A] shadow-xl overflow-hidden">
      {/* Preview Header & Controls */}
      <div className="flex flex-wrap items-center justify-between bg-[#1A1A1A] px-4 py-2 border-b border-[#2A2A2A] gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Live Preview</span>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center gap-1 bg-[#0A0A0A] p-1 rounded-lg border border-[#2A2A2A]">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              device === 'desktop' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="מחשב (100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">מחשב</span>
          </button>
          <button
            onClick={() => setDevice('tablet')}
            className={`p-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              device === 'tablet' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="טאבלט (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">טאבלט</span>
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              device === 'mobile' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="נייד (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">נייד</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded-lg transition cursor-pointer"
            title="רענן תצוגה מקדימה"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Preview Container. sandbox="allow-scripts" ONLY — never add
          allow-same-origin here, it would let untrusted teacher/student code
          reach the parent app's origin. See sandboxBuilder.ts for the postMessage
          bridge that is the only sanctioned way out of this frame. */}
      <div className="flex-1 bg-[#151515] p-3 overflow-auto flex justify-center items-start relative">
        <div className={`h-full bg-white rounded-xl shadow-lg border border-[#2A2A2A] overflow-hidden transition-all duration-300 ${getIframeWidth()}`}>
          <iframe
            key={key}
            srcDoc={srcDoc}
            title="App2Class Sandbox Preview"
            sandbox="allow-scripts"
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>

      {/* Embedded Console Log Drawer */}
      <div className="bg-[#0A0A0A] border-t border-[#2A2A2A] text-gray-300">
        <div className="flex items-center justify-between px-4 py-2 bg-[#1A1A1A] text-xs font-mono">
          <button
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            className="flex items-center gap-2 hover:text-white transition cursor-pointer"
          >
            <Terminal className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-[10px] uppercase tracking-wider text-blue-400">Console Output</span>

            {errorCount > 0 && (
              <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
                {errorCount} שגיאות
              </span>
            )}
            {warnCount > 0 && (
              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px]">
                {warnCount} אזהרות
              </span>
            )}

            {isConsoleOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
          </button>

          {isConsoleOpen && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-[#0A0A0A] p-0.5 rounded-lg border border-[#2A2A2A] text-[10px]">
                <button
                  onClick={() => setLogFilter('all')}
                  className={`px-2 py-0.5 rounded transition ${logFilter === 'all' ? 'bg-[#2A2A2A] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  הכל ({consoleLogs.length})
                </button>
                <button
                  onClick={() => setLogFilter('error')}
                  className={`px-2 py-0.5 rounded transition ${logFilter === 'error' ? 'bg-rose-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  שגיאות ({errorCount})
                </button>
                <button
                  onClick={() => setLogFilter('warn')}
                  className={`px-2 py-0.5 rounded transition ${logFilter === 'warn' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  אזהרות ({warnCount})
                </button>
              </div>

              {errorCount > 0 && onOpenAIDebugger && (
                <button
                  onClick={onOpenAIDebugger}
                  className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <Bug className="w-3.5 h-3.5" />
                  <span>ניפוי שגיאה AI</span>
                </button>
              )}

              <button
                onClick={onClearLogs}
                className="p-1 text-gray-400 hover:text-rose-400 transition cursor-pointer text-[10px]"
                title="נקה לוגים"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {isConsoleOpen && (
          <div className="h-44 overflow-y-auto p-3 font-mono text-xs space-y-1.5 divide-y divide-[#2A2A2A]/50 bg-[#0A0A0A]">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-600 italic text-center py-6 text-xs">
                אין פלטים ב-Console (לוגים מהקוד של המורה או התלמיד יוצגו כאן בזמן אמת)
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="pt-1.5 flex items-start gap-2 text-left" dir="ltr">
                  <span className="text-gray-600 text-[10px] select-none pt-0.5 min-w-[55px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>

                  {log.level === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                  {log.level === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}

                  <div className={`flex-1 break-words whitespace-pre-wrap ${
                    log.level === 'error' ? 'text-rose-300 font-semibold' :
                    log.level === 'warn' ? 'text-amber-300' : 'text-gray-300'
                  }`}>
                    {log.args.join(' ')}
                    {log.line && <span className="text-gray-600 ml-2">(Line {log.line})</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
