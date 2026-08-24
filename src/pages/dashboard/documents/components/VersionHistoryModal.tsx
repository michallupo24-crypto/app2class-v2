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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-card rounded-lg w-full max-w-4xl border border-border overflow-hidden flex flex-col h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted">
          <div className="flex items-center gap-2 font-bold text-base text-foreground">
            <RotateCcw className="w-5 h-5 text-primary" />
            <span>היסטוריית גרסאות ושחזור</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content split view: Timeline on right, Preview on left */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version List (Right side in RTL) */}
          <div className="w-72 border-l border-border bg-muted p-3 overflow-y-auto space-y-2">
            <span className="font-bold text-xs text-muted-foreground block mb-1">גרסאות שנשמרו:</span>
            {history.map((ver) => (
              <button
                key={ver.id}
                onClick={() => setSelectedVersion(ver)}
                className={`w-full text-right p-3 rounded-xl border text-xs transition-colors ${
                  selectedVersion?.id === ver.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border hover:border-primary/40 text-foreground'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{ver.title}</span>
                  <span className={`text-[10px] ${selectedVersion?.id === ver.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {ver.timestamp}
                  </span>
                </div>
                <div className={`text-[11px] ${selectedVersion?.id === ver.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  מאת: {ver.author}
                </div>
                {ver.changeSummary && (
                  <div className={`mt-1 text-[10px] italic ${selectedVersion?.id === ver.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    "{ver.changeSummary}"
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Version Preview (Left side) */}
          <div className="flex-1 p-6 flex flex-col bg-muted/60 overflow-hidden">
            {selectedVersion ? (
              <>
                <div className="flex items-center justify-between mb-4 bg-card p-3 rounded-xl border border-border">
                  <div>
                    <div className="font-bold text-sm text-foreground">{selectedVersion.title}</div>
                    <div className="text-xs text-muted-foreground">נשמר ב-{selectedVersion.timestamp} על ידי {selectedVersion.author}</div>
                  </div>

                  <button
                    onClick={() => {
                      onRestoreVersion(selectedVersion);
                      onClose();
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>שחזר גרסה זו למסמך</span>
                  </button>
                </div>

                <div className="flex-1 bg-card p-6 rounded-xl border border-border overflow-y-auto text-foreground text-xs leading-relaxed prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedVersion.contentHtml }} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                בחר גרסה מהרשימה לצפייה ושחזור.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
