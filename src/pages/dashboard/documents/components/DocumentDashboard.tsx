import React, { useState } from 'react';
import {
  FileText, Plus, Search, Star, Sparkles, Folder,
  Trash2, Copy, Clock, Briefcase, Users, UserCheck,
  BookOpen, ChevronRight, Grid, List, Share2
} from 'lucide-react';
import { DocumentModel, Template } from '../types';
import { TEMPLATES } from '../data/templates';

interface DocumentDashboardProps {
  documents: DocumentModel[];
  sharedDocIds?: Set<string>;
  onSelectDocument: (doc: DocumentModel) => void;
  onCreateNewFromTemplate: (template: Template) => void;
  onDeleteDocument: (id: string) => void;
  onDuplicateDocument: (doc: DocumentModel) => void;
}

export const DocumentDashboard: React.FC<DocumentDashboardProps> = ({
  documents,
  sharedDocIds,
  onSelectDocument,
  onCreateNewFromTemplate,
  onDeleteDocument,
  onDuplicateDocument
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = filterFavorites ? doc.isFavorite : true;
    return matchesSearch && matchesFav;
  });

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Briefcase': return <Briefcase className="w-6 h-6 text-blue-600" />;
      case 'Users': return <Users className="w-6 h-6 text-teal-600" />;
      case 'UserCheck': return <UserCheck className="w-6 h-6 text-sky-600" />;
      case 'BookOpen': return <BookOpen className="w-6 h-6 text-purple-600" />;
      default: return <FileText className="w-6 h-6 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-gray-800 flex flex-col dir-rtl select-none font-sans">
      {/* Top App Header */}
      <header className="h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shadow-sm">
            W
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-gray-800 text-sm leading-tight">DocWord</span>
            <span className="text-[10px] text-gray-400 font-medium">עורך מסמכים משולב</span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-64 sm:w-80">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2" />
          <input
            type="text"
            placeholder="חפש במסמכים..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-8 pl-3 py-1 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        
        {/* ==================== TEMPLATES GALLERY ==================== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>תבניות מסמך מוכנות להתחלה מהירה</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onCreateNewFromTemplate(tmpl)}
                className="bg-white hover:bg-blue-50/50 p-4 rounded-2xl border border-slate-200 hover:border-blue-400 text-right transition-all transform hover:-translate-y-1 shadow-2xs hover:shadow-md flex flex-col justify-between group h-36"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-slate-100 group-hover:bg-blue-100 rounded-xl transition-colors">
                    {getTemplateIcon(tmpl.iconName)}
                  </div>
                  <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>

                <div>
                  <div className="font-bold text-xs text-slate-800 group-hover:text-blue-700 transition-colors">
                    {tmpl.nameHe}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                    {tmpl.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ==================== DOCUMENTS LIST ==================== */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <h2 className="font-extrabold text-lg text-slate-800">המסמכים שלי ({filteredDocs.length})</h2>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterFavorites(!filterFavorites)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  filterFavorites
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${filterFavorites ? 'fill-current text-amber-500' : ''}`} />
                <span>מועדפים בלבד</span>
              </button>
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-slate-400" />
              <p className="font-bold text-slate-700 text-sm">לא נמצאו מסמכים התואמים לחיפוש שלך.</p>
              <p className="text-xs text-slate-400 mt-1">נסה לבחור תבנית למעלה ליצירת מסמך חדש.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className="bg-white hover:bg-slate-50/80 p-5 rounded-2xl border border-slate-200 hover:border-blue-400 cursor-pointer transition-all shadow-2xs hover:shadow-md space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {doc.title}
                        </h3>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>עודכן {new Date(doc.updatedAt).toLocaleDateString('he-IL')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {sharedDocIds?.has(doc.id) && (
                        <span title="שותף איתך" className="p-1 bg-blue-50 text-blue-500 rounded-lg">
                          <Share2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {doc.isFavorite && <Star className="w-4 h-4 text-amber-400 fill-current" />}
                    </div>
                  </div>

                  {/* Document preview snippet */}
                  <div className="bg-slate-50 p-3 rounded-xl text-[11px] text-slate-500 line-clamp-2 h-12 font-sans">
                    {doc.contentHtml.replace(/<[^>]*>?/gm, '')}
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span className="bg-slate-100 px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold text-slate-600">
                      {doc.viewMode === 'paged' ? 'עמודים (Word)' : 'רציף (Docs)'}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDuplicateDocument(doc)}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                        title="שכפל מסמך"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {!sharedDocIds?.has(doc.id) && (
                        <button
                          onClick={() => onDeleteDocument(doc.id)}
                          className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-400 transition-colors"
                          title="מחק מסמך"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
};
