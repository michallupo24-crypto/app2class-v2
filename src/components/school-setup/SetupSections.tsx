import { useMemo, useState } from "react";
import { Check, ImagePlus, Paintbrush, Plus, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SubjectSticker } from "@/components/SubjectSticker";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ALL_GRADES, BUILTIN_ROLES, GUIDELINE_SECTIONS, ROLE_AREAS, SCOPE_LABELS, SUBJECT_CATALOG,
  newSubject, scopeGrades,
  type CustomRoleDraft, type Guidelines, type RoomDraft, type SubjectDraft, type SubjectKind,
  type SubjectScope, type TeacherDraft, type TrackDraft,
} from "@/lib/schoolSetup";

/* ── small shared bits ─────────────────────────────────── */
const chip = "rounded-full border-[2px] px-3 py-1.5 font-body text-[12.5px] font-bold leading-none transition-colors";
const chipOn = "border-primary bg-primary text-primary-foreground";
const chipOff = "border-border bg-card text-text-secondary hover:border-primary/50";

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-[12px] leading-snug text-muted-foreground">{children}</p>;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[18px] border border-border/70 bg-card p-3.5", className)}>{children}</div>;
}

async function uploadLogo(uploaderId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${uploaderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("school-logos").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("school-logos").getPublicUrl(path).data.publicUrl;
}

/** A subject's logo: catalog sticker, uploaded image or "in design". */
export function SubjectLogo({ s, size = 40 }: { s: { sticker: string | null; logoMode: string; logoUrl?: string | null; name: string }; size?: number }) {
  if (s.logoMode === "upload" && s.logoUrl) {
    return <img src={s.logoUrl} alt="" width={size} height={size} className="shrink-0 rounded-[30%] border-[2.5px] border-white object-cover shadow-sm" style={{ width: size, height: size }} />;
  }
  if (s.logoMode === "design_request") {
    return (
      <span className="grid shrink-0 place-items-center rounded-[30%] border-2 border-dashed border-primary/50 bg-primary/5 text-primary" style={{ width: size, height: size }}>
        <Paintbrush className="h-4 w-4" />
      </span>
    );
  }
  return <SubjectSticker subject={s.sticker || s.name} size={size} />;
}

/** Picks a catalog sticker. */
export function StickerPicker({ value, onPick, children }: { value: string | null; onPick: (name: string) => void; children: React.ReactNode }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[300px] p-2" align="start">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לוגו…" className="mb-2 h-8 text-sm" />
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {SUBJECT_CATALOG.map(({ group, names }) => {
            const list = names.filter((n) => !q || n.includes(q));
            if (!list.length) return null;
            return (
              <div key={group}>
                <p className="mb-1 text-[10px] font-bold text-muted-foreground">{group}</p>
                <div className="flex flex-wrap gap-1">
                  {list.map((n) => (
                    <button
                      key={n}
                      type="button"
                      title={n}
                      aria-label={n}
                      onClick={() => { onPick(n); setOpen(false); }}
                      className={cn("rounded-xl p-0.5", value === n ? "ring-2 ring-primary" : "hover:bg-muted")}
                    >
                      <SubjectSticker subject={n} size={30} flat />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Tag-style list input ("א", "ב", "5 יח״ל"...). */
function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-body text-[12px] font-bold">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`הסרת ${t}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="h-8 w-40 text-sm"
      />
    </div>
  );
}

/* ── Grades & classes ─────────────────────────────────── */
export function GradesEditor({ grades, classesPerGrade, onChange }: {
  grades: string[];
  classesPerGrade: Record<string, number>;
  onChange: (grades: string[], classesPerGrade: Record<string, number>) => void;
}) {
  return (
    <div className="space-y-3">
      <Hint>סמנו את השכבות בבית הספר וכמה כיתות יש בכל שכבה. אפשר לשנות גם אחרי האישור.</Hint>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ALL_GRADES.map((g) => {
          const on = grades.includes(g);
          return (
            <Card key={g} className={cn("flex items-center gap-3", !on && "opacity-60")}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? grades.filter((x) => x !== g) : ALL_GRADES.filter((x) => x === g || grades.includes(x)), classesPerGrade)}
                className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 font-heading text-[15px] font-black", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}
              >
                {g}
              </button>
              <label className="flex flex-1 items-center gap-2 font-body text-[12.5px] font-semibold text-muted-foreground">
                כיתות
                <Input
                  type="number"
                  min={1}
                  max={30}
                  disabled={!on}
                  value={classesPerGrade[g] ?? 1}
                  onChange={(e) => onChange(grades, { ...classesPerGrade, [g]: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                  className="h-9 w-16 text-center text-sm"
                />
              </label>
            </Card>
          );
        })}
      </div>
      <p className="font-body text-[12.5px] font-bold">
        {grades.length} שכבות · {grades.reduce((n, g) => n + (classesPerGrade[g] || 1), 0)} כיתות
      </p>
    </div>
  );
}

/* ── Subjects ─────────────────────────────────────────── */
export function SubjectsEditor({ value, onChange, schoolGrades, uploaderId }: {
  value: SubjectDraft[];
  onChange: (v: SubjectDraft[]) => void;
  schoolGrades: string[];
  uploaderId: string | null;
}) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const selected = useMemo(() => new Set(value.map((s) => s.name)), [value]);

  const toggle = (name: string) =>
    onChange(selected.has(name) ? value.filter((s) => s.name !== name) : [...value, newSubject(name)]);
  const update = (name: string, patch: Partial<SubjectDraft>) =>
    onChange(value.map((s) => (s.name === name ? { ...s, ...patch } : s)));
  const addCustom = () => {
    const n = custom.trim();
    if (!n || selected.has(n)) return;
    onChange([...value, newSubject(n, true)]);
    setCustom("");
  };

  const upload = async (key: string, file: File, apply: (url: string) => void) => {
    if (!uploaderId) return;
    setUploading(key);
    try { apply(await uploadLogo(uploaderId, file)); } finally { setUploading(null); }
  };

  return (
    <div className="space-y-4">
      <Hint>
        בחרו מהרשימה את המקצועות הנלמדים. לכל מקצוע קובעים באילו שכבות הוא נלמד, ואם הוא מגמה (לכל מגמה לוגו משלה)
        או הקבצה (רמות עם אותו לוגו). מקצוע שלא ברשימה אפשר להוסיף בעצמכם.
      </Hint>

      <Card>
        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מקצוע…" className="h-9 pr-9 text-sm" />
        </div>
        <div className="max-h-[260px] space-y-3 overflow-y-auto pe-1">
          {SUBJECT_CATALOG.map(({ group, names }) => {
            const list = names.filter((n) => !q || n.includes(q));
            if (!list.length) return null;
            return (
              <div key={group}>
                <p className="mb-1.5 font-body text-[11px] font-extrabold text-muted-foreground">{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((n) => {
                    const on = selected.has(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(n)}
                        className={cn("flex items-center gap-1.5 rounded-full border-[2px] py-1 pe-3 ps-1 font-body text-[12.5px] font-bold transition-colors", on ? chipOn : chipOff)}
                      >
                        <SubjectSticker subject={n} size={22} flat />
                        {n}
                        {on && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <form className="mt-3 flex gap-2 border-t border-border/60 pt-3" onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="מקצוע שלא ברשימה…" className="h-9 text-sm" />
          <Button type="submit" size="sm" variant="outline" className="h-9 gap-1" disabled={!custom.trim()}><Plus className="h-4 w-4" />הוספה</Button>
        </form>
      </Card>

      {value.length > 0 && (
        <div className="space-y-2.5">
          <p className="font-heading text-[14px] font-black">{value.length} מקצועות נבחרו</p>
          {value.map((s) => {
            const grades = scopeGrades(s.scope, s.grades, schoolGrades);
            return (
              <Card key={s.name} className="space-y-3">
                <div className="flex items-center gap-3">
                  <SubjectLogo s={s} />
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-[15px] font-extrabold">{s.name}</p>
                    <p className="font-body text-[11.5px] font-semibold text-muted-foreground">
                      {grades.length ? `שכבות ${grades.join(", ")}` : "לא נבחרו שכבות"}
                      {s.kind === "track" ? " · מגמה" : s.kind === "ability_group" ? " · הקבצה" : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => onChange(value.filter((x) => x.name !== s.name))} aria-label={`הסרת ${s.name}`} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {s.custom && (
                  <div className="space-y-1.5 rounded-xl bg-muted/50 p-2.5">
                    <p className="font-body text-[12px] font-bold">לוגו למקצוע</p>
                    <div className="flex flex-wrap gap-1.5">
                      <StickerPicker value={s.sticker} onPick={(n) => update(s.name, { sticker: n, logoMode: "catalog" })}>
                        <button type="button" className={cn(chip, s.logoMode === "catalog" && s.sticker ? chipOn : chipOff)}>בחירת לוגו קיים</button>
                      </StickerPicker>
                      <label className={cn(chip, "cursor-pointer", s.logoMode === "upload" ? chipOn : chipOff, !uploaderId && "pointer-events-none opacity-50")}>
                        <ImagePlus className="me-1 inline h-3.5 w-3.5" />{uploading === s.name ? "מעלה…" : "העלאת לוגו"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) upload(s.name, f, (url) => update(s.name, { logoMode: "upload", logoUrl: url }));
                        }} />
                      </label>
                      <button type="button" onClick={() => update(s.name, { logoMode: "design_request", sticker: null })} className={cn(chip, s.logoMode === "design_request" ? chipOn : chipOff)}>
                        <Paintbrush className="me-1 inline h-3.5 w-3.5" />שאנחנו נעצב
                      </button>
                    </div>
                    {s.logoMode === "catalog" && !s.sticker && <Hint>צריך לבחור אחת מהאפשרויות.</Hint>}
                    {s.logoMode === "design_request" && <Hint>צוות App2Class יעצב לוגו ויחליף אותו כשיהיה מוכן. עד אז תוצג אות.</Hint>}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(SCOPE_LABELS) as SubjectScope[]).map((sc) => (
                    <button key={sc} type="button" onClick={() => update(s.name, { scope: sc })} className={cn(chip, s.scope === sc ? chipOn : chipOff)}>
                      {SCOPE_LABELS[sc]}
                    </button>
                  ))}
                </div>
                {s.scope === "grades" && (
                  <div className="flex flex-wrap gap-1.5">
                    {schoolGrades.map((g) => {
                      const on = s.grades.includes(g);
                      return (
                        <button key={g} type="button" onClick={() => update(s.name, { grades: on ? s.grades.filter((x) => x !== g) : [...s.grades, g] })}
                          className={cn("h-8 min-w-8 rounded-lg border-2 px-2 font-heading text-[13px] font-black", on ? "border-primary bg-primary/10 text-primary" : "border-border")}>
                          {g}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-body text-[12px] font-bold text-muted-foreground">סוג:</span>
                  {([["regular", "רגיל"], ["track", "מגמה"], ["ability_group", "הקבצה"]] as [SubjectKind, string][]).map(([k, label]) => (
                    <button key={k} type="button"
                      onClick={() => update(s.name, { kind: k, levels: k === "ability_group" ? s.levels || [] : undefined, tracks: k === "track" ? s.tracks || [] : undefined })}
                      className={cn(chip, s.kind === k ? chipOn : chipOff)}>
                      {label}
                    </button>
                  ))}
                </div>

                {s.kind === "ability_group" && (
                  <div className="space-y-1.5">
                    <Hint>רמות ההקבצה (למשל א, ב, ג או 3/4/5 יח״ל). לכל ההקבצות אותו לוגו. Enter להוספה.</Hint>
                    <TagInput value={s.levels || []} onChange={(levels) => update(s.name, { levels })} placeholder="רמה…" />
                  </div>
                )}

                {s.kind === "track" && (
                  <TracksEditor
                    tracks={s.tracks || []}
                    onChange={(tracks) => update(s.name, { tracks })}
                    onUpload={uploaderId ? (i, f) => upload(`${s.name}#${i}`, f, (url) => {
                      const next = [...(s.tracks || [])];
                      next[i] = { ...next[i], logoUrl: url, sticker: null };
                      update(s.name, { tracks: next });
                    }) : undefined}
                  />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TracksEditor({ tracks, onChange, onUpload }: { tracks: TrackDraft[]; onChange: (t: TrackDraft[]) => void; onUpload?: (i: number, f: File) => void }) {
  const set = (i: number, patch: Partial<TrackDraft>) => onChange(tracks.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="space-y-2">
      <Hint>המגמות שהמקצוע כולל. לכל מגמה לוגו משלה.</Hint>
      {tracks.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <StickerPicker value={t.sticker} onPick={(n) => set(i, { sticker: n, logoUrl: null })}>
            <button type="button" aria-label="בחירת לוגו למגמה" className="shrink-0">
              {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-9 w-9 rounded-[30%] object-cover" />
                : t.sticker ? <SubjectSticker subject={t.sticker} size={36} />
                : <span className="grid h-9 w-9 place-items-center rounded-[30%] border-2 border-dashed border-border text-muted-foreground"><Plus className="h-4 w-4" /></span>}
            </button>
          </StickerPicker>
          <Input value={t.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="שם המגמה" className="h-9 text-sm" />
          {onUpload && (
            <label className="cursor-pointer text-muted-foreground hover:text-foreground" title="העלאת לוגו">
              <ImagePlus className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(i, f); }} />
            </label>
          )}
          <button type="button" onClick={() => onChange(tracks.filter((_, j) => j !== i))} aria-label="הסרת מגמה" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onChange([...tracks, { name: "", sticker: null }])}>
        <Plus className="h-4 w-4" />מגמה
      </Button>
    </div>
  );
}

/* ── Rooms ────────────────────────────────────────────── */
export function RoomsEditor({ value, onChange }: { value: RoomDraft[]; onChange: (v: RoomDraft[]) => void }) {
  const set = (i: number, patch: Partial<RoomDraft>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      <Hint>חדרים, מעבדות ואולמות. משמש בבניית מערכת השעות.</Hint>
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_70px_auto] items-center gap-2">
          <Input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="שם / מספר" className="h-9 text-sm" />
          <Input value={r.kind} onChange={(e) => set(i, { kind: e.target.value })} placeholder="סוג (כיתה, מעבדה…)" className="h-9 text-sm" />
          <Input value={r.capacity} onChange={(e) => set(i, { capacity: e.target.value.replace(/\D/g, "") })} placeholder="מקומות" inputMode="numeric" className="h-9 text-sm" />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="הסרה" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onChange([...value, { name: "", kind: "", capacity: "" }])}>
        <Plus className="h-4 w-4" />חדר
      </Button>
    </div>
  );
}

/* ── Teachers ─────────────────────────────────────────── */
export function TeachersEditor({ value, onChange, subjects }: { value: TeacherDraft[]; onChange: (v: TeacherDraft[]) => void; subjects: string[] }) {
  const set = (i: number, patch: Partial<TeacherDraft>) => onChange(value.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="space-y-2">
      <Hint>המורים של בית הספר. כשהם נרשמים עם אותו אימייל הם מזוהים אוטומטית.</Hint>
      {value.map((t, i) => (
        <Card key={i} className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <Input value={t.fullName} onChange={(e) => set(i, { fullName: e.target.value })} placeholder="שם מלא" className="h-9 text-sm" />
            <Input value={t.email} onChange={(e) => set(i, { email: e.target.value })} placeholder="אימייל" type="email" dir="ltr" className="h-9 text-sm" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="הסרה" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {subjects.map((s) => {
                const on = t.subjects.includes(s);
                return (
                  <button key={s} type="button" onClick={() => set(i, { subjects: on ? t.subjects.filter((x) => x !== s) : [...t.subjects, s] })}
                    className={cn("rounded-full border px-2 py-0.5 font-body text-[11.5px] font-bold", on ? chipOn : chipOff)}>
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      ))}
      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onChange([...value, { fullName: "", email: "", subjects: [], role: "professional_teacher" }])}>
        <Plus className="h-4 w-4" />מורה
      </Button>
    </div>
  );
}

/* ── Timetable constraints ───────────────────────────── */
const CONSTRAINT_IDEAS = ["יום שישי קצר עד שיעור 5", "לא יותר משני שיעורים כפולים ביום", "שיעורי ספורט רק בבוקר", "מבחנים לא ביום ראשון"];

export function ConstraintsEditor({ value, onChange }: { value: { text: string }[]; onChange: (v: { text: string }[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (text: string) => { const t = text.trim(); if (t && !value.some((v) => v.text === t)) onChange([...value, { text: t }]); setDraft(""); };
  return (
    <div className="space-y-2">
      <Hint>כללים שמערכת השעות צריכה לשמור עליהם.</Hint>
      <ul className="space-y-1.5">
        {value.map((c, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 font-body text-[13px] font-semibold">
            <span className="flex-1">{c.text}</span>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="הסרה" className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(draft); }}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="אילוץ חדש…" className="h-9 text-sm" />
        <Button type="submit" size="sm" variant="outline" className="h-9" disabled={!draft.trim()}><Plus className="h-4 w-4" /></Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {CONSTRAINT_IDEAS.filter((t) => !value.some((v) => v.text === t)).map((t) => (
          <button key={t} type="button" onClick={() => add(t)} className={cn(chip, chipOff, "border-dashed")}>+ {t}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Roles ────────────────────────────────────────────── */
export function RolesEditor({ builtin, custom, onChange }: {
  builtin: string[];
  custom: CustomRoleDraft[];
  onChange: (builtin: string[], custom: CustomRoleDraft[]) => void;
}) {
  const setCustom = (i: number, patch: Partial<CustomRoleDraft>) => onChange(builtin, custom.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-heading text-[14px] font-black">תפקידים שהמערכת מכירה</p>
        <Hint>סמנו את התפקידים שקיימים בבית הספר. אנשי צוות יוכלו לבחור בהם בהרשמה, ואתם תשבצו אותם.</Hint>
        <div className="grid gap-2 sm:grid-cols-2">
          {BUILTIN_ROLES.map((r) => {
            const on = builtin.includes(r.value);
            return (
              <button key={r.value} type="button" aria-pressed={on}
                onClick={() => onChange(on ? builtin.filter((x) => x !== r.value) : [...builtin, r.value], custom)}
                className={cn("flex items-center gap-3 rounded-[16px] border-2 p-3 text-right transition-colors", on ? "border-primary bg-primary/5" : "border-border bg-card")}>
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {on && <Check className="h-4 w-4" />}
                </span>
                <span>
                  <span className="block font-heading text-[14px] font-bold">{r.label}</span>
                  <span className="block font-body text-[11.5px] text-muted-foreground">{r.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-heading text-[14px] font-black">תפקידים שלכם</p>
        <Hint>צרו תפקיד ותנו לו הרשאה לסביבות מסוימות. את התפקיד משבצים לאנשי צוות מהגדרות בית הספר.</Hint>
        {custom.map((r, i) => (
          <Card key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input value={r.name} onChange={(e) => setCustom(i, { name: e.target.value })} placeholder="שם התפקיד, למשל: אחראית טקסים" className="h-9 text-sm" />
              <button type="button" onClick={() => onChange(builtin, custom.filter((_, j) => j !== i))} aria-label="הסרה" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_AREAS.map((a) => {
                const on = r.areas.includes(a.value);
                return (
                  <button key={a.value} type="button" onClick={() => setCustom(i, { areas: on ? r.areas.filter((x) => x !== a.value) : [...r.areas, a.value] })}
                    className={cn(chip, on ? chipOn : chipOff)}>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onChange(builtin, [...custom, { name: "", areas: [] }])}>
          <Plus className="h-4 w-4" />תפקיד חדש
        </Button>
      </div>
    </div>
  );
}

/* ── Guidelines ───────────────────────────────────────── */
export function GuidelinesEditor({ value, onChange }: { value: Guidelines; onChange: (v: Guidelines) => void }) {
  const set = (section: keyof Guidelines, key: string, v: unknown) =>
    onChange({ ...value, [section]: { ...(value[section] as any), [key]: v } });
  return (
    <div className="space-y-3">
      <Hint>ההנחיות קובעות איך כל סביבה עובדת בבית הספר, ואם היא פעילה בכלל. אפשר לשנות אותן בכל רגע מהגדרות בית הספר.</Hint>
      {GUIDELINE_SECTIONS.map((sec) => {
        const data = value[sec.id] as any;
        const enabled = sec.toggle ? !!data[sec.toggle] : true;
        return (
          <Card key={sec.id} className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading text-[15px] font-black">{sec.title}</p>
              {sec.toggle && (
                <label className="flex items-center gap-2 font-body text-[12px] font-bold text-muted-foreground">
                  {enabled ? "פעיל" : "כבוי"}
                  <Switch checked={enabled} onCheckedChange={(c) => set(sec.id, sec.toggle!, c)} />
                </label>
              )}
            </div>
            {enabled && (
              <div className="grid gap-2 sm:grid-cols-2">
                {sec.fields.map((f) => {
                  if (sec.id === "chat" && (f.key === "allowedFrom" || f.key === "allowedUntil") && !data.limitHours) return null;
                  return (
                    <label key={f.key} className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 font-body text-[13px] font-semibold">
                      <span>{f.label}</span>
                      {f.type === "bool" ? (
                        <Switch checked={!!data[f.key]} onCheckedChange={(c) => set(sec.id, f.key, c)} />
                      ) : f.type === "number" ? (
                        <Input type="number" min={f.min} max={f.max} value={data[f.key]}
                          onChange={(e) => set(sec.id, f.key, Math.max(f.min, Math.min(f.max, Number(e.target.value) || 0)))}
                          className="h-8 w-16 text-center text-sm" />
                      ) : f.type === "time" ? (
                        <Input type="time" value={data[f.key]} onChange={(e) => set(sec.id, f.key, e.target.value)} className="h-8 w-28 text-sm" />
                      ) : (
                        <Input value={data[f.key]} onChange={(e) => set(sec.id, f.key, e.target.value)} className="h-8 w-28 text-sm" />
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
