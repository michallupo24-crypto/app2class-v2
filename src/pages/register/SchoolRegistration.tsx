import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, FileSpreadsheet, Trash2, Upload, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import RegistrationLayout from "@/components/registration/RegistrationLayout";
import EmailInput from "@/components/registration/EmailInput";
import {
  ConstraintsEditor, GradesEditor, GuidelinesEditor, Hint, RoomsEditor, RolesEditor, SubjectLogo,
  SubjectsEditor, TeachersEditor,
} from "@/components/school-setup/SetupSections";
import {
  BUILTIN_ROLES, EMPTY_APPLICATION, SCOPE_LABELS, scopeGrades, withGuidelineDefaults,
  type ApplicationPayload,
} from "@/lib/schoolSetup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/* A principal registers the school: account, school and grades, subjects,
   rooms / teachers / constraints, roles, guidelines, history files, review.
   The school opens only after a system admin approves the application. */

const STEPS = ["פרטי מנהל/ת", "בית הספר", "מקצועות", "חדרים, מורים ואילוצים", "תפקידים", "הנחיות", "ייבוא נתונים", "סיכום ושליחה"];
const LOCAL_KEY = "a2c.schoolApplication";

const IMPORT_KINDS = [
  { value: "grades", label: "ציונים משנים קודמות" },
  { value: "behavior", label: "רקורד התנהגות" },
  { value: "students", label: "רשימות תלמידים" },
  { value: "other", label: "אחר" },
];

type AppStatus = "draft" | "pending" | "approved" | "rejected";

const SchoolRegistration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus>("draft");
  const [rejection, setRejection] = useState<string | null>(null);
  const [data, setData] = useState<ApplicationPayload>(EMPTY_APPLICATION);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [importKind, setImportKind] = useState("grades");
  const [uploading, setUploading] = useState(false);
  const restored = useRef(false);
  const appIdRef = useRef<string | null>(null);
  const creatingRef = useRef<Promise<string | null> | null>(null);
  useEffect(() => { appIdRef.current = appId; }, [appId]);

  // Resume: a signed-in applicant continues their application; otherwise
  // restore the local draft (e.g. after confirming the email).
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setEmail(session.user.email || "");
        const { data: app } = await supabase.from("school_applications" as any).select("*")
          .eq("applicant_id", session.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (app) {
          const a = app as any;
          setAppId(a.id);
          setStatus(a.status);
          setRejection(a.rejection_reason);
          setFullName(a.applicant_name);
          setPhone(a.applicant_phone || "");
          setData({ ...EMPTY_APPLICATION, ...a.payload, guidelines: withGuidelineDefaults(a.payload?.guidelines) });
          setStep(a.status === "draft" || a.status === "rejected" ? 2 : STEPS.length);
          restored.current = true;
          return;
        }
        const { data: prof } = await supabase.from("profiles").select("full_name, phone").eq("id", session.user.id).maybeSingle();
        if (prof) { setFullName(prof.full_name || ""); setPhone((prof as any).phone || ""); }
      }
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setData({ ...EMPTY_APPLICATION, ...saved.data, guidelines: withGuidelineDefaults(saved.data?.guidelines) });
          if (saved.fullName) setFullName(saved.fullName);
          if (saved.phone) setPhone(saved.phone);
          if (saved.email && !session) setEmail(saved.email);
        }
      } catch { /* storage unavailable */ }
      restored.current = true;
    })();
  }, []);

  // Keep a local copy so nothing is lost before the account exists.
  useEffect(() => {
    if (!restored.current) return;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ data, fullName, phone, email })); } catch { /* ignore */ }
  }, [data, fullName, phone, email]);

  const patch = <K extends keyof ApplicationPayload>(k: K, v: ApplicationPayload[K]) => setData((d) => ({ ...d, [k]: v }));

  const saveDraft = async (nextStatus: AppStatus = "draft"): Promise<string | null> => {
    if (!userId) return null;
    const row = {
      applicant_id: userId,
      applicant_name: fullName.trim(),
      applicant_email: email.trim(),
      applicant_phone: phone.trim(),
      school_name: data.school.name.trim() || "בית ספר חדש",
      payload: data,
      status: nextStatus,
      submitted_at: nextStatus === "pending" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    // Saves can overlap (moving on while a file uploads); they all share the
    // one insert so the applicant never ends up with two applications.
    const id = appIdRef.current || (await (creatingRef.current ||= (async () => {
      const { data: existing } = await supabase.from("school_applications" as any).select("id")
        .eq("applicant_id", userId).in("status", ["draft", "pending", "rejected"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing) return (existing as any).id as string;
      const { data: ins, error } = await supabase.from("school_applications" as any).insert(row).select("id").single();
      if (error) { toast({ title: "השמירה נכשלה", description: error.message, variant: "destructive" }); return null; }
      return (ins as any).id as string;
    })()));
    creatingRef.current = null;
    if (!id) return null;
    appIdRef.current = id;
    setAppId(id);
    const { error } = await supabase.from("school_applications" as any).update(row).eq("id", id);
    if (error) { toast({ title: "השמירה נכשלה", description: error.message, variant: "destructive" }); return null; }
    return id;
  };

  const createAccount = async () => {
    setLoading(true);
    try {
      const { data: auth, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/register/school` },
      });
      if (error) throw error;
      if (!auth.session || !auth.user) {
        // Email confirmation is on: the draft waits in this browser.
        setAwaitingConfirm(true);
        return;
      }
      setUserId(auth.user.id);
      await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() }).eq("id", auth.user.id);
      setStep(2);
    } catch (e: any) {
      toast({ title: "פתיחת החשבון נכשלה", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const next = async () => {
    if (step === 1) {
      if (userId) { await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() }).eq("id", userId); setStep(2); }
      else await createAccount();
      return;
    }
    if (step === STEPS.length) {
      setLoading(true);
      const id = await saveDraft("pending");
      setLoading(false);
      if (id) {
        setStatus("pending");
        try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
      }
      return;
    }
    await saveDraft();
    setStep(step + 1);
    window.scrollTo({ top: 0 });
  };

  const uploadImport = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    try {
      const id = appId || (await saveDraft());
      if (!id) return;
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("school-imports").upload(path, file);
      if (upErr) throw upErr;
      const { data: row, error } = await supabase.from("school_imports" as any)
        .insert({ application_id: id, kind: importKind, file_path: path, file_name: file.name }).select("id").single();
      if (error) throw error;
      patch("imports", [...data.imports, { id: (row as any).id, kind: importKind, name: file.name }]);
    } catch (e: any) {
      toast({ title: "ההעלאה נכשלה", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImport = async (id: string) => {
    patch("imports", data.imports.filter((x) => x.id !== id));
    await supabase.from("school_imports" as any).delete().eq("id", id);
  };

  const customLogoMissing = data.subjects.some((s) => s.custom && s.logoMode === "catalog" && !s.sticker);
  const stepValid = (() => {
    switch (step) {
      case 1: return !!fullName.trim() && !!email.trim() && !!phone.trim() && (userId ? true : password.length >= 6 && agreed);
      case 2: return !!data.school.name.trim() && data.school.grades.length > 0;
      case 3: return data.subjects.length > 0 && !customLogoMissing && data.subjects.every((s) => scopeGrades(s.scope, s.grades, data.school.grades).length > 0);
      default: return true;
    }
  })();

  /* ── terminal states ── */
  if (awaitingConfirm) {
    return (
      <Centered>
        <Clock className="mx-auto h-14 w-14 text-primary" />
        <h2 className="font-heading text-2xl font-black">אשרו את כתובת האימייל</h2>
        <p className="font-body text-muted-foreground">שלחנו קישור ל־{email}. אחרי האישור התחברו, והטופס ימשיך מאותה נקודה.</p>
        <Button onClick={() => navigate("/login")}>להתחברות</Button>
      </Centered>
    );
  }
  if (status === "pending" || status === "approved") {
    return (
      <Centered>
        {status === "approved" ? <CheckCircle2 className="mx-auto h-14 w-14 text-success" /> : <Clock className="mx-auto h-14 w-14 text-primary" />}
        <h2 className="font-heading text-2xl font-black">{status === "approved" ? "בית הספר אושר!" : "הבקשה נשלחה"}</h2>
        <p className="font-body text-muted-foreground">
          {status === "approved"
            ? "אפשר להיכנס למערכת ולהמשיך להגדיר את בית הספר."
            : `${data.school.name} ממתין לאישור מנהל מערכת. נעדכן באימייל כשהבקשה תאושר. עד אז אפשר לחזור לכאן ולעדכן פרטים.`}
        </p>
        <div className="flex justify-center gap-2">
          {status === "pending" && <Button variant="outline" onClick={() => { setStatus("draft"); setStep(2); }}>עדכון הבקשה</Button>}
          <Button onClick={() => navigate(status === "approved" ? "/dashboard" : "/")}>{status === "approved" ? "כניסה למערכת" : "לדף הראשי"}</Button>
        </div>
      </Centered>
    );
  }

  return (
    <RegistrationLayout
      title="רישום בית ספר"
      step={step}
      totalSteps={STEPS.length}
      onNext={next}
      onBack={() => setStep(step - 1)}
      nextDisabled={!stepValid}
      nextLabel={step === STEPS.length ? "שליחה לאישור" : step >= 4 && step <= 7 ? "המשך (אפשר גם אחר כך)" : "המשך"}
      loading={loading}
      showBack={step > 1 && !(step === 2 && !!userId)}
    >
      <h3 className="mb-1 font-heading text-xl font-bold">{STEPS[step - 1]}</h3>
      {status === "rejected" && step === 2 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 font-body text-[13px] text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>הבקשה הקודמת לא אושרה{rejection ? `: ${rejection}` : ""}. אפשר לתקן ולשלוח שוב.</span>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Hint>הרישום פותח חשבון למנהל/ת בית הספר. בית הספר נפתח לשימוש אחרי אישור של מנהל המערכת.</Hint>
          <Field label="שם מלא"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
          <Field label="טלפון"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></Field>
          {userId ? (
            <p className="font-body text-sm text-muted-foreground">מחובר/ת כ־<span dir="ltr">{email}</span></p>
          ) : (
            <>
              <Field label="דואר אלקטרוני"><EmailInput value={email} onChange={setEmail} /></Field>
              <Field label="סיסמה"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 6 תווים" dir="ltr" /></Field>
              <label className="flex items-start gap-2 font-body text-sm">
                <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
                <span>
                  קראתי ואני מסכים/ה ל<a href="/terms" target="_blank" className="text-primary underline">תנאי השימוש</a> ול
                  <a href="/privacy" target="_blank" className="text-primary underline">מדיניות הפרטיות</a>
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Field label="שם בית הספר"><Input value={data.school.name} onChange={(e) => patch("school", { ...data.school, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="עיר / יישוב"><Input value={data.school.city} onChange={(e) => patch("school", { ...data.school, city: e.target.value })} /></Field>
            <Field label="סמל מוסד (לא חובה)"><Input value={data.school.institutionCode} onChange={(e) => patch("school", { ...data.school, institutionCode: e.target.value.replace(/\D/g, "") })} dir="ltr" inputMode="numeric" /></Field>
          </div>
          <GradesEditor
            grades={data.school.grades}
            classesPerGrade={data.school.classesPerGrade}
            onChange={(grades, classesPerGrade) => patch("school", { ...data.school, grades, classesPerGrade })}
          />
        </div>
      )}

      {step === 3 && (
        <SubjectsEditor value={data.subjects} onChange={(v) => patch("subjects", v)} schoolGrades={data.school.grades} uploaderId={userId} />
      )}

      {step === 4 && (
        <div className="space-y-6">
          <Hint>מומלץ למלא עכשיו. כל זה עוזר לבנות מערכת שעות, ואפשר להשלים גם אחרי האישור.</Hint>
          <Section title="חדרים"><RoomsEditor value={data.rooms} onChange={(v) => patch("rooms", v)} /></Section>
          <Section title="מורים"><TeachersEditor value={data.teachers} onChange={(v) => patch("teachers", v)} subjects={data.subjects.map((s) => s.name)} /></Section>
          <Section title="אילוצי מערכת"><ConstraintsEditor value={data.constraints} onChange={(v) => patch("constraints", v)} /></Section>
        </div>
      )}

      {step === 5 && (
        <RolesEditor builtin={data.roles.builtin} custom={data.roles.custom} onChange={(builtin, custom) => patch("roles", { builtin, custom })} />
      )}

      {step === 6 && <GuidelinesEditor value={data.guidelines} onChange={(v) => patch("guidelines", v)} />}

      {step === 7 && (
        <div className="space-y-4">
          <Hint>
            העלו קבצי Excel או CSV עם ציונים משנים קודמות ורקורד התנהגות. בית ספר עם תלמידי י״ב יכול לייבא ציונים מכיתה ז׳ ואילך.
            אחרי האישור הקבצים נקלטים בהגדרות בית הספר, והמערכת משייכת כל שורה לתלמיד/ה לפי ת״ז או שם.
          </Hint>
          <div className="flex flex-wrap items-center gap-2">
            {IMPORT_KINDS.map((k) => (
              <button key={k.value} type="button" onClick={() => setImportKind(k.value)}
                className={`rounded-full border-2 px-3 py-1.5 font-body text-[12.5px] font-bold ${importKind === k.value ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {k.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[18px] border-2 border-dashed border-border p-6 text-center hover:border-primary/60">
            <Upload className="h-7 w-7 text-muted-foreground" />
            <span className="font-heading text-[14px] font-bold">{uploading ? "מעלה…" : "בחירת קובץ"}</span>
            <span className="font-body text-[12px] text-muted-foreground">xlsx, xls, csv · עמודות מומלצות: ת״ז, שם, שכבה, שנה, מקצוע, ציון / הערה</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImport(f); e.target.value = ""; }} />
          </label>
          {data.imports.length > 0 && (
            <ul className="space-y-1.5">
              {data.imports.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 font-body text-[13px] font-semibold">
                  <FileSpreadsheet className="h-4 w-4 text-success" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-[11px] text-muted-foreground">{IMPORT_KINDS.find((k) => k.value === f.kind)?.label}</span>
                  <button type="button" onClick={() => removeImport(f.id)} aria-label="הסרה" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 8 && (
        <div className="space-y-4 font-body text-[13.5px]">
          <Summary label="בית הספר" value={`${data.school.name}${data.school.city ? `, ${data.school.city}` : ""}`} onEdit={() => setStep(2)} />
          <Summary label="שכבות וכיתות" value={data.school.grades.map((g) => `${g} (${data.school.classesPerGrade[g] || 1})`).join(" · ")} onEdit={() => setStep(2)} />
          <div className="rounded-xl bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading font-black">{data.subjects.length} מקצועות</span>
              <button type="button" onClick={() => setStep(3)} className="text-[12px] font-bold text-primary">עריכה</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.subjects.map((s) => (
                <span key={s.name} className="flex items-center gap-1.5 rounded-full bg-card py-1 pe-2.5 ps-1 text-[12px] font-bold shadow-sm">
                  <SubjectLogo s={s} size={22} />
                  {s.name}
                  <span className="font-semibold text-muted-foreground">· {SCOPE_LABELS[s.scope]}{s.kind === "track" ? " · מגמה" : s.kind === "ability_group" ? " · הקבצה" : ""}</span>
                </span>
              ))}
            </div>
          </div>
          <Summary label="חדרים · מורים · אילוצים" value={`${data.rooms.length} · ${data.teachers.length} · ${data.constraints.length}`} onEdit={() => setStep(4)} />
          <Summary
            label="תפקידים"
            value={[...data.roles.builtin.map((r) => BUILTIN_ROLES.find((b) => b.value === r)?.label || r), ...data.roles.custom.map((c) => c.name).filter(Boolean)].join(" · ") || "—"}
            onEdit={() => setStep(5)}
          />
          <Summary
            label="הנחיות"
            value={[
              data.guidelines.chat.enabled ? (data.guidelines.chat.limitHours ? `שיחות ${data.guidelines.chat.allowedFrom}–${data.guidelines.chat.allowedUntil}` : "שיחות ללא הגבלת שעות") : "שיחות כבויות",
              `עד ${data.guidelines.exams.maxPerWeek} מבחנים בשבוע`,
              data.guidelines.council.enabled ? "מועצה פעילה" : "ללא מועצה",
              data.guidelines.newspaper.enabled ? "עיתון פעיל" : "ללא עיתון",
            ].join(" · ")}
            onEdit={() => setStep(6)}
          />
          <Summary label="קבצים לייבוא" value={data.imports.length ? `${data.imports.length} קבצים` : "אין"} onEdit={() => setStep(7)} />
          <Hint>אחרי השליחה מנהל/ת מערכת יבדוק את הבקשה. עד האישור אפשר לחזור ולעדכן.</Hint>
        </div>
      )}
    </RegistrationLayout>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="font-heading">{label}</Label>{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h4 className="font-heading text-[16px] font-black">{title}</h4>{children}</section>;
}

function Summary({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-heading font-black">{label}</p>
        <p className="text-muted-foreground">{value}</p>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-[12px] font-bold text-primary">עריכה</button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md space-y-4 rounded-card bg-card p-8 text-center shadow-card">
        {children}
      </motion.div>
    </div>
  );
}

export default SchoolRegistration;
