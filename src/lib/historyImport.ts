import * as XLSX from "xlsx";

/* Reads a school's history file (past grades or behavior records, Excel or
   CSV) into rows for student_history_records. Columns are found by their
   Hebrew/English header names; a wide sheet with one column per subject
   ("מתמטיקה", "אנגלית"...) is unpivoted into one row per subject. */

export interface HistoryRow {
  student_id_number: string | null;
  student_name: string;
  record_type: "grade" | "behavior";
  grade_level: string | null;
  school_year: string | null;
  subject: string | null;
  score: number | null;
  note: string | null;
  occurred_on: string | null;
}

const COLS = {
  id: ["ת.ז", "תז", "ת\"ז", "ת״ז", "תעודת זהות", "מספר זהות", "id", "id number"],
  name: ["שם", "שם מלא", "שם התלמיד", "שם תלמיד", "שם התלמיד/ה", "name", "student"],
  first: ["שם פרטי", "first name"],
  last: ["שם משפחה", "last name"],
  grade: ["שכבה", "כיתה", "grade", "class"],
  year: ["שנה", "שנת לימודים", "שנה\"ל", "year"],
  subject: ["מקצוע", "subject"],
  score: ["ציון", "ציון סופי", "score", "grade value"],
  note: ["הערה", "הערות", "תיאור", "אירוע", "התנהגות", "note", "description"],
  date: ["תאריך", "date"],
};

const norm = (s: unknown) => String(s ?? "").trim().replace(/[׳']/g, "").replace(/[״"]/g, "\"").toLowerCase();
const findCol = (headers: string[], names: string[]) => headers.findIndex((h) => names.some((n) => norm(h) === norm(n)));
const GRADES = ["ז", "ח", "ט", "י", "יא", "יב"];

/** "י\"א 2", "יא-3", "11" → "יא". */
function gradeOf(v: unknown): string | null {
  const s = String(v ?? "").replace(/[״"׳'\s]/g, "");
  const byNum: Record<string, string> = { "7": "ז", "8": "ח", "9": "ט", "10": "י", "11": "יא", "12": "יב" };
  const num = s.match(/^(\d{1,2})/)?.[1];
  if (num && byNum[num]) return byNum[num];
  const he = [...GRADES].sort((a, b) => b.length - a.length).find((g) => s.startsWith(g));
  return he || null;
}

function dateOf(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

export async function parseHistoryFile(file: Blob, fileName: string, kind: "grades" | "behavior"): Promise<{ rows: HistoryRow[]; warnings: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = fileName.toLowerCase().endsWith(".csv")
    ? XLSX.read(new TextDecoder("utf-8").decode(buf), { type: "string" })
    : XLSX.read(buf, { type: "array" });
  const rows: HistoryRow[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const table = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: "" });
    // The header is the first row that has a name or ID column.
    const headerIdx = table.findIndex((r) => {
      const h = (r as unknown[]).map(String);
      return findCol(h, COLS.name) >= 0 || findCol(h, COLS.id) >= 0 || findCol(h, COLS.first) >= 0;
    });
    if (headerIdx < 0) { warnings.push(`בגיליון "${sheetName}" לא נמצאה עמודת שם או ת״ז`); continue; }
    const headers = (table[headerIdx] as unknown[]).map((h) => String(h).trim());
    const c = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, findCol(headers, names)])) as Record<keyof typeof COLS, number>;
    // A sheet named after a grade or year ("י\"א", "תשפ\"ד") fills those in.
    const sheetGrade = gradeOf(sheetName);
    const sheetYear = /תש|20\d\d/.test(sheetName) ? sheetName.trim() : null;

    const known = new Set(Object.values(c).filter((i) => i >= 0));
    // Wide format: every other column with numbers is a subject.
    const subjectCols = kind === "grades" && c.subject < 0
      ? headers.map((h, i) => ({ h, i })).filter(({ h, i }) => h && !known.has(i))
      : [];

    for (const raw of table.slice(headerIdx + 1)) {
      const r = raw as unknown[];
      const idNum = c.id >= 0 ? String(r[c.id] ?? "").replace(/\D/g, "") || null : null;
      const name = c.name >= 0 ? String(r[c.name] ?? "").trim()
        : [c.first >= 0 ? r[c.first] : "", c.last >= 0 ? r[c.last] : ""].map((x) => String(x ?? "").trim()).filter(Boolean).join(" ");
      if (!name && !idNum) continue;
      const base = {
        student_id_number: idNum,
        student_name: name || idNum!,
        grade_level: (c.grade >= 0 ? gradeOf(r[c.grade]) : null) || sheetGrade,
        school_year: (c.year >= 0 ? String(r[c.year] ?? "").trim() || null : null) || sheetYear,
        occurred_on: c.date >= 0 ? dateOf(r[c.date]) : null,
      };

      if (kind === "behavior") {
        const note = c.note >= 0 ? String(r[c.note] ?? "").trim() : "";
        if (!note) continue;
        rows.push({ ...base, record_type: "behavior", subject: c.subject >= 0 ? String(r[c.subject] ?? "").trim() || null : null, score: null, note });
        continue;
      }

      if (subjectCols.length) {
        for (const { h, i } of subjectCols) {
          const v = Number(String(r[i] ?? "").replace(",", "."));
          if (String(r[i] ?? "").trim() === "" || Number.isNaN(v)) continue;
          rows.push({ ...base, record_type: "grade", subject: h, score: v, note: null });
        }
      } else {
        const v = c.score >= 0 ? Number(String(r[c.score] ?? "").replace(",", ".")) : NaN;
        if (Number.isNaN(v)) continue;
        rows.push({
          ...base, record_type: "grade",
          subject: c.subject >= 0 ? String(r[c.subject] ?? "").trim() || null : null,
          score: v,
          note: c.note >= 0 ? String(r[c.note] ?? "").trim() || null : null,
        });
      }
    }
  }
  if (!rows.length && !warnings.length) warnings.push("לא נמצאו שורות לייבוא");
  return { rows, warnings };
}
