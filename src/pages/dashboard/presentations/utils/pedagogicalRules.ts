import type { Slide } from '../types';

// First rule of the eventual multi-rule pedagogical engine (see the product
// spec's section 9) - a pure, deterministic word-count check per slide.
// No AI, no external calls: just counts words across every TextObject.
export const WORD_COUNT_WARNING_THRESHOLD = 40;

export function countSlideWords(slide: Slide): number {
  const text = slide.objects
    .filter((o) => o.type === 'text')
    .map((o) => o.text)
    .join(' ')
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function isSlideOverWordLimit(slide: Slide): boolean {
  return countSlideWords(slide) > WORD_COUNT_WARNING_THRESHOLD;
}
