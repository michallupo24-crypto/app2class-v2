import { useState } from 'react';
import { Presentation as PresentationIcon, Plus, Search, Trash2, Copy, Clock, Users } from 'lucide-react';
import type { PresentationModel, PresentationTemplate } from '../types';
import { PRESENTATION_TEMPLATES } from '../data/templates';

interface Props {
  presentations: PresentationModel[];
  sharedWithMe?: { presentation: PresentationModel; sharedByName: string | null }[];
  onSelectPresentation: (p: PresentationModel) => void;
  onCreateFromTemplate: (template: PresentationTemplate) => void;
  onDeletePresentation: (id: string) => void;
  onDuplicatePresentation: (p: PresentationModel) => void;
}

export function PresentationDashboard({
  presentations,
  sharedWithMe = [],
  onSelectPresentation,
  onCreateFromTemplate,
  onDeletePresentation,
  onDuplicatePresentation,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = presentations.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col dir-rtl select-none font-sans">
      <header className="h-12 bg-card border-b border-border px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold shadow-sm">
            <PresentationIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm leading-tight">מצגות</span>
            <span className="text-[10px] text-muted-foreground font-medium">עורך מצגות</span>
          </div>
        </div>

        <div className="relative w-64 sm:w-80">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-2" />
          <input
            type="text"
            placeholder="חפש במצגות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-8 pl-3 py-1 bg-muted border border-border rounded text-xs focus:outline-hidden focus:bg-card focus:ring-1 focus:ring-primary"
          />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        <section className="space-y-3">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">תבניות להתחלה מהירה</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {PRESENTATION_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onCreateFromTemplate(tmpl)}
                className="bg-card hover:bg-primary/5 p-4 rounded-lg border border-border hover:border-primary text-right transition-colors flex flex-col justify-between group h-32"
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-muted group-hover:bg-primary/10 rounded-lg transition-colors">
                    <PresentationIcon className="w-5 h-5 text-primary" />
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <div className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{tmpl.nameHe}</div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{tmpl.descriptionHe}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {sharedWithMe.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> משותף איתי
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedWithMe.map(({ presentation: p, sharedByName }) => (
                <div
                  key={p.id}
                  onClick={() => onSelectPresentation(p)}
                  className="bg-card hover:bg-muted/50 p-5 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors space-y-3 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                      <PresentationIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{p.title}</h3>
                      {sharedByName && <div className="text-[11px] text-muted-foreground mt-0.5">שותף על ידי {sharedByName}</div>}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <span className="bg-muted px-2 py-0.5 rounded-full text-[10px] font-semibold text-muted-foreground">{p.slides.length} שקפים</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="font-extrabold text-lg text-foreground">המצגות שלי ({filtered.length})</h2>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-12 text-center text-muted-foreground">
              <PresentationIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-foreground text-sm">עדיין אין מצגות</p>
              <p className="text-xs text-muted-foreground mt-1">בחר/י תבנית למעלה כדי להתחיל</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectPresentation(p)}
                  className="bg-card hover:bg-muted/50 p-5 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors space-y-3 relative group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                      <PresentationIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{p.title}</h3>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>עודכן {new Date(p.updatedAt).toLocaleDateString('he-IL')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded-full text-[10px] font-semibold">{p.slides.length} שקפים</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onDuplicatePresentation(p)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors" title="שכפל">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDeletePresentation(p.id)} className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground transition-colors" title="מחק">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
}
