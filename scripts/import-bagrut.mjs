// Bulk-imports the Ministry of Education Bagrut zips into the national archive
// (public.bagrut_exams + the "bagrut-archive" storage bucket).
//
// Usage (PowerShell):
//   $env:SUPABASE_URL = "https://<project>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
//   npm run import:bagrut -- --key "C:\path\מקרא_שאלוני_בגרות_1.xlsx" "C:\path\bagrut_Math_2017-2026.zip" ...
//
// Zip layout: <subject>/<year>/<NN_session>/<code>_שאלון.pdf (+ <code>_תשובה_לדוגמה.pdf).
// Safe to re-run: papers already in the table are skipped unless --force is passed.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
// pdfjs wants "/"-terminated forward-slash paths, even on Windows.
const PDFJS_DIR = path.dirname(require.resolve("pdfjs-dist/package.json")).replace(/\\/g, "/");
const BUCKET = "bagrut-archive";
const CONCURRENCY = 4;
const EXAM_SUFFIX = "_שאלון.pdf";
const ANSWER_SUFFIX = "_תשובה_לדוגמה.pdf";

// ---------- args / env ----------
const args = process.argv.slice(2);
const force = args.includes("--force");
// --dry-run [N]: extract text from the first N papers per zip and print a sample; touches nothing remote.
const dryIdx = args.indexOf("--dry-run");
const dryRun = dryIdx >= 0;
const dryLimit = dryRun && /^\d+$/.test(args[dryIdx + 1] ?? "") ? Number(args[dryIdx + 1]) : 5;
const keyIdx = args.indexOf("--key");
const keyPath = keyIdx >= 0 ? args[keyIdx + 1] : null;
const zipPaths = args.filter((a, i) => a.endsWith(".zip") && i !== keyIdx + 1);

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if ((!dryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) || !keyPath || zipPaths.length === 0) {
  console.error("Missing input. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and pass --key <xlsx> <zip...>");
  process.exit(1);
}
const supabase = dryRun
  ? null
  : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ---------- key spreadsheet ----------
function loadKey(file) {
  const wb = XLSX.read(fs.readFileSync(file));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const byCode = new Map();
  for (const r of rows) {
    const code = String(r["סמל שאלון"] ?? "").trim();
    if (!code) continue;
    byCode.set(code, {
      subject: r["מקצוע"],
      sector: r["מגזר"],
      units: r['יח"ל'] != null ? Number(r['יח"ל']) : null,
      population: r["אוכלוסייה"],
      description: r["מה זה"],
      duration: r["משך הבחינה"],
      notes: r["הערות"] != null ? String(r["הערות"]) : null,
    });
  }
  return byCode;
}

// ---------- PDF text ----------
// Some MoE PDFs store Hebrew in visual (reversed) order. If reversed spellings of
// very common words outnumber the normal ones, flip each line so search works.
const COMMON = ["של", "את", "על", "שאלה", "אם", "לא", "הוא", "היא", "בין", "כי", "תשובה", "ענה"];
const reverseStr = (s) => [...s].reverse().join("");
function fixVisualHebrew(text) {
  const count = (words) =>
    words.reduce((n, w) => n + (text.match(new RegExp(`(^|[\\s.,:;()"'])${w}(?=$|[\\s.,:;()"'])`, "g"))?.length ?? 0), 0);
  const normal = count(COMMON);
  const reversed = count(COMMON.map(reverseStr));
  if (reversed <= normal) return text;
  return text.split("\n").map(reverseStr).join("\n");
}

async function extractPdfText(buf) {
  try {
    const task = pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      cMapUrl: `${PDFJS_DIR}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_DIR}/standard_fonts/`,
      disableFontFace: true,
      isEvalSupported: false,
      verbosity: 0,
    });
    const pdf = await task.promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      let line = "";
      const lines = [];
      for (const item of content.items) {
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        } else line += " ";
      }
      if (line.trim()) lines.push(line);
      pages.push(lines.join("\n"));
    }
    await task.destroy();
    const text = fixVisualHebrew(pages.join("\n\n")).replace(/[ \t]+/g, " ").trim();
    // Fonts without a Unicode map extract as junk glyphs; storing that would only pollute search.
    const visible = text.replace(/\s/g, "");
    const readable = visible.match(/[֐-׿؀-ۿA-Za-z0-9]/g)?.length ?? 0;
    if (visible.length < 50 || readable / visible.length < 0.6) return null;
    return text;
  } catch (e) {
    console.warn(`    ! text extraction failed: ${e.message}`);
    return null;
  }
}

// ---------- storage ----------
async function upload(storagePath, buf) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function existingKeys() {
  const keys = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("bagrut_exams")
      .select("exam_code, year, session_key")
      .range(from, from + 999);
    if (error) throw error;
    data.forEach((r) => keys.add(`${r.exam_code}|${r.year}|${r.session_key}`));
    if (data.length < 1000) return keys;
  }
}

async function runPool(items, worker) {
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) await worker(items[i++]);
    })
  );
}

// ---------- main ----------
const key = loadKey(keyPath);
console.log(`Key spreadsheet: ${key.size} exam codes`);
const done = force || dryRun ? new Set() : await existingKeys();
const stats = { imported: 0, skipped: 0, failed: 0, noText: 0, notInKey: new Set() };

for (const zipPath of zipPaths) {
  console.log(`\n== ${path.basename(zipPath)}`);
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));

  // Group exam + answer files by paper.
  const papers = new Map();
  zip.forEach((relPath, entry) => {
    if (entry.dir) return;
    // History/Literature/Tanach put state-religious papers one level deeper:
    // <subject>/<year>/<session>/ממד/<file>.
    const parts = relPath.split("/");
    if (parts.length < 4) return;
    const [folderSubject, yearStr, sessionKey] = parts;
    const fileName = parts[parts.length - 1];
    const religiousFolder = parts.length > 4 && parts[3] === "ממד";
    const isExam = fileName.endsWith(EXAM_SUFFIX);
    const isAnswer = fileName.endsWith(ANSWER_SUFFIX);
    if (!isExam && !isAnswer) return;
    const code = fileName.slice(0, -(isExam ? EXAM_SUFFIX : ANSWER_SUFFIX).length);
    const id = `${code}|${Number(yearStr)}|${sessionKey}`;
    const p = papers.get(id) ?? { id, code, folderSubject, year: Number(yearStr), sessionKey, religiousFolder };
    if (p[isExam ? "exam" : "answer"]) console.warn(`  ! duplicate ${relPath} - keeping the first`);
    else p[isExam ? "exam" : "answer"] = entry;
    papers.set(id, p);
  });

  const todo = [...papers.values()].filter((p) => p.exam && !done.has(p.id));
  stats.skipped += papers.size - todo.length;
  console.log(`${papers.size} papers, ${todo.length} to import`);

  if (dryRun) {
    for (const p of todo.slice(0, dryLimit)) {
      const text = await extractPdfText(await p.exam.async("nodebuffer"));
      const answer = p.answer ? await extractPdfText(await p.answer.async("nodebuffer")) : null;
      console.log(`\n--- ${p.id} | key: ${key.get(p.code)?.description ?? "NOT IN KEY"} | answer: ${p.answer ? "yes" : "no"}`);
      console.log(`exam text (${text?.length ?? 0} chars): ${(text ?? "<none>").slice(0, 300).replace(/\n/g, " / ")}`);
      if (p.answer) console.log(`answer text (${answer?.length ?? 0} chars): ${(answer ?? "<none>").slice(0, 150).replace(/\n/g, " / ")}`);
    }
    continue;
  }

  let n = 0;
  await runPool(todo, async (p) => {
    try {
      const meta = key.get(p.code);
      if (!meta) stats.notInKey.add(p.code);
      // Storage keys must be ASCII, so the Hebrew session folder becomes its number.
      const sessionNum = p.sessionKey.split("_")[0];
      const base = `${p.year}/${sessionNum}/${p.code}`;

      const examBuf = await p.exam.async("nodebuffer");
      const examUrl = await upload(`${base}_exam.pdf`, examBuf);
      const examText = await extractPdfText(examBuf);
      if (!examText) stats.noText++;

      let answerUrl = null;
      let answerText = null;
      if (p.answer) {
        const answerBuf = await p.answer.async("nodebuffer");
        answerUrl = await upload(`${base}_answer.pdf`, answerBuf);
        answerText = await extractPdfText(answerBuf);
      }

      const { error } = await supabase.from("bagrut_exams").upsert(
        {
          exam_code: p.code,
          subject: meta?.subject ?? p.folderSubject,
          sector: meta?.sector ?? (p.religiousFolder ? "ממלכתי-דתי" : null),
          units: meta?.units ?? null,
          population: meta?.population ?? null,
          description: meta?.description ?? null,
          duration: meta?.duration ?? null,
          notes: meta?.notes ?? null,
          year: p.year,
          session_key: p.sessionKey,
          session_label: p.sessionKey.split("_").slice(1).join(" "),
          session_order: Number(sessionNum) || 0,
          exam_file_url: examUrl,
          answer_file_url: answerUrl,
          exam_text: examText,
          answer_text: answerText,
        },
        { onConflict: "exam_code,year,session_key" }
      );
      if (error) throw error;
      stats.imported++;
    } catch (e) {
      stats.failed++;
      console.error(`  x ${p.id}: ${e.message}`);
    }
    if (++n % 25 === 0) console.log(`  ${n}/${todo.length}`);
  });
}

console.log(`\nDone. imported=${stats.imported} skipped=${stats.skipped} failed=${stats.failed}`);
if (stats.noText) console.log(`${stats.noText} papers had no extractable text (scanned) - they are listed but not content-searchable.`);
if (stats.notInKey.size) console.log(`Codes missing from the key spreadsheet: ${[...stats.notInKey].join(", ")}`);
if (stats.failed) console.log("Re-run the same command to retry the failed papers.");
