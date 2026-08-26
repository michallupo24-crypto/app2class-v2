import { AlertTriangle } from 'lucide-react';
import type { Slide } from '../types';
import { countSlideWords, isSlideOverWordLimit, WORD_COUNT_WARNING_THRESHOLD } from '../utils/pedagogicalRules';

interface Props {
  slide: Slide;
  className?: string;
}

export function SlideWordCountBadge({ slide, className = '' }: Props) {
  if (!isSlideOverWordLimit(slide)) return null;
  const count = countSlideWords(slide);
  return (
    <span
      title={`${count} מילים בשקף - מומלץ עד ${WORD_COUNT_WARNING_THRESHOLD}`}
      className={`inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning text-[10px] font-semibold px-1.5 py-0.5 ${className}`}
    >
      <AlertTriangle className="w-3 h-3" />
      {count} מילים
    </span>
  );
}
