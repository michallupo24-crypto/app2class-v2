import { useCallback, useEffect, useState } from 'react';

/**
 * Watches a container and returns the scale factor needed to fit a
 * `contentW x contentH` box entirely inside it (shrink-to-fit, never
 * enlarges past 1), plus a ref callback to attach to that container.
 *
 * Uses a callback ref (state), not a plain useRef, on purpose: this hook
 * is called unconditionally at the top of components that conditionally
 * render the measured element later (e.g. the dashboard renders first,
 * the actual canvas container only exists once a presentation is
 * selected). A useRef's target changing doesn't re-run effects, so an
 * effect keyed on a stable ref object would measure `null` once and
 * never look again. A callback ref re-fires (and re-renders) exactly
 * when React actually attaches the node, whenever that is.
 */
export function useFitScale(contentW: number, contentH: number, padding = 0): [number, (node: HTMLElement | null) => void] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(1);

  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;

    const recompute = () => {
      const availW = node.clientWidth - padding * 2;
      const availH = node.clientHeight - padding * 2;
      if (availW <= 0 || availH <= 0) return;
      const next = Math.min(availW / contentW, availH / contentH, 1);
      setScale(next > 0 ? next : 1);
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(node);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [node, contentW, contentH, padding]);

  return [scale, ref];
}
