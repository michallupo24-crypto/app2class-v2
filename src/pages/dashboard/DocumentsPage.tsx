import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { UserProfile } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DocumentModel, RibbonTab, Template, Comment } from './documents/types';
import { TEMPLATES } from './documents/data/templates';
import { HeaderNav } from './documents/components/HeaderNav';
import { RibbonToolbar } from './documents/components/RibbonToolbar';
import { Ruler } from './documents/components/Ruler';
import { DocumentCanvas } from './documents/components/DocumentCanvas';
import { DocumentOutline } from './documents/components/DocumentOutline';
import { CommentsAndSuggestionsPanel } from './documents/components/CommentsAndSuggestionsPanel';
import { SpellCheckPanel } from './documents/components/SpellCheckPanel';
import { StatusBar } from './documents/components/StatusBar';
import { ShareModal } from './documents/components/ShareModal';
import { ExportModal } from './documents/components/ExportModal';
import { VersionHistoryModal } from './documents/components/VersionHistoryModal';
import { DocumentDashboard } from './documents/components/DocumentDashboard';
import { ImageModal } from './documents/components/ImageModal';
import { formatDoc, insertHtmlAtCursorOrAppend, insertPageBreak } from './documents/utils/editorUtils';
import {
  findSpellingErrors,
  markSpellErrorsInHtml,
  cleanSpellMarksFromHtml,
  replaceTypoInHtml,
  SpellingError,
} from './documents/utils/spellCheck';
import { checkGrammar, GrammarIssue } from './documents/utils/grammarCheck';
import './documents/docword.css';

// --- Supabase <-> DocumentModel mapping -------------------------------------
type DocumentRow = {
  id: string;
  owner_id: string;
  title: string;
  content_html: string;
  language: string;
  dir: string;
  view_mode: string;
  doc_mode: string;
  comments: unknown;
  suggestions: unknown;
  history: unknown;
  header_text: string;
  footer_text: string;
  show_page_numbers: boolean;
  page_number_position: string | null;
  page_number_format: string | null;
  page_bg_color: string;
  watermark_text: string;
  font_family: string;
  font_size: string;
  line_spacing: string;
  margins: unknown;
  zoom: number;
  tags: string[];
  is_favorite: boolean;
  custom_dictionary: string[];
  ignored_words: string[];
  created_at: string;
  updated_at: string;
};

const rowToDoc = (row: DocumentRow): DocumentModel => ({
  id: row.id,
  title: row.title,
  contentHtml: row.content_html,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  language: row.language as 'he' | 'en',
  dir: row.dir as 'rtl' | 'ltr',
  viewMode: row.view_mode as DocumentModel['viewMode'],
  docMode: row.doc_mode as DocumentModel['docMode'],
  comments: (row.comments as Comment[]) || [],
  suggestions: (row.suggestions as DocumentModel['suggestions']) || [],
  history: (row.history as DocumentModel['history']) || [],
  headerText: row.header_text,
  footerText: row.footer_text,
  showPageNumbers: row.show_page_numbers,
  pageNumberPosition: (row.page_number_position as DocumentModel['pageNumberPosition']) || undefined,
  pageNumberFormat: (row.page_number_format as DocumentModel['pageNumberFormat']) || undefined,
  pageBgColor: row.page_bg_color,
  watermarkText: row.watermark_text,
  fontFamily: row.font_family,
  fontSize: row.font_size,
  lineSpacing: row.line_spacing,
  margins: row.margins as DocumentModel['margins'],
  zoom: row.zoom,
  tags: row.tags || [],
  isFavorite: row.is_favorite,
  customDictionary: row.custom_dictionary || [],
  ignoredWords: row.ignored_words || [],
});

const docToRow = (doc: DocumentModel, ownerId: string) => ({
  id: doc.id,
  owner_id: ownerId,
  title: doc.title,
  content_html: doc.contentHtml,
  language: doc.language,
  dir: doc.dir,
  view_mode: doc.viewMode,
  doc_mode: doc.docMode,
  comments: doc.comments,
  suggestions: doc.suggestions,
  history: doc.history,
  header_text: doc.headerText,
  footer_text: doc.footerText,
  show_page_numbers: doc.showPageNumbers,
  page_number_position: doc.pageNumberPosition || null,
  page_number_format: doc.pageNumberFormat || null,
  page_bg_color: doc.pageBgColor,
  watermark_text: doc.watermarkText,
  font_family: doc.fontFamily,
  font_size: doc.fontSize,
  line_spacing: doc.lineSpacing,
  margins: doc.margins,
  zoom: doc.zoom,
  tags: doc.tags,
  is_favorite: doc.isFavorite,
  custom_dictionary: doc.customDictionary || [],
  ignored_words: doc.ignoredWords || [],
});

const DocumentsPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();

  const [documents, setDocuments] = useState<DocumentModel[]>([]);
  const [permissionMap, setPermissionMap] = useState<Record<string, 'owner' | 'editor' | 'commenter' | 'viewer'>>({});
  const [loading, setLoading] = useState(true);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('home');
  const [showOutline, setShowOutline] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [showSpellCheck, setShowSpellCheck] = useState<boolean>(false);
  const [isSpellMarksActive, setIsSpellMarksActive] = useState<boolean>(true);
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [activeSpellError, setActiveSpellError] = useState<SpellingError | null>(null);
  const [ignoredWords, setIgnoredWords] = useState<string[]>([]);
  const [customDictionary, setCustomDictionary] = useState<string[]>([]);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);

  // Load this user's own documents plus documents shared with them (see
  // `document_shares` + the updated RLS policies from 20260823110000).
  useEffect(() => {
    if (!profile?.id) return;
    Promise.all([
      supabase.from('documents').select('*').eq('owner_id', profile.id).order('updated_at', { ascending: false }),
      (supabase as any)
        .from('document_shares')
        .select('permission, document:documents(*)')
        .eq('shared_with_user_id', profile.id),
    ]).then(([ownedRes, sharedRes]) => {
      if (ownedRes.error) console.error('Failed to load documents:', ownedRes.error);
      if (sharedRes.error) console.error('Failed to load shared documents:', sharedRes.error);

      const ownedDocs = ((ownedRes.data as unknown as DocumentRow[]) || []).map(rowToDoc);
      const sharedRows = (sharedRes.data as { permission: string; document: DocumentRow | null }[]) || [];
      const sharedDocs = sharedRows.filter((r) => r.document).map((r) => rowToDoc(r.document as DocumentRow));

      const perms: Record<string, 'owner' | 'editor' | 'commenter' | 'viewer'> = {};
      ownedDocs.forEach((d) => { perms[d.id] = 'owner'; });
      sharedRows.forEach((r) => { if (r.document) perms[r.document.id] = r.permission as any; });

      setPermissionMap(perms);
      setDocuments([...ownedDocs, ...sharedDocs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setLoading(false);
    });
  }, [profile?.id]);

  const activeDoc = documents.find((d) => d.id === currentDocId) || null;
  const myPermission = currentDocId ? permissionMap[currentDocId] || 'owner' : 'owner';
  const canEdit = myPermission === 'owner' || myPermission === 'editor';
  const canComment = canEdit || myPermission === 'commenter';
  const sharedDocIds = new Set(Object.entries(permissionMap).filter(([, p]) => p !== 'owner').map(([id]) => id));
  // Non-editors never see contentEditable="true", regardless of the
  // document's own stored docMode (which is shared/persisted, not per-viewer).
  const effectiveDoc = activeDoc && !canEdit ? { ...activeDoc, docMode: 'viewing' as const } : activeDoc;

  // Debounced autosave: pushes the active document to Supabase ~1s after
  // the last local edit, instead of writing on every keystroke. Viewers
  // never have write access (RLS blocks it), so don't even attempt it.
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!activeDoc || !profile?.id || myPermission === 'viewer') return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from('documents')
        .update(docToRow(activeDoc, profile.id) as any)
        .eq('id', activeDoc.id);
      if (error) console.error('Failed to save document:', error);
    }, 1000);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc, profile?.id, myPermission]);

  const currentSpellErrors: SpellingError[] = activeDoc
    ? findSpellingErrors(
        activeDoc.contentHtml,
        new Set([...customDictionary, ...(activeDoc.customDictionary || [])])
      ).filter(
        (err) =>
          !ignoredWords.includes(err.word) &&
          !ignoredWords.includes(err.word.toLowerCase()) &&
          !(activeDoc.ignoredWords || []).includes(err.word)
      )
    : [];

  const currentGrammarIssues: GrammarIssue[] = activeDoc ? checkGrammar(activeDoc.contentHtml) : [];

  const updateActiveDocument = (updates: Partial<DocumentModel>) => {
    if (!currentDocId) return;
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === currentDocId ? { ...doc, ...updates, updatedAt: new Date().toISOString() } : doc
      )
    );
  };

  const handleToggleSpellCheck = () => {
    const nextState = !showSpellCheck;
    setShowSpellCheck(nextState);
    if (nextState && activeDoc) {
      const marked = markSpellErrorsInHtml(
        activeDoc.contentHtml,
        new Set([...customDictionary, ...(activeDoc.customDictionary || [])]),
        new Set([...ignoredWords, ...(activeDoc.ignoredWords || [])])
      );
      updateActiveDocument({ contentHtml: marked.htmlWithMarks });
      setIsSpellMarksActive(true);
    }
  };

  const handleToggleSpellMarks = () => {
    if (!activeDoc) return;
    if (isSpellMarksActive) {
      updateActiveDocument({ contentHtml: cleanSpellMarksFromHtml(activeDoc.contentHtml) });
      setIsSpellMarksActive(false);
    } else {
      const marked = markSpellErrorsInHtml(
        activeDoc.contentHtml,
        new Set([...customDictionary, ...(activeDoc.customDictionary || [])]),
        new Set([...ignoredWords, ...(activeDoc.ignoredWords || [])])
      );
      updateActiveDocument({ contentHtml: marked.htmlWithMarks });
      setIsSpellMarksActive(true);
    }
  };

  const handleReplaceSpellError = (error: SpellingError, correction: string) => {
    if (!activeDoc) return;
    let newHtml = replaceTypoInHtml(activeDoc.contentHtml, error.word, correction);
    if (isSpellMarksActive) {
      newHtml = markSpellErrorsInHtml(
        newHtml,
        new Set([...customDictionary, ...(activeDoc.customDictionary || [])]),
        new Set([...ignoredWords, ...(activeDoc.ignoredWords || [])])
      ).htmlWithMarks;
    }
    updateActiveDocument({ contentHtml: newHtml });
    setActiveSpellError(null);
  };

  const handleReplaceGrammar = (issue: GrammarIssue, correction: string) => {
    if (!activeDoc) return;
    let newHtml = replaceTypoInHtml(activeDoc.contentHtml, issue.matchedText, correction);
    if (isSpellMarksActive) {
      newHtml = markSpellErrorsInHtml(
        newHtml,
        new Set([...customDictionary, ...(activeDoc.customDictionary || [])]),
        new Set([...ignoredWords, ...(activeDoc.ignoredWords || [])])
      ).htmlWithMarks;
    }
    updateActiveDocument({ contentHtml: newHtml });
  };

  const handleAddToDictionary = (word: string) => {
    if (!word) return;
    const cleanWord = word.trim();
    if (!customDictionary.includes(cleanWord)) {
      setCustomDictionary((prev) => [...prev, cleanWord]);
      if (activeDoc) {
        updateActiveDocument({ customDictionary: [...(activeDoc.customDictionary || []), cleanWord] });
      }
    }
  };

  const handleRemoveFromDictionary = (word: string) => {
    setCustomDictionary((prev) => prev.filter((w) => w !== word));
    if (activeDoc?.customDictionary) {
      updateActiveDocument({ customDictionary: activeDoc.customDictionary.filter((w) => w !== word) });
    }
  };

  const handleIgnoreSpellError = (errorIdOrWord: string) => {
    setIgnoredWords((prev) => [...prev, errorIdOrWord]);
    if (activeDoc) {
      updateActiveDocument({ ignoredWords: [...(activeDoc.ignoredWords || []), errorIdOrWord] });
    }
    if (activeSpellError && (activeSpellError.id === errorIdOrWord || activeSpellError.word === errorIdOrWord)) {
      setActiveSpellError(null);
    }
  };

  const handleCreateNewFromTemplate = async (template: Template) => {
    if (!profile?.id) return;
    const now = new Date().toISOString();
    const newDoc: DocumentModel = {
      id: crypto.randomUUID(),
      title: template.id === 'blank' ? 'מסמך ללא שם' : template.nameHe,
      contentHtml: template.contentHtml,
      createdAt: now,
      updatedAt: now,
      language: 'he',
      dir: template.dir,
      viewMode: 'paged',
      docMode: 'editing',
      comments: [],
      suggestions: [],
      history: [
        {
          id: `ver_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          title: 'נוצר מתבנית',
          author: profile.fullName,
          contentHtml: template.contentHtml,
          changeSummary: 'יצירת מסמך ראשונית',
        },
      ],
      headerText: template.nameHe,
      footerText: '',
      showPageNumbers: true,
      pageBgColor: '#ffffff',
      watermarkText: '',
      fontFamily: template.fontFamily || 'Rubik',
      fontSize: '16px',
      lineSpacing: '1.5',
      margins: { top: 25, bottom: 25, left: 25, right: 25 },
      zoom: 100,
      tags: [template.category],
      isFavorite: false,
    };

    setDocuments((prev) => [newDoc, ...prev]);
    setPermissionMap((prev) => ({ ...prev, [newDoc.id]: 'owner' }));
    setCurrentDocId(newDoc.id);

    const { error } = await supabase.from('documents').insert(docToRow(newDoc, profile.id) as any);
    if (error) {
      console.error('Failed to create document:', error);
      setDocuments((prev) => prev.filter((d) => d.id !== newDoc.id));
      setCurrentDocId(null);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (permissionMap[id] !== 'owner') return;
    if (!confirm('האם אתה בטוח שברצונך למחוק מסמך זה?')) return;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (currentDocId === id) setCurrentDocId(null);
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) console.error('Failed to delete document:', error);
  };

  const handleDuplicateDocument = async (doc: DocumentModel) => {
    if (!profile?.id) return;
    const dup: DocumentModel = {
      ...doc,
      id: crypto.randomUUID(),
      title: `${doc.title} (עותק)`,
      updatedAt: new Date().toISOString(),
    };
    setDocuments((prev) => [dup, ...prev]);
    setPermissionMap((prev) => ({ ...prev, [dup.id]: 'owner' }));
    const { error } = await supabase.from('documents').insert(docToRow(dup, profile.id) as any);
    if (error) {
      console.error('Failed to duplicate document:', error);
      setDocuments((prev) => prev.filter((d) => d.id !== dup.id));
    }
  };

  const handleInsertTable = (rows: number, cols: number) => {
    let tableHtml =
      '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #cbd5e1;"><tbody>';
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        const isHeader = r === 0;
        const bg = isHeader ? 'background-color: #f1f5f9;' : '';
        const weight = isHeader ? 'font-weight: bold; color: #0f172a;' : '';
        tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 10px 14px; min-width: 60px; ${bg} ${weight}">${isHeader ? `עמודה ${c + 1}` : '<br/>'}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br/></p>';
    const newHtml = insertHtmlAtCursorOrAppend(tableHtml);
    if (newHtml) updateActiveDocument({ contentHtml: newHtml });
  };

  const handleInsertImage = () => setIsImageOpen(true);

  const handleConfirmInsertImage = (
    imageUrl: string,
    caption?: string,
    widthPercent = 80,
    alignment: 'center' | 'right' | 'left' = 'center'
  ) => {
    const alignStyle =
      alignment === 'center' ? 'text-align: center;' : alignment === 'right' ? 'text-align: right;' : 'text-align: left;';
    const imgHtml = `<div style="${alignStyle} margin: 20px 0; clear: both;"><img src="${imageUrl}" alt="${caption || 'תמונה'}" style="max-width: ${widthPercent}%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); display: inline-block;" />${caption ? `<p style="font-size: 0.85em; color: #64748b; margin-top: 6px; font-style: italic;">${caption}</p>` : ''}</div><p><br/></p>`;
    const newHtml = insertHtmlAtCursorOrAppend(imgHtml);
    if (newHtml) updateActiveDocument({ contentHtml: newHtml });
  };

  const handleInsertCallout = () => {
    const calloutHtml = `<div class="callout-box" style="background-color: #eff6ff; border-right: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 6px;"><p style="margin: 0;"><br/></p></div><p><br/></p>`;
    const newHtml = insertHtmlAtCursorOrAppend(calloutHtml);
    if (newHtml) updateActiveDocument({ contentHtml: newHtml });
  };

  const handleInsertHorizontalLine = () => {
    const newHtml = insertHtmlAtCursorOrAppend('<hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 20px 0;" /><p><br/></p>');
    if (newHtml) updateActiveDocument({ contentHtml: newHtml });
  };

  const handleAddPage = () => {
    if (!activeDoc) return;
    const newHtml = insertPageBreak({
      headerText: activeDoc.headerText || activeDoc.title,
      footerText: activeDoc.footerText || 'כותרת תחתונה',
      showPageNumbers: activeDoc.showPageNumbers !== false,
      pageNumberFormat: activeDoc.pageNumberFormat || 'standard',
    });
    if (newHtml) updateActiveDocument({ contentHtml: newHtml });
  };

  const handleAddComment = (text: string, selectedText?: string) => {
    if (!activeDoc || !canComment) return;
    const newComment: Comment = {
      id: `c_${Date.now()}`,
      author: profile.fullName,
      avatar: '',
      text,
      createdAt: 'עכשיו',
      resolved: false,
      selectedText,
    };
    updateActiveDocument({ comments: [newComment, ...activeDoc.comments] });
    setShowComments(true);
  };

  const handleResolveComment = (id: string) => {
    if (!activeDoc) return;
    updateActiveDocument({
      comments: activeDoc.comments.map((c) => (c.id === id ? { ...c, resolved: true } : c)),
    });
  };

  const handleAcceptSuggestion = (id: string) => {
    if (!activeDoc) return;
    const sug = activeDoc.suggestions.find((s) => s.id === id);
    if (sug) {
      updateActiveDocument({
        suggestions: activeDoc.suggestions.map((s) => (s.id === id ? { ...s, status: 'accepted' } : s)),
      });
      formatDoc('insertHTML', sug.suggestedText);
    }
  };

  const handleRejectSuggestion = (id: string) => {
    if (!activeDoc) return;
    updateActiveDocument({
      suggestions: activeDoc.suggestions.map((s) => (s.id === id ? { ...s, status: 'rejected' } : s)),
    });
  };

  const handleRestoreVersion = (version: DocumentModel['history'][number]) => {
    if (!activeDoc || !canEdit) return;
    updateActiveDocument({ contentHtml: version.contentHtml });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeDoc || !currentDocId) {
    return (
      <div className="docword-root h-full -m-4 md:-m-6">
        <DocumentDashboard
          documents={documents}
          sharedDocIds={sharedDocIds}
          onSelectDocument={(doc) => setCurrentDocId(doc.id)}
          onCreateNewFromTemplate={handleCreateNewFromTemplate}
          onDeleteDocument={handleDeleteDocument}
          onDuplicateDocument={handleDuplicateDocument}
        />
      </div>
    );
  }

  return (
    <div className="docword-root h-full -m-4 md:-m-6 flex flex-col bg-[#F3F4F6] overflow-hidden font-sans select-none dir-rtl">
      <HeaderNav
        document={effectiveDoc!}
        onUpdateTitle={(title) => canEdit && updateActiveDocument({ title })}
        onToggleFavorite={() => updateActiveDocument({ isFavorite: !activeDoc.isFavorite })}
        onSelectDocMode={(docMode) => updateActiveDocument({ docMode })}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenDashboard={() => setCurrentDocId(null)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onPrint={() => window.print()}
        canEdit={canEdit}
        canShare={myPermission === 'owner'}
      />

      {canEdit && (
        <RibbonToolbar
          document={activeDoc}
          activeTab={activeRibbonTab}
          onChangeTab={setActiveRibbonTab}
          onUpdateDocument={updateActiveDocument}
          onInsertTable={handleInsertTable}
          onInsertImage={handleInsertImage}
          onInsertCallout={handleInsertCallout}
          onInsertHorizontalLine={handleInsertHorizontalLine}
          onToggleOutline={() => setShowOutline(!showOutline)}
          onToggleComments={() => setShowComments(!showComments)}
          showOutline={showOutline}
          showComments={showComments}
          showRuler={showRuler}
          onToggleRuler={() => setShowRuler(!showRuler)}
          onToggleSpellCheck={handleToggleSpellCheck}
          showSpellCheck={showSpellCheck}
          spellErrorCount={currentSpellErrors.length + currentGrammarIssues.length}
          onToggleSpellMarks={handleToggleSpellMarks}
          isSpellMarksActive={isSpellMarksActive}
          onAddPage={handleAddPage}
        />
      )}

      {!canEdit && (
        <div className="h-10 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-4 text-xs text-gray-500">
          <span>{myPermission === 'commenter' ? 'תוכל/י להוסיף הערות למסמך זה' : 'תצוגה בלבד - שותף איתך'}</span>
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-blue-600 hover:underline font-semibold"
          >
            {showComments ? 'הסתר הערות' : 'הצג הערות'}
          </button>
        </div>
      )}

      {canEdit && showRuler && activeDoc.viewMode === 'paged' && (
        <Ruler margins={{ left: activeDoc.margins.left, right: activeDoc.margins.right }} />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {showOutline && canEdit && (
          <DocumentOutline contentHtml={activeDoc.contentHtml} onClose={() => setShowOutline(false)} />
        )}

        <DocumentCanvas
          document={effectiveDoc!}
          onContentChange={(contentHtml) => canEdit && updateActiveDocument({ contentHtml })}
          onAddCommentFromSelection={(sel) => handleAddComment('הערה לגבי טקסט מסומן', sel)}
          showRuler={canEdit && showRuler}
          customDictionary={customDictionary}
          ignoredWords={ignoredWords}
          activeSpellError={activeSpellError}
          onReplaceSpellError={handleReplaceSpellError}
          onAddToDictionary={handleAddToDictionary}
          onIgnoreSpellError={handleIgnoreSpellError}
          onAddPage={handleAddPage}
        />

        {showComments && (
          <CommentsAndSuggestionsPanel
            comments={activeDoc.comments}
            suggestions={activeDoc.suggestions}
            onAddComment={(txt) => handleAddComment(txt)}
            onResolveComment={handleResolveComment}
            onAcceptSuggestion={handleAcceptSuggestion}
            onRejectSuggestion={handleRejectSuggestion}
            onClose={() => setShowComments(false)}
          />
        )}

        {showSpellCheck && (
          <SpellCheckPanel
            errors={currentSpellErrors}
            grammarIssues={currentGrammarIssues}
            onSelectError={(error) => setActiveSpellError(error)}
            onReplaceError={handleReplaceSpellError}
            onReplaceGrammar={handleReplaceGrammar}
            onIgnoreError={handleIgnoreSpellError}
            onAddToDictionary={handleAddToDictionary}
            customDictionary={customDictionary}
            onRemoveFromDictionary={handleRemoveFromDictionary}
            onClose={() => setShowSpellCheck(false)}
            selectedErrorId={activeSpellError?.id}
          />
        )}
      </div>

      <StatusBar
        document={activeDoc}
        onUpdateDocument={updateActiveDocument}
        spellErrorCount={currentSpellErrors.length + currentGrammarIssues.length}
        onToggleSpellCheck={handleToggleSpellCheck}
        onAddPage={handleAddPage}
      />

      {myPermission === 'owner' && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          documentId={activeDoc.id}
          documentTitle={activeDoc.title}
          ownerName={profile.fullName}
        />
      )}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        document={activeDoc}
        onImportDocument={(imported) => canEdit && updateActiveDocument(imported)}
        onPrint={() => window.print()}
      />

      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={activeDoc.history}
        onRestoreVersion={handleRestoreVersion}
      />

      <ImageModal isOpen={isImageOpen} onClose={() => setIsImageOpen(false)} onInsertImage={handleConfirmInsertImage} />
    </div>
  );
};

export default DocumentsPage;
