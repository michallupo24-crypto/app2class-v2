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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 font-bold text-base text-slate-800">
            <Download className="w-5 h-5 text-blue-600" />
            <span>ייצוא, שמירה וייבוא קבצים</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <p className="font-bold text-slate-800">בחר פורמט להורדת המסמך:</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Word DOCX */}
            <button
              onClick={handleExportWord}
              className="p-3 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200 rounded-xl text-right flex items-center gap-3 transition-all group"
            >
              <div className="p-2 bg-blue-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-blue-900 text-sm">Microsoft Word (.doc)</div>
                <div className="text-[11px] text-blue-700">פתח ב-Word או Google Docs</div>
              </div>
            </button>

            {/* Print / PDF */}
            <button
              onClick={() => { onClose(); onPrint(); }}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-right flex items-center gap-3 transition-all group"
            >
              <div className="p-2 bg-rose-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">הדפסה / PDF</div>
                <div className="text-[11px] text-slate-500">שמור כ-PDF מעוצב ברזולוציה גבוהה</div>
              </div>
            </button>

            {/* Markdown */}
            <button
              onClick={handleExportMarkdown}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-right flex items-center gap-3 transition-all group"
            >
              <div className="p-2 bg-indigo-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">Markdown (.md)</div>
                <div className="text-[11px] text-slate-500">פורמט טקסטואלי מובנה לעורכים</div>
              </div>
            </button>

            {/* Plain TXT */}
            <button
              onClick={handleExportTxt}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-right flex items-center gap-3 transition-all group"
            >
              <div className="p-2 bg-slate-700 text-white rounded-lg group-hover:scale-105 transition-transform">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">טקסט פשוט (.txt)</div>
                <div className="text-[11px] text-slate-500">טקסט נקי ללא עיצובים</div>
              </div>
            </button>
          </div>

          <div className="h-px bg-slate-200 my-2" />

          {/* Import section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-800">ייבוא מסמך ממחשבך</div>
              <div className="text-[11px] text-slate-500">תומך בקבצי TXT, MD, וגיבוי JSON</div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
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
