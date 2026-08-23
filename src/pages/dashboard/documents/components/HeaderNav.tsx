import React, { useState } from 'react';
import {
  FileText, Star, CheckCircle2, Share2, Sparkles, UserPlus,
  Eye, Edit3, MessageSquare, ChevronDown, RotateCcw,
  Download, Printer, Folder, Grid
} from 'lucide-react';
import { DocumentModel, DocMode, Collaborator } from '../types';

interface HeaderNavProps {
  document: DocumentModel;
  onUpdateTitle: (title: string) => void;
  onToggleFavorite: () => void;
  onSelectDocMode: (mode: DocMode) => void;
  onOpenShare: () => void;
  onOpenDashboard: () => void;
  onOpenHistory: () => void;
  onOpenExport: () => void;
  onPrint: () => void;
  canEdit?: boolean;
  canShare?: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  document,
  onUpdateTitle,
  onToggleFavorite,
  onSelectDocMode,
  onOpenShare,
  onOpenDashboard,
  onOpenHistory,
  onOpenExport,
  onPrint,
  canEdit = true,
  canShare = true,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(document.title);
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdateTitle(titleInput.trim());
    } else {
      setTitleInput(document.title);
    }
  };

  return (
    <header className="h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between gap-4 shrink-0 shadow-2xs select-none">
      {/* Right side (RTL start): App Logo, Title, Menu links */}
      <div className="flex items-center gap-3">
        {/* Dashboard/Logo Icon */}
        <button
          onClick={onOpenDashboard}
          title="חזור למסמכים שלי"
          className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-md flex items-center justify-center text-white font-bold shadow-xs transition-colors shrink-0"
        >
          <FileText className="w-5 h-5" />
        </button>

        {/* Title and Top Action Links */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 leading-tight">
            {isEditingTitle && canEdit ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                autoFocus
                className="font-semibold text-gray-800 text-sm px-1.5 py-0 border border-blue-400 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              <h1
                onClick={() => canEdit && setIsEditingTitle(true)}
                className={`font-semibold text-gray-800 text-sm px-1.5 py-0.5 rounded transition-colors truncate max-w-[220px] sm:max-w-[340px] ${canEdit ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                title={canEdit ? 'לחץ לעריכת שם המסמך' : undefined}
              >
                {document.title}
              </h1>
            )}

            {/* Favorite Star */}
            <button
              onClick={onToggleFavorite}
              className={`p-0.5 rounded hover:bg-gray-100 transition-colors ${
                document.isFavorite ? 'text-amber-500' : 'text-gray-300 hover:text-gray-400'
              }`}
              title={document.isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Save Status Badge */}
            <div className="hidden lg:flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>נשמר</span>
            </div>
          </div>

          {/* Sub-menu text items */}
          <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium mt-0.5">
            <button onClick={onOpenExport} className="hover:underline hover:text-gray-700 transition-colors cursor-pointer">
              קובץ
            </button>
            <button onClick={onOpenHistory} className="hover:underline hover:text-gray-700 transition-colors cursor-pointer">
              היסטוריה
            </button>
            <button onClick={onPrint} className="hover:underline hover:text-gray-700 transition-colors cursor-pointer">
              הדפסה
            </button>
          </div>
        </div>
      </div>

      {/* Left side (RTL end): Doc Mode & Share button */}
      <div className="flex items-center gap-2 shrink-0">
        {!canEdit && (
          <div className="bg-gray-50 text-gray-500 px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 border border-gray-100">
            <Eye className="w-3 h-3" />
            <span>{document.docMode === 'suggesting' ? 'מצב הערות בלבד' : 'תצוגה בלבד'}</span>
          </div>
        )}
        {/* Mode Selector Dropdown */}
        {canEdit && (
        <div className="relative">
          <button
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition-colors border border-blue-100"
          >
            {document.docMode === 'editing' && <Edit3 className="w-3 h-3 text-blue-600" />}
            {document.docMode === 'suggesting' && <MessageSquare className="w-3 h-3 text-emerald-600" />}
            {document.docMode === 'viewing' && <Eye className="w-3 h-3 text-gray-600" />}
            <span>
              {document.docMode === 'editing' && 'מצב עריכה'}
              {document.docMode === 'suggesting' && 'מצב הצעות'}
              {document.docMode === 'viewing' && 'מצב תצוגה'}
            </span>
            <ChevronDown className="w-3 h-3 text-blue-400" />
          </button>

          {showModeDropdown && (
            <div className="absolute left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 text-xs">
              <button
                onClick={() => { onSelectDocMode('editing'); setShowModeDropdown(false); }}
                className="w-full text-right px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-gray-800">עריכה</span>
              </button>
              <button
                onClick={() => { onSelectDocMode('suggesting'); setShowModeDropdown(false); }}
                className="w-full text-right px-3 py-1.5 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold text-gray-800">הצעות</span>
              </button>
              <button
                onClick={() => { onSelectDocMode('viewing'); setShowModeDropdown(false); }}
                className="w-full text-right px-3 py-1.5 hover:bg-gray-100 flex items-center gap-2 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-gray-600" />
                <span className="font-semibold text-gray-800">תצוגה בלבד</span>
              </button>
            </div>
          )}
        </div>
        )}

        {/* Share Button */}
        {canShare && (
        <button
          onClick={onOpenShare}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>שיתוף</span>
        </button>
        )}
      </div>
    </header>
  );
};
