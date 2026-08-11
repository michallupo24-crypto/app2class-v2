import * as pdfjsLib from "pdfjs-dist";
// Vite-bundled worker asset (avoids the classic Tesseract-style bug of guessing
// a CDN worker/version path at runtime).
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "md"];
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

export function getFileExtension(file: File): string {
  return (file.name.split(".").pop() || "").toLowerCase();
}

/** Fetches a publicly-hosted file (e.g. a Supabase Storage URL) as a File, so it
 * can be run through the same extraction/OCR helpers used for local uploads. */
export async function fetchFileFromUrl(url: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("לא ניתן היה להוריד את הקובץ");
  const blob = await res.blob();
  const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "file");
  return new File([blob], name, { type: blob.type });
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.includes(getFileExtension(file));
}

export function isExtractableDocument(file: File): boolean {
  return DOCUMENT_EXTENSIONS.includes(getFileExtension(file));
}

async function extractPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strs = content.items.map((i: any) => i.str);
    pages.push(`--- עמוד ${p} ---\n${strs.join(" ")}`);
  }
  return pages.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

async function extractSpreadsheet(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return `--- גיליון: ${name} ---\n${csv.trim()}`;
  }).join("\n\n");
}

async function extractPptx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return na - nb;
    });

  const slides: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const num = name.match(/slide(\d+)\.xml/)![1];
    slides.push(`--- שקופית ${num} ---\n${matches.join(" ")}`);
  }
  return slides.join("\n\n");
}

/**
 * Extracts text from a document file entirely client-side (PDF/Word/Excel/PowerPoint/plain
 * text) — no upload required. Throws for unsupported extensions; use isImageFile +
 * requestImageOcr (fileOcr.ts) for photos/scans instead.
 */
export async function extractDocumentText(file: File): Promise<string> {
  const ext = getFileExtension(file);
  if (ext === "pdf") return extractPdf(file);
  if (ext === "docx" || ext === "doc") return extractDocx(file);
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return extractSpreadsheet(file);
  if (ext === "pptx" || ext === "ppt") return extractPptx(file);
  if (ext === "txt" || ext === "md") return file.text();
  throw new Error(`סוג קובץ לא נתמך לחילוץ טקסט: .${ext}`);
}
