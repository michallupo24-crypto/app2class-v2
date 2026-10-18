import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SubjectLogo } from "@/components/school-setup/SetupSections";
import { BUILTIN_ROLES, SCOPE_LABELS, type ApplicationPayload } from "@/lib/schoolSetup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/* System admin: review school registration applications. A school exists
   only after approval (approve_school_application builds it). */

interface AppRow {
  id: string;
  applicant_name: string;
  applicant_email: string | null;
  applicant_phone: string | null;
  school_name: string;
  payload: ApplicationPayload;
  status: "draft" | "pending" | "approved" | "rejected";
  submitted_at: string | null;
  rejection_reason: string | null;
}

const STATUS: Record<AppRow["status"], { label: string; cls: string }> = {
  draft: { label: "טיוטה", cls: "bg-muted text-muted-foreground" },
  pending: { label: "ממתין לאישור", cls: "bg-warning/15 text-warning" },
  approved: { label: "אושר", cls: "bg-success/15 text-success" },
  rejected: { label: "נדחה", cls: "bg-destructive/15 text-destructive" },
};

export default function SchoolApplicationsPanel({ onApproved }: { onApproved?: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("school_applications" as any).select("*").order("submitted_at", { ascending: false, nullsFirst: false });
    if (!showAll) q = q.eq("status", "pending");
    const { data, error } = await q;
    if (error) toast({ title: "שגיאה בטעינת הבקשות", description: error.message, variant: "destructive" });
    setRows((data as any[]) || []);
    setLoading(false);
  }, [showAll, toast]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("approve_school_application" as any, { p_application_id: id });
    setBusy(null);
    if (error) { toast({ title: "האישור נכשל", description: error.message, variant: "destructive" }); return; }
    toast({ title: "בית הספר אושר ונוצר" });
    onApproved?.();
    load();
  };

  const reject = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("reject_school_application" as any, { p_application_id: id, p_reason: reason });
    setBusy(null);
    if (error) { toast({ title: "הדחייה נכשלה", description: error.message, variant: "destructive" }); return; }
    setReason("");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-body text-sm text-muted-foreground">
          {showAll ? "כל הבקשות" : `${rows.length} בקשות ממתינות`}
        </p>
        <Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>{showAll ? "רק ממתינות" : "הצגת הכל"}</Button>
      </div>

      {loading ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">טוען…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-card bg-card py-10 text-center font-body text-sm text-muted-foreground shadow-card">אין בקשות</p>
      ) : (
        rows.map((r) => {
          const p = r.payload || ({} as ApplicationPayload);
          const isOpen = open === r.id;
          const classes = (p.school?.grades || []).reduce((n, g) => n + (p.school?.classesPerGrade?.[g] || 1), 0);
          return (
            <div key={r.id} className="rounded-card bg-card shadow-card">
              <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} className="flex w-full items-center gap-3 p-4 text-right">
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-[15px] font-black">{r.school_name}{p.school?.city ? `, ${p.school.city}` : ""}</p>
                  <p className="font-body text-[12px] text-muted-foreground">
                    {r.applicant_name} · <span dir="ltr">{r.applicant_email}</span>
                    {r.submitted_at ? ` · ${new Date(r.submitted_at).toLocaleDateString("he-IL")}` : ""}
                  </p>
                </div>
                <Badge className={STATUS[r.status].cls} variant="outline">{STATUS[r.status].label}</Badge>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-border/60 p-4 font-body text-[13px]">
                  <Row label="מנהל/ת" value={`${r.applicant_name} · ${r.applicant_phone || "—"}`} />
                  <Row label="סמל מוסד" value={p.school?.institutionCode || "—"} />
                  <Row label="שכבות" value={`${(p.school?.grades || []).join(", ")} · ${classes} כיתות`} />
                  <div>
                    <p className="mb-1.5 font-heading font-black">{p.subjects?.length || 0} מקצועות</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(p.subjects || []).map((s) => (
                        <span key={s.name} className="flex items-center gap-1.5 rounded-full bg-muted/60 py-1 pe-2.5 ps-1 text-[12px] font-bold">
                          <SubjectLogo s={s} size={20} />
                          {s.name}
                          <span className="font-semibold text-muted-foreground">
                            · {SCOPE_LABELS[s.scope]}
                            {s.kind === "track" ? ` · מגמות: ${(s.tracks || []).map((t) => t.name).join(", ")}` : ""}
                            {s.kind === "ability_group" ? ` · הקבצות: ${(s.levels || []).join(", ")}` : ""}
                            {s.logoMode === "design_request" ? " · מבקשים עיצוב לוגו" : ""}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <Row label="חדרים · מורים · אילוצים" value={`${p.rooms?.length || 0} · ${p.teachers?.length || 0} · ${p.constraints?.length || 0}`} />
                  <Row
                    label="תפקידים"
                    value={[...(p.roles?.builtin || []).map((v) => BUILTIN_ROLES.find((b) => b.value === v)?.label || v), ...(p.roles?.custom || []).map((c) => c.name)].join(" · ") || "—"}
                  />
                  <Row label="קבצים לייבוא" value={String(p.imports?.length || 0)} />
                  {r.rejection_reason && <Row label="סיבת דחייה" value={r.rejection_reason} />}

                  {r.status === "pending" && (
                    <div className="space-y-2 border-t border-border/60 pt-3">
                      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבת דחייה (נשלחת למנהל/ת)" className="min-h-[60px] text-sm" />
                      <div className="flex gap-2">
                        <Button className="flex-1 gap-1.5" disabled={busy === r.id} onClick={() => approve(r.id)}>
                          <CheckCircle2 className="h-4 w-4" />{busy === r.id ? "יוצר את בית הספר…" : "אישור ויצירת בית הספר"}
                        </Button>
                        <Button variant="outline" className="gap-1.5 text-destructive" disabled={busy === r.id} onClick={() => reject(r.id)}>
                          <XCircle className="h-4 w-4" />דחייה
                        </Button>
                      </div>
                    </div>
                  )}
                  {r.status === "draft" && (
                    <p className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" />המנהל/ת עדיין ממלא/ת את הטופס</p>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p><span className="font-heading font-black">{label}: </span><span className="text-muted-foreground">{value}</span></p>
  );
}
