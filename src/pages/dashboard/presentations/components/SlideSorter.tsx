import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { Slide } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';
import { SlideWordCountBadge } from './SlideWordCountBadge';

const THUMB_WIDTH = 150;
const THUMB_SCALE = THUMB_WIDTH / CANVAS_WIDTH;
const THUMB_HEIGHT = CANVAS_HEIGHT * THUMB_SCALE;

interface Props {
  slides: Slide[];
  activeSlideId: string | null;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onDeleteSlide: (id: string) => void;
  onMoveSlide: (id: string, direction: 'up' | 'down') => void;
}

function MiniSlide({ slide }: { slide: Slide }) {
  return (
    <div
      className="relative overflow-hidden rounded"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${THUMB_SCALE})`, transformOrigin: 'top right', backgroundColor: slide.background }}
    >
      {slide.objects.map((obj) => (
        <div
          key={obj.id}
          className="absolute overflow-hidden"
          style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height }}
        >
          {obj.type === 'text' && (
            <div style={{ fontSize: obj.fontSize, fontWeight: obj.bold ? 700 : 400, color: obj.color, textAlign: obj.align }}>
              {obj.text}
            </div>
          )}
          {obj.type === 'image' && obj.url && <img src={obj.url} alt="" className="w-full h-full object-contain" />}
          {obj.type === 'shape' && (
            <div className="w-full h-full" style={{ backgroundColor: obj.fill, borderRadius: obj.shape === 'circle' ? '50%' : 2 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function SlideSorter({ slides, activeSlideId, onSelectSlide, onAddSlide, onDeleteSlide, onMoveSlide }: Props) {
  return (
    <div className="w-[190px] shrink-0 border-l border-border bg-card overflow-y-auto p-3 space-y-3">
      {slides.map((slide, idx) => (
        <div
          key={slide.id}
          onClick={() => onSelectSlide(slide.id)}
          className={`group relative cursor-pointer rounded-lg border-2 transition-colors ${
            slide.id === activeSlideId ? 'border-primary' : 'border-transparent hover:border-border'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-muted-foreground font-mono w-4">{idx + 1}</span>
            <SlideWordCountBadge slide={slide} />
          </div>
          <div style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }} className="bg-white border border-border rounded overflow-hidden">
            <MiniSlide slide={slide} />
          </div>
          <div className="absolute top-1 left-1 hidden group-hover:flex items-center gap-0.5 bg-card/90 rounded-lg p-0.5 shadow-sm">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveSlide(slide.id, 'up'); }}
              disabled={idx === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30"
              title="הזז למעלה"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveSlide(slide.id, 'down'); }}
              disabled={idx === slides.length - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30"
              title="הזז למטה"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeleteSlide(slide.id); }}
              disabled={slides.length <= 1}
              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
              title="מחק שקף"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAddSlide}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> הוסף שקף
      </button>
    </div>
  );
}
