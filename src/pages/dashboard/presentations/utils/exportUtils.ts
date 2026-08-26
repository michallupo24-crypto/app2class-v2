import type { PresentationModel } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';

// A slide's images are only ever fetched by the browser once the user
// visits that slide during editing - capturing a slide the user hasn't
// visited yet (e.g. during multi-slide PDF export) would otherwise
// silently rasterize blank <img> elements.
async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
    )
  );
}

async function captureNodeToCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  await waitForImages(node);
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(node, { useCORS: true, width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportSlideToPng(node: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureNodeToCanvas(node);
  downloadDataUrl(canvas.toDataURL('image/png'), filename);
}

/**
 * Renders each slide off-screen (not by toggling the visible active slide,
 * which would flicker the live sorter/header) and compiles them into one PDF.
 */
export async function exportPresentationToPdf(
  presentation: PresentationModel,
  renderSlideOffscreen: (slideIndex: number) => Promise<HTMLElement>,
  cleanupOffscreen: () => void
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [CANVAS_WIDTH, CANVAS_HEIGHT] });

  try {
    for (let i = 0; i < presentation.slides.length; i++) {
      const node = await renderSlideOffscreen(i);
      const canvas = await captureNodeToCanvas(node);
      if (i > 0) pdf.addPage([CANVAS_WIDTH, CANVAS_HEIGHT], 'landscape');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  } finally {
    cleanupOffscreen();
  }

  pdf.save(`${presentation.title || 'מצגת'}.pdf`);
}
