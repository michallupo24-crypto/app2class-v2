import { useEffect, useState } from "react";
import { FlaskConical, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Dev-only: one-click sign-in as any demo-school user (see scripts/seed-demo-school.mjs).
// Mounted only when import.meta.env.DEV, and the accounts come from a dev-server-only
// endpoint, so neither the panel nor the password ever reach a production build.

type DemoAccounts = { school: string; password: string; accounts: { email: string; name: string }[] };

const ROLE_LABELS: Record<string, string> = {
  student: "תלמידה",
  parent: "הורה",
  educator: "מחנכת",
  teacher: "מורה מקצועי",
  "subject-coordinator": "רכזת מקצוע",
  "grade-coordinator": "רכז שכבה",
  counselor: "יועצת",
  principal: "מנהלת",
};

const roleKey = (email: string) => email.split("@")[0].replace(/^demo\./, "");

const DemoAccountSwitcher = () => {
  const [data, setData] = useState<DemoAccounts | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/__dev/demo-accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const signInAs = async (email: string) => {
    setBusy(email);
    setError(null);
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email, password: data.password });
    if (error) {
      setError(error.message);
      setBusy(null);
      return;
    }
    // Full reload so every auth-dependent hook starts from the new session.
    window.location.assign("/dashboard");
  };

  // Role accounts first, then the extra students (student2…student8).
  const main = data.accounts.filter((a) => ROLE_LABELS[roleKey(a.email)]);
  const extra = data.accounts.filter((a) => !ROLE_LABELS[roleKey(a.email)]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 md:bottom-4 left-4 z-[100] flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-xs font-bold text-amber-950 shadow-lg hover:bg-amber-300"
        aria-label="משתמשי דמו"
      >
        <FlaskConical className="h-4 w-4" /> דמו
      </button>
    );
  }

  return (
    <div dir="rtl" className="fixed bottom-24 md:bottom-4 left-4 z-[100] w-64 rounded-xl border bg-background p-3 text-sm shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold">משתמשי דמו · {data.school}</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="סגור">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {main.map((a) => (
          <button
            key={a.email}
            type="button"
            disabled={!!busy}
            onClick={() => signInAs(a.email)}
            className="flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            {busy === a.email && <Loader2 className="h-3 w-3 animate-spin" />}
            {ROLE_LABELS[roleKey(a.email)]}
          </button>
        ))}
      </div>
      {extra.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">תלמידים נוספים</summary>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {extra.map((a) => (
              <button
                key={a.email}
                type="button"
                disabled={!!busy}
                onClick={() => signInAs(a.email)}
                className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
              >
                {a.name}
              </button>
            ))}
          </div>
        </details>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default DemoAccountSwitcher;
