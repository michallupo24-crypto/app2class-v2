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
    <footer className="h-7 bg-card border-t border-border flex items-center justify-between px-4 text-[10px] text-muted-foreground shrink-0 font-medium select-none z-20">
      {/* Right side (RTL start): Page count, Word count, Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span>עמוד 1 מתוך {totalPages}</span>
          {onAddPage && (
            <button
              onClick={onAddPage}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded font-bold transition-colors cursor-pointer"
              title="הוסף עמוד חדש למסמך"
            >
              <PlusCircle className="w-3 h-3 text-primary" />
              <span>עמוד חדש</span>
            </button>
          )}
        </div>
        <span>{stats.words} מילים</span>
        <span>{stats.chars} תווים</span>
        
        {/* Real-time Spellcheck Indicator */}
        <button
          onClick={onToggleSpellCheck}
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
          title="לחץ לפתיחת בדיקת איות מקומית"
        >
          {spellErrorCount > 0 ? (
            <>
              <span className="w-2 h-2 rounded-full bg-destructive"></span>
              <span className="text-destructive font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                נמצאו {spellErrorCount} שגיאות איות
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-success"></span>
              <span className="text-success font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-success" />
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
          className="hover:text-primary transition-colors cursor-pointer"
        >
          {document.dir === 'rtl' ? 'עברית' : 'English'}
        </button>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => onUpdateDocument({ zoom: Math.max(50, document.zoom - 10) })}
            className="hover:text-primary transition-colors font-bold px-1"
          >
            -
          </button>
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden border border-border">
            <div
              style={{ width: `${(document.zoom / 200) * 100}%` }}
              className="h-full bg-primary transition-all"
            />
          </div>
          <button 
            onClick={() => onUpdateDocument({ zoom: Math.min(200, document.zoom + 10) })}
            className="hover:text-primary transition-colors font-bold px-1"
          >
            +
          </button>
          <span className="w-8 text-left font-mono">{document.zoom}%</span>
        </div>
      </div>
    </footer>
  );
};
