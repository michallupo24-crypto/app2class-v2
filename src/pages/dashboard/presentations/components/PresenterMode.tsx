import { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import type { PresentationModel } from '../types';
import { SlideCanvas } from './SlideCanvas';

interface Props {
  presentation: PresentationModel;
  onClose: () => void;
}

export function PresenterMode({ presentation, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const slide = presentation.slides[index];

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
    <div dir="rtl" className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        title="סגור (Esc)"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        <SlideCanvas slide={slide} readOnly />

        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, presentation.slides.length - 1))}
          disabled={index === presentation.slides.length - 1}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="mt-4 text-white/70 text-xs font-mono">{index + 1} / {presentation.slides.length}</div>
    </div>
  );
}
