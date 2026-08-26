import { useState } from 'react';
import { Presentation as PresentationIcon, Plus, Search, Trash2, Copy, Clock, Users, Layers } from 'lucide-react';
import type { PresentationModel, PresentationTemplate } from '../types';
import { PRESENTATION_TEMPLATES } from '../data/templates';
import { SlidePreview } from './SlidePreview';

interface Props {
  presentations: PresentationModel[];
  sharedWithMe?: { presentation: PresentationModel; sharedByName: string | null }[];
  onSelectPresentation: (p: PresentationModel) => void;
  onCreateFromTemplate: (template: PresentationTemplate) => void;
  onDeletePresentation: (id: string) => void;
  onDuplicatePresentation: (p: PresentationModel) => void;
}

function DeckCard({
  title,
  slide,
  meta,
  onClick,
  actions,
}: {
  title: string;
  slide: PresentationModel['slides'][number] | undefined;
  meta: React.ReactNode;
  onClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/50"
    >
      <div className="relative bg-muted/60">
        <div className="aspect-video w-full flex items-center justify-center overflow-hidden">
          {slide ? (
            <SlidePreview slide={slide} />
          ) : (
            <Layers className="w-8 h-8 text-muted-foreground/30" />
          )}
        </div>
        {actions && (
          <div
            className="absolute top-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border">
        <h3 className="font-heading font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{title}</h3>
        <div className="text-[11px] text-muted-foreground mt-1">{meta}</div>
      </div>
    </div>
  );
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
    <div className="min-h-screen bg-background text-foreground flex flex-col select-none">
      <header className="h-14 bg-card border-b border-border px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <PresentationIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-heading font-bold text-foreground text-sm">מצגות</span>
            <span className="text-[10px] text-muted-foreground">עורך מצגות לכיתה</span>
          </div>
        </div>

        <div className="relative w-64 sm:w-80">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="חפש במצגות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-8 pl-3 py-1.5 bg-muted border border-transparent rounded-lg text-xs focus:outline-none focus:bg-card focus:border-primary/40 transition-colors"
          />
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-10">
        <section className="space-y-3">
          <h2 className="font-heading font-bold text-xs text-muted-foreground uppercase tracking-wider">תבניות להתחלה מהירה</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {PRESENTATION_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onCreateFromTemplate(tmpl)}
                className="group rounded-xl border border-border bg-card overflow-hidden text-right transition-colors hover:border-primary/50"
              >
                <div className="aspect-video w-full bg-muted/60 overflow-hidden flex items-center justify-center">
                  {tmpl.slides[0] ? (
                    <SlidePreview slide={tmpl.slides[0]} />
                  ) : (
                    <PresentationIcon className="w-6 h-6 text-muted-foreground/30" />
                  )}
                </div>
                <div className="p-3 border-t border-border flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-heading font-bold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">{tmpl.nameHe}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{tmpl.descriptionHe}</div>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {sharedWithMe.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-heading font-bold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> משותף איתי
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedWithMe.map(({ presentation: p, sharedByName }) => (
                <DeckCard
                  key={p.id}
                  title={p.title}
                  slide={p.slides[0]}
                  onClick={() => onSelectPresentation(p)}
                  meta={
                    <span>{p.slides.length} שקפים{sharedByName ? ` · שותף על ידי ${sharedByName}` : ''}</span>
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-foreground">המצגות שלי <span className="text-muted-foreground font-normal">({filtered.length})</span></h2>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-14 text-center">
              <PresentationIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="font-heading font-bold text-foreground text-sm">עדיין אין מצגות</p>
              <p className="text-xs text-muted-foreground mt-1">בחר/י תבנית למעלה כדי להתחיל</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => (
                <DeckCard
                  key={p.id}
                  title={p.title}
                  slide={p.slides[0]}
                  onClick={() => onSelectPresentation(p)}
                  meta={
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> עודכן {new Date(p.updatedAt).toLocaleDateString('he-IL')} · {p.slides.length} שקפים
                    </span>
                  }
                  actions={
                    <>
                      <button onClick={() => onDuplicatePresentation(p)} className="p-1.5 bg-card/95 hover:bg-muted rounded-md text-muted-foreground border border-border transition-colors" title="שכפל">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDeletePresentation(p.id)} className="p-1.5 bg-card/95 hover:bg-destructive/10 hover:text-destructive rounded-md text-muted-foreground border border-border transition-colors" title="מחק">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
