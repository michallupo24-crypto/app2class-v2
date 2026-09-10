// Same dynamic-import + html2canvas pattern as
// src/pages/dashboard/presentations/utils/exportUtils.ts, adapted for an
// arbitrary DOM node (the timetable grid for one class) instead of a fixed
// slide-deck canvas size - the grid's own rendered dimensions become the
// PDF page size, one page per call.
export async function exportElementToPdf(node: HTMLElement, filename: string): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, { useCORS: true });
  const { jsPDF } = await import("jspdf");
  const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [canvas.width, canvas.height] });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
}
