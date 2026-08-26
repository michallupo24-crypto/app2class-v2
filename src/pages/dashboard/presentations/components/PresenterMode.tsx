import { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import type { PresentationModel } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';
import { SlideCanvas } from './SlideCanvas';
import { useFitScale } from '../utils/useFitScale';

interface Props {
  presentation: PresentationModel;
  onClose: () => void;
}

export function PresenterMode({ presentation, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const slide = presentation.slides[index];
  const [scale, stageRef] = useFitScale(CANVAS_WIDTH, CANVAS_HEIGHT, 24);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, presentation.slides.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation.slides.length]);

  if (!slide) return null;

  return (
    <div dir="rtl" className="fixed inset-0 bg-[#0a0a0c] z-50 flex flex-col">
      <div className="absolute top-5 right-5 font-heading text-xs text-white/40 truncate max-w-[40vw]">{presentation.title}</div>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        title="סגור (Esc)"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 flex items-center gap-5 px-16 min-h-0">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="p-2.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors shrink-0"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        <div ref={stageRef} className="flex-1 h-full flex items-center justify-center min-w-0">
          <SlideCanvas slide={slide} readOnly scale={scale} />
        </div>

        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, presentation.slides.length - 1))}
          disabled={index === presentation.slides.length - 1}
          className="p-2.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-colors shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="pb-6 flex items-center justify-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          {presentation.slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIndex(i)}
              className={`rounded-full transition-all ${i === index ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'}`}
              title={`שקף ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-white/40 text-[11px] font-mono tabular-nums">{index + 1} / {presentation.slides.length}</span>
      </div>
    </div>
  );
}
