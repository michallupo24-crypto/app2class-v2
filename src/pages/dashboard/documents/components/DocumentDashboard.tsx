import React, { useState } from 'react';
import {
  FileText, Plus, Search, Star, Folder,
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
      case 'Briefcase': return <Briefcase className="w-6 h-6 text-primary" />;
      case 'Users': return <Users className="w-6 h-6 text-success" />;
      case 'UserCheck': return <UserCheck className="w-6 h-6 text-info" />;
      case 'BookOpen': return <BookOpen className="w-6 h-6 text-accent" />;
      default: return <FileText className="w-6 h-6 text-primary" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col dir-rtl select-none font-sans">
      {/* Top App Header */}
      <header className="h-12 bg-card border-b border-border px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold shadow-sm">
            W
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm leading-tight">DocWord</span>
            <span className="text-[10px] text-muted-foreground font-medium">עורך מסמכים משולב</span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-64 sm:w-80">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-2" />
          <input
            type="text"
            placeholder="חפש במסמכים..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-8 pl-3 py-1 bg-muted border border-border rounded text-xs focus:outline-hidden focus:bg-card focus:ring-1 focus:ring-primary"
          />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        
        {/* ==================== TEMPLATES GALLERY ==================== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span>תבניות מסמך מוכנות להתחלה מהירה</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onCreateNewFromTemplate(tmpl)}
                className="bg-card hover:bg-primary/5 p-4 rounded-lg border border-border hover:border-primary text-right transition-colors flex flex-col justify-between group h-36"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-muted group-hover:bg-primary/10 rounded-lg transition-colors">
                    {getTemplateIcon(tmpl.iconName)}
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                <div>
                  <div className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                    {tmpl.nameHe}
                  </div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                    {tmpl.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ==================== DOCUMENTS LIST ==================== */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <h2 className="font-extrabold text-lg text-foreground">המסמכים שלי ({filteredDocs.length})</h2>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterFavorites(!filterFavorites)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                  filterFavorites
                    ? 'bg-warning/10 border-warning/30 text-warning'
                    : 'bg-card border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${filterFavorites ? 'fill-current text-warning' : ''}`} />
                <span>מועדפים בלבד</span>
              </button>
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-muted-foreground" />
              <p className="font-bold text-foreground text-sm">לא נמצאו מסמכים התואמים לחיפוש שלך.</p>
              <p className="text-xs text-muted-foreground mt-1">נסה לבחור תבנית למעלה ליצירת מסמך חדש.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className="bg-card hover:bg-muted/50 p-5 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {doc.title}
                        </h3>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>עודכן {new Date(doc.updatedAt).toLocaleDateString('he-IL')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {sharedDocIds?.has(doc.id) && (
                        <span title="שותף איתך" className="p-1 bg-primary/10 text-primary rounded-lg">
                          <Share2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {doc.isFavorite && <Star className="w-4 h-4 text-warning fill-current" />}
                    </div>
                  </div>

                  {/* Document preview snippet */}
                  <div className="bg-muted p-3 rounded-lg text-[11px] text-muted-foreground line-clamp-2 h-12 font-sans">
                    {doc.contentHtml.replace(/<[^>]*>?/gm, '')}
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold text-muted-foreground">
                      {doc.viewMode === 'paged' ? 'עמודים (Word)' : 'רציף (Docs)'}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDuplicateDocument(doc)}
                        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                        title="שכפל מסמך"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {!sharedDocIds?.has(doc.id) && (
                        <button
                          onClick={() => onDeleteDocument(doc.id)}
                          className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground transition-colors"
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
