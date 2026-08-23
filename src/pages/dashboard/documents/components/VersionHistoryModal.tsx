import React, { useState } from 'react';
import { RotateCcw, Clock, User, Check, Eye, X } from 'lucide-react';
import { VersionHistory } from '../types';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: VersionHistory[];
  onRestoreVersion: (version: VersionHistory) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onRestoreVersion
}) => {
  const [selectedVersion, setSelectedVersion] = useState<VersionHistory | null>(
    history.length > 0 ? history[0] : null
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden flex flex-col h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 font-bold text-base text-slate-800">
            <RotateCcw className="w-5 h-5 text-blue-600" />
            <span>היסטוריית גרסאות ושחזור</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content split view: Timeline on right, Preview on left */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version List (Right side in RTL) */}
          <div className="w-72 border-l border-slate-200 bg-slate-50 p-3 overflow-y-auto space-y-2">
            <span className="font-bold text-xs text-slate-700 block mb-1">גרסאות שנשמרו:</span>
            {history.map((ver) => (
              <button
                key={ver.id}
                onClick={() => setSelectedVersion(ver)}
                className={`w-full text-right p-3 rounded-xl border text-xs transition-all ${
                  selectedVersion?.id === ver.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{ver.title}</span>
                  <span className={`text-[10px] ${selectedVersion?.id === ver.id ? 'text-blue-100' : 'text-slate-400'}`}>
                    {ver.timestamp}
                  </span>
                </div>
                <div className={`text-[11px] ${selectedVersion?.id === ver.id ? 'text-blue-100' : 'text-slate-500'}`}>
                  מאת: {ver.author}
                </div>
                {ver.changeSummary && (
                  <div className={`mt-1 text-[10px] italic ${selectedVersion?.id === ver.id ? 'text-blue-200' : 'text-slate-400'}`}>
                    "{ver.changeSummary}"
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Version Preview (Left side) */}
          <div className="flex-1 p-6 flex flex-col bg-slate-100/60 overflow-hidden">
            {selectedVersion ? (
              <>
                <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <div className="font-bold text-sm text-slate-800">{selectedVersion.title}</div>
                    <div className="text-xs text-slate-500">נשמר ב-{selectedVersion.timestamp} על ידי {selectedVersion.author}</div>
                  </div>

                  <button
                    onClick={() => {
                      onRestoreVersion(selectedVersion);
                      onClose();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>שחזר גרסה זו למסמך</span>
                  </button>
                </div>

                <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 overflow-y-auto text-slate-800 text-xs leading-relaxed prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedVersion.contentHtml }} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                בחר גרסה מהרשימה לצפייה ושחזור.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
