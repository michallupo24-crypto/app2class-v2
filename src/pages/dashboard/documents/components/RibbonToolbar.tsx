import React, { useState } from 'react';
import { 
  Undo, Redo, Bold, Italic, Underline, Strikethrough, 
  AlignRight, AlignCenter, AlignLeft, AlignJustify, 
  List, ListOrdered, CheckSquare, Globe, ArrowRightLeft, 
  Palette, Highlighter, Type, Image, Table, Minus, 
  Sparkles, FilePlus, Layers, Eye, CheckCircle2, MessageSquare, 
  ZoomIn, ZoomOut, Maximize2, SplitSquareVertical, HelpCircle, 
  Bookmark, Layout, Columns, Paintbrush, Sliders, Heading1, Heading2, Heading3, Quote, Hash,
  SpellCheck, AlertTriangle
} from 'lucide-react';
import { RibbonTab, DocumentModel, ViewMode } from '../types';
import { formatDoc, applyStyleToSelectionOrNode, insertHtmlAtCursorOrAppend } from '../utils/editorUtils';

interface RibbonToolbarProps {
  document: DocumentModel;
  activeTab: RibbonTab;
  onChangeTab: (tab: RibbonTab) => void;
  onUpdateDocument: (updates: Partial<DocumentModel>) => void;
  onInsertTable: (rows: number, cols: number) => void;
  onInsertImage: () => void;
  onInsertCallout: () => void;
  onInsertHorizontalLine: () => void;
  onToggleOutline: () => void;
  onToggleComments: () => void;
  showOutline: boolean;
  showComments: boolean;
  showRuler: boolean;
  onToggleRuler: () => void;
  onToggleSpellCheck?: () => void;
  showSpellCheck?: boolean;
  spellErrorCount?: number;
  onToggleSpellMarks?: () => void;
  isSpellMarksActive?: boolean;
  onAddPage?: () => void;
}

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  document,
  activeTab,
  onChangeTab,
  onUpdateDocument,
  onInsertTable,
  onInsertImage,
  onInsertCallout,
  onInsertHorizontalLine,
  onToggleOutline,
  onToggleComments,
  showOutline,
  showComments,
  showRuler,
  onToggleRuler,
  onToggleSpellCheck,
  showSpellCheck = false,
  spellErrorCount = 0,
  onToggleSpellMarks,
  isSpellMarksActive = false,
  onAddPage
}) => {
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showPageNumberPicker, setShowPageNumberPicker] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [textColor, setTextColor] = useState('#1e293b');
  const [highlightColor, setHighlightColor] = useState('#fef08a');

  const runFormatDoc = (command: string, value: string | null = null) => {
    const newHtml = formatDoc(command, value);
    if (newHtml) {
      onUpdateDocument({ contentHtml: newHtml });
    }
  };

  const runApplyStyle = (
    styleName: 'color' | 'fontSize' | 'backgroundColor' | 'fontFamily',
    value: string
  ) => {
    const newHtml = applyStyleToSelectionOrNode(styleName, value);
    if (newHtml) {
      onUpdateDocument({ contentHtml: newHtml });
    }
  };

  const runInsertHtml = (html: string) => {
    const newHtml = insertHtmlAtCursorOrAppend(html);
    if (newHtml) {
      onUpdateDocument({ contentHtml: newHtml });
    }
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const font = e.target.value;
    onUpdateDocument({ fontFamily: font });
    runApplyStyle('fontFamily', font);
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    onUpdateDocument({ fontSize: size });
    runApplyStyle('fontSize', size);
  };

  const handleHeadingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tag = e.target.value;
    if (tag === 'p') runFormatDoc('formatBlock', '<p>');
    else if (tag === 'h1') runFormatDoc('formatBlock', '<h1>');
    else if (tag === 'h2') runFormatDoc('formatBlock', '<h2>');
    else if (tag === 'h3') runFormatDoc('formatBlock', '<h3>');
    else if (tag === 'blockquote') runFormatDoc('formatBlock', '<blockquote>');
  };

  const applyTextColor = (color: string) => {
    setTextColor(color);
    runApplyStyle('color', color);
  };

  const applyHighlightColor = (color: string) => {
    setHighlightColor(color);
    runApplyStyle('backgroundColor', color);
  };

  return (
    <div className="bg-white border-b border-gray-200 p-1 flex flex-col shrink-0 shadow-sm select-none">
      {/* Top Ribbon Tabs Bar */}
      <div className="flex gap-5 px-3 text-[11px] font-bold text-gray-500 border-b border-gray-100 mb-1 overflow-x-auto">
        <button
          onClick={() => onChangeTab('home')}
          className={`pb-1 px-1 cursor-pointer transition-colors ${
            activeTab === 'home'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'hover:text-gray-800 opacity-70'
          }`}
        >
          <span>בית</span>
        </button>

        <button
          onClick={() => onChangeTab('insert')}
          className={`pb-1 px-1 cursor-pointer transition-colors ${
            activeTab === 'insert'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'hover:text-gray-800 opacity-70'
          }`}
        >
          <span>הוספה</span>
        </button>

        <button
          onClick={() => onChangeTab('layout')}
          className={`pb-1 px-1 cursor-pointer transition-colors ${
            activeTab === 'layout'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'hover:text-gray-800 opacity-70'
          }`}
        >
          <span>פריסת עמוד</span>
        </button>

        <button
          onClick={() => onChangeTab('review')}
          className={`pb-1 px-1 cursor-pointer transition-colors ${
            activeTab === 'review'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'hover:text-gray-800 opacity-70'
          }`}
        >
          <span>סקירה והערות</span>
        </button>

        <button
          onClick={() => onChangeTab('view')}
          className={`pb-1 px-1 cursor-pointer transition-colors ${
            activeTab === 'view'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'hover:text-gray-800 opacity-70'
          }`}
        >
          <span>תצוגה</span>
        </button>
      </div>

      {/* Tab Content Panel */}
      <div className="flex items-center gap-2 px-3 py-1 overflow-x-auto min-h-[42px]">
        
        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <div className="flex items-center gap-3 divide-x divide-x-reverse divide-slate-200 text-xs">
            {/* Quick Add Page */}
            {onAddPage && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onAddPage}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs"
                title="הוסף עמוד חדש למסמך (Ctrl+Enter)"
              >
                <FilePlus className="w-4 h-4 text-blue-600" />
                <span>הוסף עמוד</span>
              </button>
            )}

            {/* History actions */}
            <div className="flex items-center gap-1 pr-2">
              <button
                onClick={() => runFormatDoc('undo')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md text-slate-700 transition-colors"
                title="בטל (Ctrl+Z)"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                onClick={() => runFormatDoc('redo')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md text-slate-700 transition-colors"
                title="בצע שוב (Ctrl+Y)"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>

            {/* Font & Styles dropdowns */}
            <div className="flex items-center gap-2 pr-3">
              {/* Heading selector */}
              <select
                onChange={handleHeadingChange}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium hover:border-slate-400 focus:outline-hidden"
              >
                <option value="p">טקסט רגיל</option>
                <option value="h1">כותרת 1 (H1)</option>
                <option value="h2">כותרת 2 (H2)</option>
                <option value="h3">כותרת 3 (H3)</option>
                <option value="blockquote">ציטוט / הדגשה</option>
              </select>

              {/* Font Family */}
              <select
                value={document.fontFamily}
                onChange={handleFontFamilyChange}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium hover:border-slate-400 focus:outline-hidden"
              >
                <option value="Rubik">Rubik (רוביק)</option>
                <option value="Heebo">Heebo (היבו)</option>
                <option value="Assistant">Assistant (אסיסטנט)</option>
                <option value="Frank Ruhl Libre">Frank Ruhl (פרנק רוהל)</option>
                <option value="David Libre">David (דוד)</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier (קוד)</option>
              </select>

              {/* Font Size */}
              <select
                value={document.fontSize}
                onChange={handleFontSizeChange}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium hover:border-slate-400 focus:outline-hidden w-16"
                title="גודל גופן"
              >
                <option value="12px">12</option>
                <option value="14px">14</option>
                <option value="16px">16</option>
                <option value="18px">18</option>
                <option value="20px">20</option>
                <option value="24px">24</option>
                <option value="28px">28</option>
                <option value="32px">32</option>
                <option value="36px">36</option>
                <option value="48px">48</option>
                <option value="72px">72</option>
              </select>
            </div>

            {/* Basic Formatting B I U S */}
            <div className="flex items-center gap-0.5 pr-3">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('bold')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md font-bold text-slate-800 transition-colors"
                title="מוגשם (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('italic')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md italic text-slate-800 transition-colors"
                title="נטוי (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('underline')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md underline text-slate-800 transition-colors"
                title="קו תחתוני (Ctrl+U)"
              >
                <Underline className="w-4 h-4" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('strikeThrough')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md line-through text-slate-800 transition-colors"
                title="קו חוצה"
              >
                <Strikethrough className="w-4 h-4" />
              </button>

              {/* Quick Text Color Palette */}
              <div className="flex items-center gap-1 border-r border-l border-slate-200 px-2 mx-1">
                <span className="text-[10px] text-slate-500 font-bold ml-1">צבע:</span>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTextColor('#1e293b')}
                  className="w-4 h-4 rounded-full bg-slate-800 hover:scale-125 transition-transform ring-1 ring-slate-300"
                  title="שחור/כהה"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTextColor('#2563eb')}
                  className="w-4 h-4 rounded-full bg-blue-600 hover:scale-125 transition-transform ring-1 ring-slate-300"
                  title="כחול"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTextColor('#dc2626')}
                  className="w-4 h-4 rounded-full bg-red-600 hover:scale-125 transition-transform ring-1 ring-slate-300"
                  title="אדום"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTextColor('#16a34a')}
                  className="w-4 h-4 rounded-full bg-emerald-600 hover:scale-125 transition-transform ring-1 ring-slate-300"
                  title="ירוק"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTextColor('#9333ea')}
                  className="w-4 h-4 rounded-full bg-purple-600 hover:scale-125 transition-transform ring-1 ring-slate-300"
                  title="סגול"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTextColor('#d97706')}
                  className="w-4 h-4 rounded-full bg-amber-600 hover:scale-125 transition-transform ring-1 ring-slate-300"
                  title="כתום"
                />
                <label className="p-1 hover:bg-slate-200/70 rounded-md cursor-pointer flex items-center justify-center relative" title="בחירת צבע מותאם אישית">
                  <Palette className="w-3.5 h-3.5 text-slate-600" />
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => applyTextColor(e.target.value)}
                    className="w-0 h-0 opacity-0 absolute"
                  />
                </label>
              </div>

              {/* Highlight Picker */}
              <label className="p-1.5 hover:bg-slate-200/70 rounded-md cursor-pointer flex items-center gap-1" title="צבע מרקר (Highlight)">
                <Highlighter className="w-4 h-4 text-amber-500" />
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => applyHighlightColor(e.target.value)}
                  className="w-0 h-0 opacity-0 absolute"
                />
              </label>
            </div>

            {/* Alignment & Lists */}
            <div className="flex items-center gap-0.5 pr-3">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('justifyRight')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md text-slate-700 transition-colors"
                title="יישור לימין"
              >
                <AlignRight className="w-4 h-4" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('justifyCenter')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md text-slate-700 transition-colors"
                title="יישור למרכז"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('justifyLeft')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md text-slate-700 transition-colors"
                title="יישור לשמאל"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('justifyFull')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md text-slate-700 transition-colors"
                title="יישור לשני הצדדים (Justify)"
              >
                <AlignJustify className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('insertUnorderedList')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md text-slate-700 transition-colors"
                title="רשימת נקודות (Bulleted)"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runFormatDoc('insertOrderedList')}
                className="p-1.5 hover:bg-slate-200/70 rounded-md text-slate-700 transition-colors"
                title="רשימה ממוספרת (Numbered)"
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              {/* Text Direction RTL / LTR Toggle */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const newDir = document.dir === 'rtl' ? 'ltr' : 'rtl';
                  onUpdateDocument({ dir: newDir });
                }}
                className="px-2 py-1 bg-slate-200/60 hover:bg-slate-300/70 rounded-md text-slate-800 font-bold flex items-center gap-1 transition-colors"
                title="שנה כיוון טקסט (RTL/LTR)"
              >
                {document.dir === 'rtl' ? <Globe className="w-4 h-4 text-blue-600" /> : <ArrowRightLeft className="w-4 h-4 text-indigo-600" />}
                <span className="uppercase text-[10px]">{document.dir}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================== INSERT TAB ==================== */}
        {activeTab === 'insert' && (
          <div className="flex items-center gap-3 text-xs">
            {/* Table Generator */}
            <div className="relative">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowTablePicker(!showTablePicker)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex items-center gap-1.5 font-semibold text-slate-700 transition-colors"
              >
                <Table className="w-4 h-4 text-blue-600" />
                <span>הוסף טבלה</span>
              </button>

              {showTablePicker && (
                <div className="absolute right-0 mt-1 p-3 bg-white border border-slate-200 rounded-xl shadow-xl z-50 w-56 text-xs animate-in fade-in zoom-in duration-150">
                  <div className="font-bold text-slate-800 mb-2 text-center">בחר גודל טבלה</div>
                  
                  {/* Grid Matrix Picker 5x5 */}
                  <div className="grid grid-cols-5 gap-1 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-200 justify-items-center">
                    {Array.from({ length: 25 }).map((_, i) => {
                      const r = Math.floor(i / 5) + 1;
                      const c = (i % 5) + 1;
                      const isHovered = r <= tableRows && c <= tableCols;
                      return (
                        <div
                          key={i}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => {
                            setTableRows(r);
                            setTableCols(c);
                          }}
                          onClick={() => {
                            onInsertTable(r, c);
                            setShowTablePicker(false);
                          }}
                          className={`w-7 h-7 border rounded-sm cursor-pointer transition-colors ${
                            isHovered ? 'bg-blue-500 border-blue-600' : 'bg-white border-slate-300 hover:border-slate-400'
                          }`}
                          title={`${r} שורות x ${c} עמודות`}
                        />
                      );
                    })}
                  </div>

                  <div className="text-center font-bold text-slate-700 mb-2">
                    {tableRows} שורות × {tableCols} עמודות
                  </div>

                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onInsertTable(tableRows, tableCols);
                      setShowTablePicker(false);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg transition-colors shadow-xs"
                  >
                    הכנס טבלה ({tableRows}x{tableCols})
                  </button>
                </div>
              )}
            </div>

            {/* Insert Image */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onInsertImage}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex items-center gap-1.5 font-semibold text-slate-700 transition-colors"
            >
              <Image className="w-4 h-4 text-emerald-600" />
              <span>הוסף תמונה</span>
            </button>

            {/* Insert Callout / Highlight Box */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onInsertCallout}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex items-center gap-1.5 font-semibold text-slate-700 transition-colors"
            >
              <Quote className="w-4 h-4 text-amber-600" />
              <span>תיבת דגש / ציטוט</span>
            </button>

            {/* Insert Divider Line */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onInsertHorizontalLine}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex items-center gap-1.5 font-semibold text-slate-700 transition-colors"
            >
              <Minus className="w-4 h-4 text-slate-600" />
              <span>קו מפריד</span>
            </button>

            {/* Insert Page / Page Break */}
            {onAddPage && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={onAddPage}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5 font-bold transition-colors shadow-xs"
                title="הוסף עמוד חדש למסמך (Ctrl+Enter)"
              >
                <FilePlus className="w-4 h-4" />
                <span>הוסף עמוד</span>
              </button>
            )}

            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (onAddPage) {
                  onAddPage();
                }
              }}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-100 flex items-center gap-1.5 font-semibold text-slate-700 transition-colors"
              title="מעבר עמוד במיקום הסמן (Ctrl+Enter)"
            >
              <SplitSquareVertical className="w-4 h-4 text-indigo-600" />
              <span>מעבר עמוד (Break)</span>
            </button>

            {/* Page Numbering Menu */}
            <div className="relative">
              <button
                onClick={() => setShowPageNumberPicker(!showPageNumberPicker)}
                className={`px-3 py-1.5 border rounded-md flex items-center gap-1.5 font-semibold transition-colors ${
                  document.showPageNumbers
                    ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-2xs'
                    : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Hash className="w-4 h-4 text-purple-600" />
                <span>מספור עמודים</span>
                {document.showPageNumbers && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                )}
              </button>

              {showPageNumberPicker && (
                <div className="absolute right-0 mt-1 p-3 bg-white border border-slate-200 rounded-xl shadow-xl z-50 w-64 text-xs animate-in fade-in zoom-in duration-150">
                  <div className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1.5 flex justify-between items-center">
                    <span>הגדרות מספור עמודים</span>
                    <button
                      onClick={() => setShowPageNumberPicker(false)}
                      className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Toggle Page Numbers On/Off */}
                  <label className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer mb-2 border border-slate-100">
                    <span className="font-semibold text-slate-700">הצג מספור בעמודים:</span>
                    <input
                      type="checkbox"
                      checked={document.showPageNumbers}
                      onChange={(e) => onUpdateDocument({ showPageNumbers: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                  </label>

                  {/* Position Selection */}
                  <div className="mb-2">
                    <span className="block font-semibold text-slate-700 mb-1">מיקום המספור:</span>
                    <select
                      value={document.pageNumberPosition || 'footer_left'}
                      onChange={(e) => onUpdateDocument({ 
                        showPageNumbers: true, 
                        pageNumberPosition: e.target.value as any 
                      })}
                      className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                    >
                      <option value="footer_left">בתחתית העמוד (שמאל / רגיל)</option>
                      <option value="footer_center">בתחתית העמוד (מרכז)</option>
                      <option value="footer_right">בתחתית העמוד (ימין)</option>
                      <option value="header_left">בראש העמוד (שמאל)</option>
                      <option value="header_right">בראש העמוד (ימין)</option>
                    </select>
                  </div>

                  {/* Format Selection */}
                  <div className="mb-3">
                    <span className="block font-semibold text-slate-700 mb-1">פורמט מספור:</span>
                    <select
                      value={document.pageNumberFormat || 'standard'}
                      onChange={(e) => onUpdateDocument({ 
                        showPageNumbers: true, 
                        pageNumberFormat: e.target.value as any 
                      })}
                      className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-md text-slate-800"
                    >
                      <option value="standard">עמוד 1 מתוך 1</option>
                      <option value="page_x">עמוד 1</option>
                      <option value="simple">1 (מספר בלבד)</option>
                      <option value="hebrew">עמוד א' (אותיות עבריות)</option>
                    </select>
                  </div>

                  {/* Insert Dynamic Token into cursor */}
                  <button
                    onClick={() => {
                      runInsertHtml(
                        '<span class="page-number-token bg-blue-100 text-blue-900 border border-blue-300 rounded px-2 py-0.5 font-mono text-xs font-bold inline-flex items-center gap-1 mx-1 select-none" contenteditable="false" title="שדה מספור עמודים דינמי">📄 עמוד 1</span>'
                      );
                      setShowPageNumberPicker(false);
                    }}
                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>הכנס שדה מספור בטקסט</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== LAYOUT TAB (WORD / DOCS) ==================== */}
        {activeTab === 'layout' && (
          <div className="flex items-center gap-4 text-xs">
            {/* View Mode Toggle: Paged (Word A4) vs Pageless (Docs) */}
            <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
              <button
                onClick={() => onUpdateDocument({ viewMode: 'paged' })}
                className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition-all ${
                  document.viewMode === 'paged'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="תצוגת עמודים מודפסים סטנדרטית (Word A4)"
              >
                <Layout className="w-3.5 h-3.5" />
                <span>עמודים (Word A4)</span>
              </button>

              <button
                onClick={() => onUpdateDocument({ viewMode: 'pageless' })}
                className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition-all ${
                  document.viewMode === 'pageless'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="תצוגה רציפה ללא גבולות עמוד (Google Docs Pageless)"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>רציף (Docs Pageless)</span>
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            {/* Margins Selection */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">שוליים:</span>
              <select
                onChange={(e) => {
                  const m = parseInt(e.target.value);
                  onUpdateDocument({ margins: { top: m, bottom: m, left: m, right: m } });
                }}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-slate-800"
              >
                <option value="25">רגיל (25mm)</option>
                <option value="12">צר (12mm)</option>
                <option value="38">רחב (38mm)</option>
              </select>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            {/* Page Numbers Toggle in Layout */}
            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-md border border-slate-300">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-purple-600" />
                מספור עמודים:
              </span>
              <button
                onClick={() => onUpdateDocument({ showPageNumbers: !document.showPageNumbers })}
                className={`px-2.5 py-0.5 text-xs font-bold rounded transition-colors ${
                  document.showPageNumbers
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {document.showPageNumbers ? 'פעיל' : 'כבוי'}
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            {/* Watermark text */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">סימן מים:</span>
              <input
                type="text"
                placeholder="למשל: סודי / טיוטה"
                value={document.watermarkText}
                onChange={(e) => onUpdateDocument({ watermarkText: e.target.value })}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-slate-800 w-32"
              />
            </div>

            {/* Page background color */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">צבע עמוד:</span>
              <input
                type="color"
                value={document.pageBgColor}
                onChange={(e) => onUpdateDocument({ pageBgColor: e.target.value })}
                className="w-7 h-7 rounded-md cursor-pointer border border-slate-300"
                title="בחר צבע רקע לעמוד"
              />
            </div>
          </div>
        )}

        {/* ==================== REVIEW TAB ==================== */}
        {activeTab === 'review' && (
          <div className="flex items-center gap-3 text-xs">
            {/* Spell Check Panel Toggle */}
            <button
              onClick={onToggleSpellCheck}
              className={`px-3 py-1.5 rounded-md border flex items-center gap-2 font-bold transition-colors ${
                showSpellCheck
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title="פתח חלונית בדיקת איות ושגיאות כתיב במילון מקומי"
            >
              <SpellCheck className="w-4 h-4 text-rose-600" />
              <span>בדיקת איות ודקדוק</span>
              {spellErrorCount > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-bold">
                  {spellErrorCount}
                </span>
              )}
            </button>

            {/* Toggle Inline Spell Highlighting */}
            {onToggleSpellMarks && (
              <button
                onClick={onToggleSpellMarks}
                className={`px-3 py-1.5 rounded-md border flex items-center gap-1.5 font-bold transition-colors ${
                  isSpellMarksActive
                    ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
                title="הצג או הסתר קווי גלים אדומים תחת מילים שגויות בתוך המסמך"
              >
                <AlertTriangle className={`w-4 h-4 ${isSpellMarksActive ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>{isSpellMarksActive ? 'הסתר קו הדגשת שגיאות' : 'הדגש שגיאות בטקסט'}</span>
              </button>
            )}

            <div className="h-6 w-px bg-slate-200" />

            <button
              onClick={onToggleComments}
              className={`px-3 py-1.5 rounded-md border flex items-center gap-1.5 font-bold transition-colors ${
                showComments
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>הערות והצעות ({document.comments.length + document.suggestions.length})</span>
            </button>
          </div>
        )}

        {/* ==================== VIEW TAB ==================== */}
        {activeTab === 'view' && (
          <div className="flex items-center gap-4 text-xs">
            {/* Show/Hide Ruler */}
            <button
              onClick={onToggleRuler}
              className={`px-3 py-1.5 rounded-md border flex items-center gap-1.5 font-bold transition-colors ${
                showRuler
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>סרגל שוליים</span>
            </button>

            {/* Show/Hide Outline Sidebar */}
            <button
              onClick={onToggleOutline}
              className={`px-3 py-1.5 rounded-md border flex items-center gap-1.5 font-bold transition-colors ${
                showOutline
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>תוכן עניינים בצד</span>
            </button>

            <div className="h-6 w-px bg-slate-200" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md p-1">
              <button
                onClick={() => onUpdateDocument({ zoom: Math.max(50, document.zoom - 10) })}
                className="p-1 hover:bg-slate-100 rounded-md text-slate-700"
                title="הקטן תצוגה"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold w-12 text-center text-slate-800">{document.zoom}%</span>
              <button
                onClick={() => onUpdateDocument({ zoom: Math.min(200, document.zoom + 10) })}
                className="p-1 hover:bg-slate-100 rounded-md text-slate-700"
                title="הגדל תצוגה"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
