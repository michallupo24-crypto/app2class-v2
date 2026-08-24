import React, { useRef } from 'react';
import { Download, FileText, FileCode, Printer, Upload, X, Check, FileCheck } from 'lucide-react';
import { DocumentModel } from '../types';
import { exportAsWordDocx, exportAsMarkdown, exportAsTxt, downloadFile } from '../utils/editorUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentModel;
  onImportDocument: (importedDoc: Partial<DocumentModel>) => void;
  onPrint: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  document,
  onImportDocument,
  onPrint
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportWord = () => {
    exportAsWordDocx(document.title, document.contentHtml, document.dir);
  };

  const handleExportMarkdown = () => {
    exportAsMarkdown(document.title, document.contentHtml);
  };

  const handleExportTxt = () => {
    exportAsTxt(document.title, document.contentHtml);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(document, null, 2);
    downloadFile(`${document.title}.json`, jsonStr, 'application/json');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          onImportDocument(parsed);
          onClose();
        } catch (err) {
          alert('קובץ JSON לא תקין');
        }
      } else {
        // Plain text or markdown
        onImportDocument({
          title: file.name.replace(/\.[^/.]+$/, ''),
          contentHtml: `<p>${text.replace(/\n/g, '<br/>')}</p>`
        });
        onClose();
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-card rounded-lg w-full max-w-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted">
          <div className="flex items-center gap-2 font-bold text-base text-foreground">
            <Download className="w-5 h-5 text-primary" />
            <span>ייצוא, שמירה וייבוא קבצים</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-foreground">
          <p className="font-bold text-foreground">בחר פורמט להורדת המסמך:</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Word DOCX */}
            <button
              onClick={handleExportWord}
              className="p-3 bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-xl text-right flex items-center gap-3 transition-colors group"
            >
              <div className="p-2 bg-primary text-primary-foreground rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">Microsoft Word (.doc)</div>
                <div className="text-[11px] text-muted-foreground">פתח ב-Word או Google Docs</div>
              </div>
            </button>

            {/* Print / PDF */}
            <button
              onClick={() => { onClose(); onPrint(); }}
              className="p-3 bg-muted hover:bg-muted/70 border border-border rounded-xl text-right flex items-center gap-3 transition-colors group"
            >
              <div className="p-2 bg-destructive text-destructive-foreground rounded-lg">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">הדפסה / PDF</div>
                <div className="text-[11px] text-muted-foreground">שמור כ-PDF מעוצב ברזולוציה גבוהה</div>
              </div>
            </button>

            {/* Markdown */}
            <button
              onClick={handleExportMarkdown}
              className="p-3 bg-muted hover:bg-muted/70 border border-border rounded-xl text-right flex items-center gap-3 transition-colors group"
            >
              <div className="p-2 bg-accent text-accent-foreground rounded-lg">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">Markdown (.md)</div>
                <div className="text-[11px] text-muted-foreground">פורמט טקסטואלי מובנה לעורכים</div>
              </div>
            </button>

            {/* Plain TXT */}
            <button
              onClick={handleExportTxt}
              className="p-3 bg-muted hover:bg-muted/70 border border-border rounded-xl text-right flex items-center gap-3 transition-colors group"
            >
              <div className="p-2 bg-secondary text-secondary-foreground rounded-lg">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">טקסט פשוט (.txt)</div>
                <div className="text-[11px] text-muted-foreground">טקסט נקי ללא עיצובים</div>
              </div>
            </button>
          </div>

          <div className="h-px bg-border my-2" />

          {/* Import section */}
          <div className="bg-muted p-4 rounded-xl border border-border flex items-center justify-between">
            <div>
              <div className="font-bold text-foreground">ייבוא מסמך ממחשבך</div>
              <div className="text-[11px] text-muted-foreground">תומך בקבצי TXT, MD, וגיבוי JSON</div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>בחר קובץ</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
