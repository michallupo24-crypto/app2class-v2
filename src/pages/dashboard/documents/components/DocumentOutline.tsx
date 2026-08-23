import React from 'react';
import { Bookmark, ChevronLeft, Search, FileText } from 'lucide-react';
import { extractHeadings } from '../utils/editorUtils';

interface DocumentOutlineProps {
  contentHtml: string;
  onClose: () => void;
}

export const DocumentOutline: React.FC<DocumentOutlineProps> = ({ contentHtml, onClose }) => {
  const headings = extractHeadings(contentHtml);

  return (
    <aside className="w-48 bg-white border-l border-gray-200 p-4 shrink-0 flex flex-col gap-4 select-none shadow-xs z-10">
      {/* Outline Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
          מבנה המסמך
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
          title="סגור תפריט"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List of extracted headings */}
      <div className="flex-1 overflow-y-auto space-y-3 text-[12px]">
        {headings.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">
            <FileText className="w-6 h-6 mx-auto mb-2 opacity-40 text-gray-400" />
            <p className="text-[11px]">אין כותרות במסמך</p>
          </div>
        ) : (
          headings.map((h, i) => (
            <button
              key={i}
              className={`w-full text-right transition-colors block truncate ${
                h.level === 1
                  ? 'text-blue-600 font-bold flex items-center gap-2'
                  : h.level === 2
                  ? 'text-gray-500 hover:text-gray-800 pr-4'
                  : 'text-gray-400 hover:text-gray-700 pr-6'
              }`}
            >
              {h.level === 1 && <span className="text-blue-600 text-[10px]">●</span>}
              <span className="truncate">{h.text}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
