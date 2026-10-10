import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileCheck2, Search, Loader2, Library, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BagrutExam {
  id: string;
  exam_code: string;
  subject: string;
  sector: string | null;
  units: number | null;
  population: string | null;
  description: string | null;
  duration: string | null;
  notes: string | null;
  year: number;
  session_label: string;
  session_order: number;
  exam_file_url: string;
  answer_file_url: string | null;
}

interface SearchHit {
  snippet: string | null;
  in_answer: boolean;
}

const COLUMNS =
  "id, exam_code, subject, sector, units, population, description, duration, notes, year, session_label, session_order, exam_file_url, answer_file_url";
const PAGE_SIZE = 60;
const ALL = "all";

const uniqueSorted = <T,>(values: (T | null)[], compare?: (a: T, b: T) => number) =>
  [...new Set(values.filter((v): v is T => v != null))].sort(compare);

/** Highlights the searched term inside a text snippet. */
const Highlight = ({ text, term }: { text: string; term: string }) => {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
};

const BagrutArchive = () => {
  const [exams, setExams] = useState<BagrutExam[]>([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [sector, setSector] = useState(ALL);
  const [units, setUnits] = useState(ALL);
  const [code, setCode] = useState(ALL);
  const [session, setSession] = useState(ALL);
  const [answersOnly, setAnswersOnly] = useState(false);

  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Map<string, SearchHit> | null>(null);
  const [searching, setSearching] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  // PostgREST caps responses at 1000 rows, so page through the ~2,500 papers.
  useEffect(() => {
    (async () => {
      const all: BagrutExam[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any)
          .from("bagrut_exams")
          .select(COLUMNS)
          .order("year", { ascending: false })
          .order("session_order", { ascending: false })
          .order("exam_code")
          .range(from, from + 999);
        if (error || !data) break;
        all.push(...data);
        if (data.length < 1000) break;
      }
      setExams(all);
      setLoading(false);
    })();
  }, []);

  // Content search runs server-side (the full text never reaches the client).
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await (supabase as any).rpc("search_bagrut_exams", { p_query: term });
      setHits(new Map((data || []).map((r: any) => [r.id, { snippet: r.snippet, in_answer: r.in_answer }])));
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setVisible(PAGE_SIZE), [subject, year, sector, units, code, session, answersOnly, hits]);

  // Each dropdown only offers values that still exist under the other filters.
  const matches = (e: BagrutExam, skip?: string) =>
    (skip === "subject" || subject === ALL || e.subject === subject) &&
    (skip === "year" || year === ALL || String(e.year) === year) &&
    (skip === "sector" || sector === ALL || e.sector === sector) &&
    (skip === "units" || units === ALL || String(e.units) === units) &&
    (skip === "code" || code === ALL || e.exam_code === code) &&
    (skip === "session" || session === ALL || e.session_label === session) &&
    (!answersOnly || !!e.answer_file_url);

  const options = useMemo(() => {
    const pool = (skip: string) => exams.filter((e) => matches(e, skip));
    const codes = new Map<string, string>();
    pool("code").forEach((e) => codes.set(e.exam_code, `${e.exam_code} – ${e.description || e.subject}`));
    return {
      subjects: uniqueSorted(pool("subject").map((e) => e.subject)),
      years: uniqueSorted(pool("year").map((e) => e.year), (a, b) => b - a),
      sectors: uniqueSorted(pool("sector").map((e) => e.sector)),
      units: uniqueSorted(pool("units").map((e) => e.units), (a, b) => a - b),
      sessions: uniqueSorted(
        pool("session").map((e) => e.session_label),
        (a, b) =>
          (exams.find((e) => e.session_label === a)?.session_order ?? 0) -
          (exams.find((e) => e.session_label === b)?.session_order ?? 0)
      ),
      codes: [...codes.entries()].sort(([a], [b]) => Number(a) - Number(b)),
    };
  }, [exams, subject, year, sector, units, code, session, answersOnly]);

  const filtered = useMemo(
    () => exams.filter((e) => matches(e) && (!hits || hits.has(e.id))),
    [exams, subject, year, sector, units, code, session, answersOnly, hits]
  );

  const hasFilters =
    [subject, year, sector, units, code, session].some((v) => v !== ALL) || answersOnly || !!search;
  const clearFilters = () => {
    [setSubject, setYear, setSector, setUnits, setCode, setSession].forEach((set) => set(ALL));
    setAnswersOnly(false);
    setSearch("");
  };

  const filterSelect = (
    value: string,
    onChange: (v: string) => void,
    allLabel: string,
    items: [string, string][],
    className = "w-36"
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {items.map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  if (loading) return <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>;

  if (exams.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Library className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-heading font-medium">מאגר הבגרויות עדיין לא יובא</p>
        <p className="text-xs mt-1">מנהל המערכת מייבא אותו עם npm run import:bagrut</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pr-10"
          placeholder="חיפוש בתוך השאלונים והתשובות (למשל: פונקציה מעריכית, מגילת העצמאות)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {searching && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {filterSelect(subject, setSubject, "כל המקצועות", options.subjects.map((s) => [s, s]))}
        {filterSelect(year, setYear, "כל השנים", options.years.map((y) => [String(y), String(y)]), "w-28")}
        {filterSelect(session, setSession, "כל המועדים", options.sessions.map((s) => [s, s]))}
        {filterSelect(sector, setSector, "כל סוגי החינוך", options.sectors.map((s) => [s, s]))}
        {filterSelect(units, setUnits, "כל הרמות", options.units.map((u) => [String(u), `${u} יח"ל`]), "w-28")}
        {filterSelect(code, setCode, "כל השאלונים", options.codes, "w-64")}
        <label className="flex items-center gap-2 text-sm font-body cursor-pointer">
          <Switch checked={answersOnly} onCheckedChange={setAnswersOnly} />
          רק עם תשובות
        </label>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> נקה סינון
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length.toLocaleString("he-IL")} שאלונים
        {hits && hits.size >= 1000 && " (מוצגות 1,000 התאמות התוכן הראשונות – כדאי לצמצם את החיפוש)"}
      </p>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <p className="font-heading font-medium">לא נמצאו שאלונים</p>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.slice(0, visible).map((e) => {
              const hit = hits?.get(e.id);
              return (
                <Card key={e.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <FileText className="h-8 w-8 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-heading font-bold">{e.subject} · שאלון {e.exam_code}</p>
                        {e.description && <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">{e.year} · {e.session_label}</Badge>
                          {e.units != null && <Badge variant="outline" className="text-[10px]">{e.units} יח"ל</Badge>}
                          {e.sector && <Badge variant="outline" className="text-[10px]">{e.sector}</Badge>}
                          {e.population && <Badge variant="outline" className="text-[10px]">{e.population}</Badge>}
                        </div>
                        {e.duration && <p className="text-[11px] text-muted-foreground mt-1">משך: {e.duration}</p>}
                        {hit?.snippet && (
                          <p className="text-[11px] text-muted-foreground mt-2 border-r-2 border-primary/40 pr-2 line-clamp-3">
                            {hit.in_answer && <span className="font-medium text-foreground">בתשובה: </span>}
                            …<Highlight text={hit.snippet} term={search.trim()} />…
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5" asChild>
                        <a href={e.exam_file_url} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" /> שאלון</a>
                      </Button>
                      {e.answer_file_url && (
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5" asChild>
                          <a href={e.answer_file_url} target="_blank" rel="noreferrer"><FileCheck2 className="h-3.5 w-3.5" /> תשובה לדוגמה</a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {visible < filtered.length && (
            <div className="text-center">
              <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                הצג עוד ({(filtered.length - visible).toLocaleString("he-IL")} נוספים)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BagrutArchive;
