import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  MessageSquarePlus, Bold, Italic, AlignRight, AlignCenter, AlignLeft, 
  Trash2, Plus, Table as TableIcon, Image as ImageIcon, Paintbrush, 
  Quote, Type, Heading1, Heading2, Heading3, Highlighter, Palette,
  AlertTriangle, Check, X, BookOpen, SpellCheck, FileText, ChevronDown, SplitSquareVertical
} from 'lucide-react';
import { DocumentModel } from '../types';
import { 
  formatDoc, 
  applyStyleToSelectionOrNode, 
  saveSelection, 
  splitHtmlIntoPages, 
  joinPagesIntoHtml,
  getActiveEditor
} from '../utils/editorUtils';
import { checkWordSpell, replaceTypoInHtml, SpellingError } from '../utils/spellCheck';

interface DocumentCanvasProps {
  document: DocumentModel;
  onContentChange: (newHtml: string) => void;
  onAddCommentFromSelection: (selectedText: string) => void;
  showRuler: boolean;
  customDictionary?: string[];
  ignoredWords?: string[];
  activeSpellError?: SpellingError | null;
  onReplaceSpellError?: (error: SpellingError, correction: string, replaceAll?: boolean) => void;
  onAddToDictionary?: (word: string) => void;
  onIgnoreSpellError?: (errorIdOrWord: string) => void;
  onAddPage?: () => void;
}

type SelectedObjectType = 'text' | 'image' | 'table' | 'callout' | 'spell_error' | null;

interface ActiveSpellPopover {
  word: string;
  suggestions: string[];
  reason: string;
  element?: HTMLElement;
  errorId?: string;
  pageIndex?: number;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  document,
  onContentChange,
  onAddCommentFromSelection,
  customDictionary = [],
  ignoredWords = [],
  activeSpellError,
  onReplaceSpellError,
  onAddToDictionary,
  onIgnoreSpellError,
  onAddPage
}) => {
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const singleEditorRef = useRef<HTMLDivElement>(null);
  
  const [selectedText, setSelectedText] = useState('');
  const [selectedObjectType, setSelectedObjectType] = useState<SelectedObjectType>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [activeSpellPopover, setActiveSpellPopover] = useState<ActiveSpellPopover | null>(null);

  const isPaged = document.viewMode === 'paged';

  // Split document into distinct page sections
  const pages = useMemo(() => {
    return splitHtmlIntoPages(document.contentHtml);
  }, [document.contentHtml]);

  const totalPages = Math.max(1, pages.length);

  const customDictSet = new Set([...(document.customDictionary || []), ...customDictionary]);
  const ignoredWordsSet = new Set([...(document.ignoredWords || []), ...ignoredWords]);

  // Keep DOM content synced with state
  useEffect(() => {
    if (isPaged) {
      pages.forEach((pageHtml, idx) => {
        const el = pageRefs.current[idx];
        if (el && el.innerHTML !== pageHtml) {
          el.innerHTML = pageHtml;
        }
      });
    } else {
      if (singleEditorRef.current && singleEditorRef.current.innerHTML !== document.contentHtml) {
        singleEditorRef.current.innerHTML = document.contentHtml;
      }
    }
  }, [document.id, document.contentHtml, isPaged, pages]);

  // Listen for selection changes to persist current editor range
  useEffect(() => {
    const handleSelectionChange = () => {
      saveSelection();
    };
    window.document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      window.document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // When activeSpellError is selected externally from SpellCheckPanel, highlight and scroll to it
  useEffect(() => {
    if (!activeSpellError) return;
    
    // Clear previous targets across all pages
    const container = isPaged ? window.document : singleEditorRef.current;
    if (!container) return;

    const prevTargets = container.querySelectorAll('.active-spell-target');
    prevTargets.forEach(el => el.classList.remove('active-spell-target'));

    const targetSpan = container.querySelector(
      `[data-spell-word="${activeSpellError.word}"], [data-error-id="${activeSpellError.id}"]`
    ) as HTMLElement;

    if (targetSpan) {
      targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetSpan.classList.add('active-spell-target');
      const rect = targetSpan.getBoundingClientRect();
      setToolbarPos({
        top: Math.max(10, rect.bottom + 8),
        left: Math.max(10, Math.min(window.innerWidth - 260, rect.left + rect.width / 2 - 120))
      });
      setActiveSpellPopover({
        word: activeSpellError.word,
        suggestions: activeSpellError.suggestions,
        reason: activeSpellError.reason,
        element: targetSpan,
        errorId: activeSpellError.id
      });
      setSelectedObjectType('spell_error');
      setSelectedElement(targetSpan);
    }
  }, [activeSpellError, isPaged]);

  // Clean up active highlight classes
  const clearElementHighlight = () => {
    const highlighted = window.document.querySelectorAll('.active-object-selected, .active-spell-target');
    highlighted.forEach((el) => {
      el.classList.remove('active-object-selected');
      el.classList.remove('active-spell-target');
    });
  };

  // Sync content when typing inside a page
  const handlePageInput = (pageIndex: number, newPageHtml: string) => {
    const updatedPages = [...pages];
    updatedPages[pageIndex] = newPageHtml;
    const fullHtml = joinPagesIntoHtml(updatedPages, document);
    onContentChange(fullHtml);
  };

  // Sync content in pageless mode
  const handleSingleInput = () => {
    if (singleEditorRef.current) {
      onContentChange(singleEditorRef.current.innerHTML);
    }
  };

  // Helper to extract word under cursor or click target
  const getWordUnderCursor = (): string | null => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return null;
    const node = selection.anchorNode;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.textContent || '';
    const offset = selection.anchorOffset;

    let start = offset;
    while (start > 0 && !/[\s.,!?:;"'()[\]{}<>]/.test(text[start - 1])) {
      start--;
    }
    let end = offset;
    while (end < text.length && !/[\s.,!?:;"'()[\]{}<>]/.test(text[end])) {
      end++;
    }
    const word = text.slice(start, end).trim();
    return word.length >= 2 ? word : null;
  };

  // Interaction handler for tables, images, spellcheck popovers, and text selections
  const handleEditorInteraction = (e: React.SyntheticEvent) => {
    saveSelection();
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    const target = e.target as HTMLElement;
    const editor = target.closest('[contenteditable="true"]');
    if (!editor) return;

    clearElementHighlight();

    // 0. Check if Clicked Element is a Spell-Error Span or Typo
    const spellEl = target.closest('.spell-error') as HTMLElement | null;
    if (spellEl) {
      const word = spellEl.getAttribute('data-spell-word') || spellEl.innerText.trim();
      if (!ignoredWordsSet.has(word) && !ignoredWordsSet.has(word.toLowerCase())) {
        const check = checkWordSpell(word, customDictSet);
        if (check && check.isError) {
          spellEl.classList.add('active-spell-target');
          setSelectedElement(spellEl);
          setSelectedObjectType('spell_error');
          setSelectedText('');
          setActiveSpellPopover({
            word,
            suggestions: check.suggestions,
            reason: check.reason,
            element: spellEl,
            errorId: spellEl.getAttribute('data-error-id') || undefined
          });

          const rect = spellEl.getBoundingClientRect();
          setToolbarPos({
            top: Math.max(10, rect.bottom + 8),
            left: Math.max(10, Math.min(window.innerWidth - 270, rect.left + rect.width / 2 - 120))
          });
          return;
        }
      }
    }

    // 0b. Check if clicked word without span is an offline typo
    const wordAtCursor = text && !text.includes(' ') ? text : getWordUnderCursor();
    if (wordAtCursor && !ignoredWordsSet.has(wordAtCursor) && !ignoredWordsSet.has(wordAtCursor.toLowerCase())) {
      const check = checkWordSpell(wordAtCursor, customDictSet);
      if (check && check.isError) {
        setSelectedElement(target);
        setSelectedObjectType('spell_error');
        setSelectedText('');
        setActiveSpellPopover({
          word: wordAtCursor,
          suggestions: check.suggestions,
          reason: check.reason,
          element: target
        });

        const rect = target.getBoundingClientRect();
        setToolbarPos({
          top: Math.max(10, rect.bottom + 8),
          left: Math.max(10, Math.min(window.innerWidth - 270, rect.left + rect.width / 2 - 120))
        });
        return;
      }
    }

    setActiveSpellPopover(null);

    // 1. Image Clicked
    if (target.tagName === 'IMG' || target.closest('img')) {
      const img = target.tagName === 'IMG' ? target : (target.closest('img') as HTMLElement);
      if (img) {
        img.classList.add('active-object-selected');
        setSelectedElement(img);
        setSelectedObjectType('image');
        setSelectedText('');

        const rect = img.getBoundingClientRect();
        setToolbarPos({
          top: Math.max(10, rect.top - 50),
          left: Math.max(10, rect.left + rect.width / 2 - 130)
        });
        return;
      }
    }

    // 2. Table or Table Cell Clicked
    if (target.closest('table')) {
      const table = target.closest('table') as HTMLElement;
      table.classList.add('active-object-selected');
      setSelectedElement(target.closest('td, th') || table);
      setSelectedObjectType('table');
      setSelectedText('');

      const rect = table.getBoundingClientRect();
      setToolbarPos({
        top: Math.max(10, rect.top - 50),
        left: Math.max(10, rect.left + rect.width / 2 - 160)
      });
      return;
    }

    // 3. Callout / Highlight Box Clicked
    const callout = target.closest('.callout-box') || (target.tagName === 'BLOCKQUOTE' ? target : null);
    if (callout) {
      const calloutEl = callout as HTMLElement;
      calloutEl.classList.add('active-object-selected');
      setSelectedElement(calloutEl);
      setSelectedObjectType('callout');
      setSelectedText('');

      const rect = calloutEl.getBoundingClientRect();
      setToolbarPos({
        top: Math.max(10, rect.top - 50),
        left: Math.max(10, rect.left + rect.width / 2 - 120)
      });
      return;
    }

    // 4. Text Selection
    if (text.length > 0 && selection && !selection.isCollapsed) {
      setSelectedText(text);
      setSelectedObjectType('text');
      setSelectedElement(null);

      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setToolbarPos({
          top: Math.max(10, rect.top - 50),
          left: Math.max(10, rect.left + rect.width / 2 - 120)
        });
      } catch (err) {
        setToolbarPos(null);
      }
      return;
    }

    // 5. Default Text / Heading Clicked
    const block = target.closest('h1, h2, h3, p, li') as HTMLElement;
    if (block && editor.contains(block)) {
      block.classList.add('active-object-selected');
      setSelectedElement(block);
      setSelectedObjectType('text');
      setSelectedText('');

      const rect = block.getBoundingClientRect();
      setToolbarPos({
        top: Math.max(10, rect.top - 46),
        left: Math.max(10, rect.left + 20)
      });
      return;
    }

    // Reset if clicking empty space
    setSelectedObjectType(null);
    setSelectedElement(null);
    setSelectedText('');
    setToolbarPos(null);
    setActiveSpellPopover(null);
  };

  // --- Spell Error Actions ---
  const handleApplySpellCorrection = (typo: string, correction: string, el?: HTMLElement) => {
    if (el) {
      const editor = el.closest('[contenteditable="true"]') as HTMLElement;
      if (el.classList.contains('spell-error')) {
        el.replaceWith(window.document.createTextNode(correction));
      } else {
        el.innerHTML = replaceTypoInHtml(el.innerHTML, typo, correction);
      }
      if (editor) {
        const pageIdxAttr = editor.getAttribute('data-page-index');
        if (pageIdxAttr !== null) {
          handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
        } else {
          handleSingleInput();
        }
      }
    } else {
      const newHtml = replaceTypoInHtml(document.contentHtml, typo, correction);
      onContentChange(newHtml);
    }
    
    if (onReplaceSpellError && activeSpellPopover) {
      onReplaceSpellError(
        {
          id: activeSpellPopover.errorId || `err_${Date.now()}`,
          word: typo,
          originalText: typo,
          index: 0,
          suggestions: [correction],
          reason: activeSpellPopover.reason,
          type: 'typo'
        },
        correction,
        false
      );
    }

    setSelectedObjectType(null);
    setActiveSpellPopover(null);
    setToolbarPos(null);
  };

  const handleIgnoreTypo = (word: string, el?: HTMLElement) => {
    if (el && el.classList.contains('spell-error')) {
      const editor = el.closest('[contenteditable="true"]') as HTMLElement;
      el.replaceWith(window.document.createTextNode(el.innerText));
      if (editor) {
        const pageIdxAttr = editor.getAttribute('data-page-index');
        if (pageIdxAttr !== null) {
          handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
        } else {
          handleSingleInput();
        }
      }
    }
    onIgnoreSpellError?.(word);
    setSelectedObjectType(null);
    setActiveSpellPopover(null);
    setToolbarPos(null);
  };

  const handleAddWordToCustomDict = (word: string, el?: HTMLElement) => {
    if (el && el.classList.contains('spell-error')) {
      const editor = el.closest('[contenteditable="true"]') as HTMLElement;
      el.replaceWith(window.document.createTextNode(el.innerText));
      if (editor) {
        const pageIdxAttr = editor.getAttribute('data-page-index');
        if (pageIdxAttr !== null) {
          handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
        } else {
          handleSingleInput();
        }
      }
    }
    onAddToDictionary?.(word);
    setSelectedObjectType(null);
    setActiveSpellPopover(null);
    setToolbarPos(null);
  };

  // --- Table Actions ---
  const handleAddRow = () => {
    if (!selectedElement) return;
    const td = selectedElement.closest('td, th');
    if (!td) return;
    const tr = td.closest('tr');
    if (!tr || !tr.parentNode) return;

    const colCount = tr.children.length;
    const newTr = window.document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const newTd = window.document.createElement('td');
      newTd.style.border = '1px solid #cbd5e1';
      newTd.style.padding = '8px 12px';
      newTd.innerHTML = '<br/>';
      newTr.appendChild(newTd);
    }
    tr.parentNode.insertBefore(newTr, tr.nextSibling);
    
    const editor = selectedElement.closest('[contenteditable="true"]') as HTMLElement;
    if (editor) {
      const pageIdxAttr = editor.getAttribute('data-page-index');
      if (pageIdxAttr !== null) handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
      else handleSingleInput();
    }
  };

  const handleAddColumn = () => {
    if (!selectedElement) return;
    const table = selectedElement.closest('table');
    const td = selectedElement.closest('td, th') as HTMLTableCellElement;
    if (!table || !td) return;

    const colIndex = td.cellIndex;
    const rows = table.querySelectorAll('tr');
    rows.forEach((r) => {
      const isHeaderRow = r.querySelector('th') !== null;
      const newCell = window.document.createElement(isHeaderRow ? 'th' : 'td');
      newCell.style.border = '1px solid #cbd5e1';
      newCell.style.padding = '8px 12px';
      newCell.innerHTML = '<br/>';
      if (r.children[colIndex + 1]) {
        r.insertBefore(newCell, r.children[colIndex + 1]);
      } else {
        r.appendChild(newCell);
      }
    });

    const editor = selectedElement.closest('[contenteditable="true"]') as HTMLElement;
    if (editor) {
      const pageIdxAttr = editor.getAttribute('data-page-index');
      if (pageIdxAttr !== null) handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
      else handleSingleInput();
    }
  };

  const handleDeleteTable = () => {
    if (!selectedElement) return;
    const table = selectedElement.closest('table');
    if (table) {
      const editor = table.closest('[contenteditable="true"]') as HTMLElement;
      table.remove();
      setSelectedObjectType(null);
      setSelectedElement(null);
      if (editor) {
        const pageIdxAttr = editor.getAttribute('data-page-index');
        if (pageIdxAttr !== null) handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
        else handleSingleInput();
      }
    }
  };

  // --- Image Actions ---
  const handleSetImageWidth = (widthPercent: string) => {
    if (!selectedElement) return;
    const img = selectedElement.tagName === 'IMG' ? selectedElement : selectedElement.querySelector('img');
    if (img) {
      img.style.width = widthPercent;
      img.style.maxWidth = widthPercent;
      const editor = img.closest('[contenteditable="true"]') as HTMLElement;
      if (editor) {
        const pageIdxAttr = editor.getAttribute('data-page-index');
        if (pageIdxAttr !== null) handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
        else handleSingleInput();
      }
    }
  };

  const handleSetAlign = (align: 'right' | 'center' | 'left') => {
    if (!selectedElement) return;
    const container = selectedElement.closest('div, p, table') || selectedElement;
    container.style.textAlign = align;
    const editor = container.closest('[contenteditable="true"]') as HTMLElement;
    if (editor) {
      const pageIdxAttr = editor.getAttribute('data-page-index');
      if (pageIdxAttr !== null) handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
      else handleSingleInput();
    }
  };

  const handleDeleteElement = () => {
    if (selectedElement) {
      const editor = selectedElement.closest('[contenteditable="true"]') as HTMLElement;
      selectedElement.remove();
      setSelectedObjectType(null);
      setSelectedElement(null);
      if (editor) {
        const pageIdxAttr = editor.getAttribute('data-page-index');
        if (pageIdxAttr !== null) handlePageInput(parseInt(pageIdxAttr, 10), editor.innerHTML);
        else handleSingleInput();
      }
    }
  };

  // --- Page Operations ---
  const handleInsertPageAfter = (pageIndex: number) => {
    const updatedPages = [...pages.slice(0, pageIndex + 1), '<p><br/></p>', ...pages.slice(pageIndex + 1)];
    const fullHtml = joinPagesIntoHtml(updatedPages, document);
    onContentChange(fullHtml);
  };

  const handleMergeWithNextPage = (pageIndex: number) => {
    if (pageIndex >= pages.length - 1) return;
    const updatedPages = [...pages];
    updatedPages[pageIndex] = updatedPages[pageIndex] + '<p><br/></p>' + (updatedPages[pageIndex + 1] || '');
    updatedPages.splice(pageIndex + 1, 1);
    const fullHtml = joinPagesIntoHtml(updatedPages, document);
    onContentChange(fullHtml);
  };

  const formatPageNumberBadgeText = (pageNum: number, total: number, format: string = 'standard') => {
    switch (format) {
      case 'simple':
        return `${pageNum}`;
      case 'page_x':
        return `עמוד ${pageNum}`;
      case 'hebrew': {
        const gematria = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט', 'כ'];
        const letter = gematria[Math.min(pageNum - 1, gematria.length - 1)] || `${pageNum}`;
        return `עמוד ${letter}'`;
      }
      case 'standard':
      default:
        return `עמוד ${pageNum} מתוך ${total}`;
    }
  };

  const renderPageNumberBadge = (doc: DocumentModel, pageNum: number, total: number) => {
    if (!doc.showPageNumbers) return null;

    const text = formatPageNumberBadgeText(pageNum, total, doc.pageNumberFormat);

    return (
      <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono text-slate-700 text-[10px] font-bold shadow-2xs">
        {text}
      </span>
    );
  };

  // Base canvas scale & font style
  const paperSheetStyle: React.CSSProperties = {
    fontFamily: document.fontFamily,
    fontSize: document.fontSize,
    lineHeight: document.lineSpacing,
    direction: document.dir,
    textAlign: document.dir === 'rtl' ? 'right' : 'left',
    backgroundColor: document.pageBgColor || '#ffffff',
    transform: `scale(${document.zoom / 100})`,
    transformOrigin: 'top center'
  };

  return (
    <div 
      className="flex-1 overflow-auto bg-[#e5e7eb] p-4 md:p-8 flex flex-col items-center relative min-h-screen select-text"
      onMouseUp={handleEditorInteraction}
      onKeyUp={handleEditorInteraction}
    >
      {/* FLOATING OBJECT CONTEXTUAL TOOLBAR (REACTIVITY ON CLICKING ANY OBJECT) */}
      {selectedObjectType && toolbarPos && (
        <div
          style={{
            position: 'fixed',
            top: `${toolbarPos.top}px`,
            left: `${toolbarPos.left}px`,
            zIndex: 100
          }}
          className="bg-slate-900 text-white rounded-xl shadow-2xl px-3 py-1.5 flex items-center gap-1.5 text-xs border border-slate-700 animate-in fade-in zoom-in duration-150 select-none"
        >
          {/* 1. TABLE TOOLBAR */}
          {selectedObjectType === 'table' && (
            <>
              <span className="text-[10px] text-blue-400 font-bold border-l border-slate-700 pl-2 ml-1 flex items-center gap-1">
                <TableIcon className="w-3.5 h-3.5" />
                טבלה
              </span>
              <button
                onClick={handleAddRow}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                title="הוסף שורה חדשה לטבלה"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>שורה</span>
              </button>
              <button
                onClick={handleAddColumn}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                title="הוסף עמודה חדשה לטבלה"
              >
                <Plus className="w-3 h-3 text-blue-400" />
                <span>עמודה</span>
              </button>
              <button
                onClick={handleDeleteTable}
                className="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-200 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                title="מחק טבלה זו"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>מחק טבלה</span>
              </button>
            </>
          )}

          {/* 2. IMAGE TOOLBAR */}
          {selectedObjectType === 'image' && (
            <>
              <span className="text-[10px] text-emerald-400 font-bold border-l border-slate-700 pl-2 ml-1 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" />
                תמונה
              </span>
              <span className="text-[10px] text-slate-400">גודל:</span>
              <button
                onClick={() => handleSetImageWidth('25%')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
              >
                25%
              </button>
              <button
                onClick={() => handleSetImageWidth('50%')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
              >
                50%
              </button>
              <button
                onClick={() => handleSetImageWidth('100%')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px]"
              >
                100%
              </button>
              <div className="h-3 w-[1px] bg-slate-700 mx-1" />
              <button
                onClick={() => handleSetAlign('right')}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="יישור לימין"
              >
                <AlignRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleSetAlign('center')}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="מרכוז"
              >
                <AlignCenter className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleSetAlign('left')}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="יישור לשמאל"
              >
                <AlignLeft className="w-3 h-3" />
              </button>
              <div className="h-3 w-[1px] bg-slate-700 mx-1" />
              <button
                onClick={handleDeleteElement}
                className="p-1 hover:bg-rose-900/50 rounded text-rose-300"
                title="מחק תמונה"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}

          {/* 3. CALLOUT / HIGHLIGHT BOX TOOLBAR */}
          {selectedObjectType === 'callout' && (
            <>
              <span className="text-[10px] text-amber-400 font-bold border-l border-slate-700 pl-2 ml-1 flex items-center gap-1">
                <Paintbrush className="w-3.5 h-3.5" />
                תיבת הדגשה
              </span>
              <button
                onClick={() => applyStyleToSelectionOrNode('backgroundColor', '#eff6ff', selectedElement)}
                className="w-4 h-4 rounded-full bg-blue-100 border border-blue-400"
                title="כחול בהיר"
              />
              <button
                onClick={() => applyStyleToSelectionOrNode('backgroundColor', '#f0fdf4', selectedElement)}
                className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-400"
                title="ירוק בהיר"
              />
              <button
                onClick={() => applyStyleToSelectionOrNode('backgroundColor', '#fefce8', selectedElement)}
                className="w-4 h-4 rounded-full bg-amber-100 border border-amber-400"
                title="צהוב בהיר"
              />
              <button
                onClick={() => applyStyleToSelectionOrNode('backgroundColor', '#fff1f2', selectedElement)}
                className="w-4 h-4 rounded-full bg-rose-100 border border-rose-400"
                title="ורוד בהיר"
              />
              <div className="h-3 w-[1px] bg-slate-700 mx-1" />
              <button
                onClick={handleDeleteElement}
                className="p-1 hover:bg-rose-900/50 rounded text-rose-300"
                title="מחק תיבה"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}

          {/* 4. TEXT / HEADING SELECTION TOOLBAR */}
          {selectedObjectType === 'text' && (
            <>
              <button
                onClick={() => {
                  formatDoc('bold');
                  saveSelection();
                }}
                className="p-1.5 hover:bg-slate-800 rounded font-bold transition-colors"
                title="מודגש (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  formatDoc('italic');
                  saveSelection();
                }}
                className="p-1.5 hover:bg-slate-800 rounded italic transition-colors"
                title="נטוי (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <div className="h-3 w-[1px] bg-slate-700 mx-0.5" />
              <button
                onClick={() => {
                  formatDoc('formatBlock', '<h1>');
                  saveSelection();
                }}
                className="p-1 hover:bg-slate-800 rounded text-[11px] font-bold text-blue-400"
                title="כותרת ראשית H1"
              >
                H1
              </button>
              <button
                onClick={() => {
                  formatDoc('formatBlock', '<h2>');
                  saveSelection();
                }}
                className="p-1 hover:bg-slate-800 rounded text-[11px] font-bold text-sky-400"
                title="כותרת משנית H2"
              >
                H2
              </button>
              <button
                onClick={() => {
                  formatDoc('formatBlock', '<p>');
                  saveSelection();
                }}
                className="p-1 hover:bg-slate-800 rounded text-[11px] font-medium text-slate-300"
                title="פסקה רגילה"
              >
                P
              </button>
              <div className="h-3 w-[1px] bg-slate-700 mx-0.5" />
              <button
                onClick={() => {
                  applyStyleToSelectionOrNode('backgroundColor', '#fef08a', selectedElement);
                  saveSelection();
                }}
                className="p-1.5 hover:bg-slate-800 rounded text-amber-300"
                title="מרקר צהוב"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  applyStyleToSelectionOrNode('color', '#2563eb', selectedElement);
                  saveSelection();
                }}
                className="p-1.5 hover:bg-slate-800 rounded text-blue-400"
                title="צבע כחול"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
              {selectedText && (
                <>
                  <div className="h-3 w-[1px] bg-slate-700 mx-0.5" />
                  <button
                    onClick={() => {
                      onAddCommentFromSelection(selectedText);
                      setSelectedObjectType(null);
                      setToolbarPos(null);
                    }}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                  >
                    <MessageSquarePlus className="w-3 h-3" />
                    <span>הוסף הערה</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* 5. SPELL ERROR POPOVER */}
          {selectedObjectType === 'spell_error' && activeSpellPopover && (
            <div className="p-2.5 max-w-xs text-right bg-white text-slate-800 rounded-lg shadow-2xl border border-red-200">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 mb-2">
                <div className="flex items-center gap-1 text-red-600 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>שגיאת איות או ניסוח</span>
                </div>
                <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                  {activeSpellPopover.word}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2 leading-tight">
                {activeSpellPopover.reason}
              </p>
              
              {activeSpellPopover.suggestions && activeSpellPopover.suggestions.length > 0 ? (
                <div className="mb-2">
                  <span className="text-[10px] text-slate-400 font-medium block mb-1">הצעות לתיקון:</span>
                  <div className="flex flex-wrap gap-1">
                    {activeSpellPopover.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleApplySpellCorrection(activeSpellPopover.word, sug, activeSpellPopover.element)}
                        className="px-2 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded font-medium text-xs border border-blue-200 transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-amber-600 mb-2">אין הצעה ישירה למילה זו.</p>
              )}

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                <button
                  onClick={() => handleIgnoreTypo(activeSpellPopover.word, activeSpellPopover.element)}
                  className="text-slate-500 hover:text-slate-800 hover:underline font-medium transition-colors"
                  title="התעלם משגיאה זו במסמך"
                >
                  התעלם
                </button>
                <button
                  onClick={() => handleAddWordToCustomDict(activeSpellPopover.word, activeSpellPopover.element)}
                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline transition-colors"
                  title="הוסף מילה זו למילון המקומי שלך"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>הוסף למילון</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PAGED A4 MULTI-PAGE VIEW (EVERY PAGE IS GUARANTEED FULL 210mm x 297mm) */}
      {/* ========================================================================= */}
      {isPaged ? (
        <div className="flex flex-col items-center w-full">
          {pages.map((pageHtml, pageIndex) => {
            const pageNum = pageIndex + 1;
            return (
              <React.Fragment key={`page_${pageIndex}`}>
                {/* A4 Paper Sheet (Exact 210mm x 297mm portrait) */}
                <div 
                  className="w-[210mm] min-w-[210mm] max-w-[210mm] min-h-[297mm] my-5 bg-white shadow-2xl border border-gray-300 rounded-xs flex flex-col relative transition-all box-border shrink-0"
                  style={paperSheetStyle}
                >
                  {/* Watermark Overlay */}
                  {document.watermarkText && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-10 select-none z-0">
                      <span className="text-8xl font-black text-gray-800 transform -rotate-45 tracking-widest uppercase">
                        {document.watermarkText}
                      </span>
                    </div>
                  )}

                  {/* Header Region */}
                  <div className="px-6 h-10 border-b border-gray-100 text-[11px] text-gray-400 flex items-center justify-between font-sans select-none shrink-0 bg-white/90">
                    <div className="flex items-center gap-2">
                      <span>{document.headerText || 'כותרת עליונה'}</span>
                      {document.showPageNumbers && document.pageNumberPosition === 'header_left' && (
                        renderPageNumberBadge(document, pageNum, totalPages)
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {document.showPageNumbers && document.pageNumberPosition === 'header_right' && (
                        renderPageNumberBadge(document, pageNum, totalPages)
                      )}
                      <span>{document.title}</span>
                    </div>
                  </div>

                  {/* Editable Core Text Body for This Page */}
                  <div
                    ref={(el) => {
                      pageRefs.current[pageIndex] = el;
                    }}
                    data-page-index={pageIndex}
                    contentEditable={document.docMode !== 'viewing'}
                    onInput={(e) => handlePageInput(pageIndex, e.currentTarget.innerHTML)}
                    onClick={handleEditorInteraction}
                    onKeyUp={handleEditorInteraction}
                    onKeyDown={(e) => {
                      // Ctrl+Enter or Cmd+Enter creates a new page
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleInsertPageAfter(pageIndex);
                      }
                    }}
                    suppressContentEditableWarning
                    style={{
                      paddingTop: `${document.margins?.top ?? 25}mm`,
                      paddingBottom: `${document.margins?.bottom ?? 25}mm`,
                      paddingLeft: `${document.margins?.left ?? 25}mm`,
                      paddingRight: `${document.margins?.right ?? 25}mm`,
                      minHeight: 'calc(297mm - 80px)'
                    }}
                    className="focus:outline-hidden flex-1 text-gray-800 leading-relaxed relative z-10 prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-h1:text-2xl prose-h2:text-lg prose-h2:text-blue-800 prose-h3:text-base [&_.active-object-selected]:ring-2 [&_.active-object-selected]:ring-blue-500 [&_.active-object-selected]:ring-offset-2 [&_.active-object-selected]:rounded-xs"
                  />

                  {/* Footer Region */}
                  <div className="px-6 h-10 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between font-sans select-none shrink-0 mt-auto bg-white/90">
                    <span>{document.footerText || 'כותרת תחתונה'}</span>
                    {document.showPageNumbers && (!document.pageNumberPosition || document.pageNumberPosition.startsWith('footer')) && (
                      <div className={`flex items-center ${
                        document.pageNumberPosition === 'footer_center' ? 'mx-auto' : 
                        document.pageNumberPosition === 'footer_right' ? 'mr-auto' : ''
                      }`}>
                        {renderPageNumberBadge(document, pageNum, totalPages)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Page Break Gap & Multi-Page Actions between pages */}
                {pageIndex < pages.length - 1 && (
                  <div className="flex items-center gap-3 my-2 select-none">
                    <div className="h-[1px] w-24 bg-gray-300" />
                    <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-300 shadow-xs text-xs text-gray-600">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-semibold">מעבר עמוד (A4)</span>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={() => handleMergeWithNextPage(pageIndex)}
                        className="text-[11px] text-red-600 hover:text-red-800 hover:underline font-medium"
                        title="מחק מעבר עמוד וחבר עמודים"
                      >
                        הסר מעבר
                      </button>
                    </div>
                    <div className="h-[1px] w-24 bg-gray-300" />
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Quick Add Page Button at the Bottom */}
          <div className="my-6 flex justify-center select-none">
            <button
              onClick={() => {
                if (onAddPage) onAddPage();
                else handleInsertPageAfter(pages.length - 1);
              }}
              className="bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 px-5 py-2 rounded-full border border-blue-300 shadow-sm font-semibold text-xs flex items-center gap-2 transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              <span>הוסף עמוד חדש (A4)</span>
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. PAGELESS CONTINUOUS DOCS VIEW                                          */
        /* ========================================================================= */
        <div 
          className="w-full max-w-4xl min-h-[800px] my-4 bg-white shadow-md rounded-lg p-8 border border-gray-200"
          style={paperSheetStyle}
        >
          {/* Watermark Overlay */}
          {document.watermarkText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-10 select-none z-0">
              <span className="text-8xl font-black text-gray-800 transform -rotate-45 tracking-widest uppercase">
                {document.watermarkText}
              </span>
            </div>
          )}

          <div
            ref={singleEditorRef}
            contentEditable={document.docMode !== 'viewing'}
            onInput={handleSingleInput}
            onClick={handleEditorInteraction}
            onKeyUp={handleEditorInteraction}
            suppressContentEditableWarning
            className="focus:outline-hidden text-gray-800 leading-relaxed relative z-10 prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-h1:text-2xl prose-h2:text-lg prose-h2:text-blue-800 prose-h3:text-base p-6"
          />
        </div>
      )}
    </div>
  );
};
