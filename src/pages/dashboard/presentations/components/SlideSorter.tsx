import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { Slide } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';
import { SlideWordCountBadge } from './SlideWordCountBadge';
import { SlidePreview } from './SlidePreview';

const THUMB_WIDTH = 158;
const THUMB_HEIGHT = (CANVAS_HEIGHT / CANVAS_WIDTH) * THUMB_WIDTH;

interface Props {
  slides: Slide[];
  activeSlideId: string | null;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onDeleteSlide: (id: string) => void;
  onMoveSlide: (id: string, direction: 'up' | 'down') => void;
}

export function SlideSorter({ slides, activeSlideId, onSelectSlide, onAddSlide, onDeleteSlide, onMoveSlide }: Props) {
  return (
    <div className="w-[196px] shrink-0 border-r border-border bg-card overflow-y-auto p-3 space-y-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">שקפים · {slides.length}</p>
      {slides.map((slide, idx) => {
        const isActive = slide.id === activeSlideId;
        return (
          <div
            key={slide.id}
            onClick={() => onSelectSlide(slide.id)}
            className="group relative cursor-pointer"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[10px] font-mono w-4 ${isActive ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{idx + 1}</span>
              <SlideWordCountBadge slide={slide} />
            </div>
            <div
              style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
              className={`rounded-md overflow-hidden border-2 transition-all ${
                isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border group-hover:border-primary/40'
              }`}
            >
              <SlidePreview slide={slide} />
            </div>
            <div className="absolute top-6 left-1.5 hidden group-hover:flex items-center gap-0.5 bg-card border border-border rounded-md p-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMoveSlide(slide.id, 'up'); }}
                disabled={idx === 0}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                title="הזז למעלה"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMoveSlide(slide.id, 'down'); }}
                disabled={idx === slides.length - 1}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                title="הזז למטה"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteSlide(slide.id); }}
                disabled={slides.length <= 1}
                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 text-muted-foreground"
                title="מחק שקף"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAddSlide}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> הוסף שקף
      </button>
    </div>
  );
}
