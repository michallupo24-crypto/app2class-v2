import React, { useState } from 'react';
import { X, Check, Code, PlusCircle } from 'lucide-react';
import { AVAILABLE_LIBRARIES } from './libraries';

interface LibrarySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLibraries: string[];
  onToggleLibrary: (libId: string) => void;
  onInsertCodeSample?: (snippet: string) => void;
}

export const LibrarySelectorModal: React.FC<LibrarySelectorModalProps> = ({
  isOpen,
  onClose,
  selectedLibraries,
  onToggleLibrary,
  onInsertCodeSample
}) => {
  const [injectedLibId, setInjectedLibId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInsertSample = (e: React.MouseEvent, libId: string, snippet?: string) => {
    e.stopPropagation();
    if (!snippet || !onInsertCodeSample) return;
    if (!selectedLibraries.includes(libId)) {
      onToggleLibrary(libId);
    }
    onInsertCodeSample(snippet);
    setInjectedLibId(libId);
    setTimeout(() => setInjectedLibId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] text-[#E0E0E0]">
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2A] bg-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">ספריות וכלים להזרקה (Libraries Injection)</h3>
              <p className="text-xs text-gray-400">בחר ספריות שיוזרקו אוטומטית למשימה, והכנס קטעי קוד לדוגמה בלחיצת כפתור.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_LIBRARIES.map((lib) => {
            const isSelected = selectedLibraries.includes(lib.id);
            const isInjected = injectedLibId === lib.id;
            return (
              <div
                key={lib.id}
                onClick={() => onToggleLibrary(lib.id)}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelected ? 'border-blue-500 bg-blue-600/10' : 'border-[#2A2A2A] bg-[#1A1A1A] hover:border-gray-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white text-sm">{lib.name}</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-[#3A3A3A]'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">{lib.description}</p>
                </div>

                {lib.sampleSnippet && (
                  <div className="mt-2 bg-[#0A0A0A] text-gray-300 p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto border border-[#2A2A2A] relative" dir="ltr">
                    <div className="flex justify-between items-center mb-1 text-[10px] text-gray-500">
                      <span>דוגמת קוד:</span>
                      {onInsertCodeSample && (
                        <button
                          onClick={(e) => handleInsertSample(e, lib.id, lib.sampleSnippet)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                            isInjected ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                          }`}
                          title="הכנס קטע קוד זה ישירות לעורך"
                        >
                          {isInjected ? <Check className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
                          <span>{isInjected ? 'הוזרק לעורך!' : 'הכנס לעורך'}</span>
                        </button>
                      )}
                    </div>
                    <pre>{lib.sampleSnippet}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">נבחרו {selectedLibraries.length} ספריות</span>
          <button
            onClick={onClose}
            className="bg-white text-black hover:bg-gray-200 font-semibold px-6 py-2 rounded-xl text-xs transition cursor-pointer shadow-md"
          >
            אישור וסגירה
          </button>
        </div>
      </div>
    </div>
  );
};
