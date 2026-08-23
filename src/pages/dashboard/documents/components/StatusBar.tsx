import React from 'react';
import { FileText, Clock, CheckCircle2, Globe, Sliders, Layout, Columns, AlertTriangle, SpellCheck, PlusCircle } from 'lucide-react';
import { DocumentModel } from '../types';
import { getWordAndCharCount } from '../utils/editorUtils';

interface StatusBarProps {
  document: DocumentModel;
  onUpdateDocument: (updates: Partial<DocumentModel>) => void;
  spellErrorCount?: number;
  onToggleSpellCheck?: () => void;
  onAddPage?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  document, 
  onUpdateDocument,
  spellErrorCount = 0,
  onToggleSpellCheck,
  onAddPage
}) => {
  const stats = getWordAndCharCount(document.contentHtml);
  
  // Calculate total pages dynamically based on page breaks in HTML
  const pageBreaksCount = (document.contentHtml.match(/data-page-break="true"|docword-page-break|page-break-before/gi)?.length || 0);
  const totalPages = Math.max(1, pageBreaksCount + 1);

  return (
    <footer className="h-7 bg-white border-t border-gray-200 flex items-center justify-between px-4 text-[10px] text-gray-500 shrink-0 font-medium select-none z-20">
      {/* Right side (RTL start): Page count, Word count, Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span>עמוד 1 מתוך {totalPages}</span>
          {onAddPage && (
            <button
              onClick={onAddPage}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-bold transition-colors cursor-pointer"
              title="הוסף עמוד חדש למסמך"
            >
              <PlusCircle className="w-3 h-3 text-blue-600" />
              <span>עמוד חדש</span>
            </button>
          )}
        </div>
        <span>{stats.words} מילים</span>
        <span>{stats.chars} תווים</span>
        
        {/* Real-time Spellcheck Indicator */}
        <button
          onClick={onToggleSpellCheck}
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          title="לחץ לפתיחת בדיקת איות מקומית"
        >
          {spellErrorCount > 0 ? (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                נמצאו {spellErrorCount} שגיאות איות
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                בדיקת איות תקינה
              </span>
            </>
          )}
        </button>
      </div>

      {/* Left side (RTL end): Language & Zoom Slider */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => onUpdateDocument({ dir: document.dir === 'rtl' ? 'ltr' : 'rtl' })}
          className="hover:text-blue-600 transition-colors cursor-pointer"
        >
          {document.dir === 'rtl' ? 'עברית' : 'English'}
        </button>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => onUpdateDocument({ zoom: Math.max(50, document.zoom - 10) })}
            className="hover:text-blue-600 transition-colors font-bold px-1"
          >
            -
          </button>
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
            <div 
              style={{ width: `${(document.zoom / 200) * 100}%` }} 
              className="h-full bg-blue-500 transition-all"
            />
          </div>
          <button 
            onClick={() => onUpdateDocument({ zoom: Math.min(200, document.zoom + 10) })}
            className="hover:text-blue-600 transition-colors font-bold px-1"
          >
            +
          </button>
          <span className="w-8 text-left font-mono">{document.zoom}%</span>
        </div>
      </div>
    </footer>
  );
};
