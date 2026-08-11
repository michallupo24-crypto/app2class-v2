import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Shield, School, Plus, Trash2, Loader2, Save, UserX,
  Eye, EyeOff, FileText, RefreshCw, Settings2, AlertTriangle,
} from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface School { id: string; name: string; createdAt: string; studentCount: number; }
interface AuditEntry { id: string; action: string; actorName: string; targetName: string | null; createdAt: string; }

const ACTION_LABELS: Record<string, string> = {
  user_blocked: "השבתת חשבון",
  user_unblocked: "אישור/הפעלת חשבון",
  password_reset: "איפוס סיסמה",
  school_created: "הוספת בית ספר",
};
interface UserEntry { id: string; fullName: string; email: string; isApproved: boolean; roles: string[]; schoolName: string | null; }

const ROLE_LABELS: Record<string, string> = {
  student: "תלמיד", parent: "הורה", educator: "מחנך",
  professional_teacher: "מורה מקצועי", subject_coordinator: "רכז מקצוע",
  grade_coordinator: "רכז שכבה", counselor: "יועץ",
  management: "הנהלה", system_admin: "מנהל מערכת",
};

const SystemAdminPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();

  const [schools, setSchools] = useState<School[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("schools");

  // Schools management
  const [newSchoolName, setNewSchoolName] = useState("");
  const [addingSchool, setAddingSchool] = useState(false);
  const isSuperAdmin = profile.roles?.includes("super_admin");
  const [bootstrapMgmtName, setBootstrapMgmtName] = useState("");
  const [bootstrapMgmtEmail, setBootstrapMgmtEmail] = useState("");
  const [bootstrapClassesPerGrade, setBootstrapClassesPerGrade] = useState("1");
  const [bootstrapResult, setBootstrapResult] = useState<{ schoolName: string; managementEmail: string; tempPassword: string } | null>(null);

  // User management
  const [userSearch, setUserSearch] = useState("");
  const [blockDialog, setBlockDialog] = useState<UserEntry | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<UserEntry | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [killSwitchDialog, setKillSwitchDialog] = useState(false);
  const [killSwitchConfirm, setKillSwitchConfirm] = useState("");
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const KILL_SWITCH_PHRASE = "השבת הכל";

  // Email domains
  const [domains, setDomains] = useState<{ id: string; domain: string }[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadSchools(), loadUsers(), loadAuditLog(), loadDomains()]);
    setLoading(false);
  };

  const loadDomains = async () => {
    const { data } = await (supabase as any)
      .from("allowed_email_domains")
      .select("id, domain")
      .eq("is_active", true)
      .order("domain");
    setDomains(data || []);
  };

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setSavingDomain(true);
    try {
      const { error } = await (supabase as any).from("allowed_email_domains").insert({ domain: newDomain.trim().toLowerCase() });
      if (error) throw error;
      setNewDomain("");
      await loadDomains();
      toast({ title: "הסיומת נוספה ✅" });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSavingDomain(false);
    }
  };

  const removeDomain = async (id: string) => {
    const { error } = await (supabase as any).from("allowed_email_domains").delete().eq("id", id);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    setDomains((prev) => prev.filter((d) => d.id !== id));
  };

  const loadSchools = async () => {
    const { data } = await supabase.from("schools").select("id, name, created_at").order("created_at");
    if (!data) return;
    // Get student count per school
    const counts = await Promise.all(data.map((s: any) =>
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("school_id", s.id)
    ));
    setSchools(data.map((s: any, i: number) => ({
      id: s.id, name: s.name, createdAt: s.created_at, studentCount: counts[i].count || 0,
    })));
  };

  const loadUsers = async () => {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_approved, school_id, schools(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: roles } = await supabase
      .from("user_roles").select("user_id, role").limit(200);
    const roleMap = new Map<string, string[]>();
    (roles || []).forEach((r: any) => {
      const list = roleMap.get(r.user_id) || [];
      list.push(r.role);
      roleMap.set(r.user_id, list);
    });
    setUsers((profs || []).map((p: any) => ({
      id: p.id, fullName: p.full_name, email: p.email, isApproved: p.is_approved,
      roles: roleMap.get(p.id) || [], schoolName: (p.schools as any)?.name || null,
    })));
  };

  const loadAuditLog = async () => {
    const { data } = await (supabase as any)
      .from("system_audit_log")
      .select("id, action, actor_id, target_id, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = data || [];
    const ids = Array.from(new Set(rows.flatMap((r: any) => [r.actor_id, r.target_id].filter(Boolean))));
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids as string[]);
      (profs || []).forEach((p: any) => (nameMap[p.id] = p.full_name));
    }
    setAuditLog(rows.map((r: any) => ({
      id: r.id,
      action: ACTION_LABELS[r.action] || r.action,
      actorName: nameMap[r.actor_id] || "משתמש/ת",
      targetName: r.target_id ? nameMap[r.target_id] || "משתמש/ת" : null,
      createdAt: r.created_at,
    })));
  };

  const logAction = async (action: string, targetId?: string, details?: Record<string, unknown>) => {
    try {
      await (supabase as any).from("system_audit_log").insert({
        school_id: profile.schoolId,
        actor_id: profile.id,
        action,
        target_id: targetId || null,
        details: details || null,
      });
    } catch { /* best effort - never block the underlying action on log failure */ }
  };

  const addSchool = async () => {
    if (!newSchoolName.trim() || !bootstrapMgmtName.trim() || !bootstrapMgmtEmail.trim()) return;
    setAddingSchool(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "bootstrap_school",
          schoolName: newSchoolName.trim(),
          classesPerGrade: parseInt(bootstrapClassesPerGrade) || 1,
          managementFullName: bootstrapMgmtName.trim(),
          managementEmail: bootstrapMgmtEmail.trim(),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error.message);
      toast({ title: `בית הספר "${newSchoolName}" נוסף עם שכבות, כיתות וחשבון הנהלה! ✅` });
      setBootstrapResult({ schoolName: newSchoolName.trim(), managementEmail: data.managementEmail, tempPassword: data.tempPassword });
      setNewSchoolName("");
      setBootstrapMgmtName("");
      setBootstrapMgmtEmail("");
      loadSchools();
      loadAuditLog();
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setAddingSchool(false);
    }
  };

  const activateKillSwitch = async () => {
    if (killSwitchConfirm !== KILL_SWITCH_PHRASE) return;
    setKillSwitchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "kill_switch", confirm: killSwitchConfirm },
      });
      if (error || data?.error) throw new Error(data?.error || error.message);
      toast({ title: "Kill-Switch הופעל", description: `${data.affectedCount} חשבונות הושבתו`, variant: "destructive" });
      setKillSwitchDialog(false);
      setKillSwitchConfirm("");
      loadUsers();
      loadAuditLog();
    } catch (e: any) {
      toast({ title: "שגיאה בהפעלת Kill-Switch", description: e.message, variant: "destructive" });
    } finally {
      setKillSwitchLoading(false);
    }
  };

  const blockUser = async () => {
    if (!blockDialog) return;
    setBlocking(true);
    try {
      await supabase.from("profiles").update({ is_approved: false }).eq("id", blockDialog.id);
      toast({ title: `חשבון ${blockDialog.fullName} הושבת` });
      logAction("user_blocked", blockDialog.id);
      setBlockDialog(null);
      loadUsers();
      loadAuditLog();
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setBlocking(false);
    }
  };

  const toggleApproval = async (userId: string, current: boolean) => {
    await supabase.from("profiles").update({ is_approved: !current }).eq("id", userId);
    toast({ title: !current ? "חשבון אושר ✅" : "חשבון הושבת" });
    logAction(!current ? "user_unblocked" : "user_blocked", userId);
    loadUsers();
    loadAuditLog();
  };

  const exportUsers = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      "ID,שם מלא,אימייל,בתי ספר,תפקידים,סטטוס\n" +
      filteredUsers.map(u => `${u.id},"${u.fullName}","${u.email}","${u.schoolName || ''}","${u.roles.map(r => ROLE_LABELS[r] || r).join(', ')}",${u.isApproved ? 'פעיל' : 'מושבת'}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "users_export.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const changePassword = async () => {
    if (!passwordDialog || !newPassword) return;
    if (newPassword.length < 6) {
      toast({ title: "הסיסמה קצרה מדי", description: "לפחות 6 תווים", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "reset_password", userId: passwordDialog.id, newPassword },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `הסיסמה של ${passwordDialog.fullName} שונתה בהצלחה ✅` });
      logAction("password_reset", passwordDialog.id);
      setPasswordDialog(null);
      setNewPassword("");
      loadAuditLog();
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.fullName.includes(userSearch) || u.email.includes(userSearch) || (u.schoolName || "").includes(userSearch)
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />ניהול מערכת
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">שליטה מלאה — בתי ספר, משתמשים, Audit Trail</p>
      </motion.div>

      <motion.div variants={item}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="schools" className="font-heading text-xs">🏫 בתי ספר</TabsTrigger>
            <TabsTrigger value="users" className="font-heading text-xs">👤 משתמשים</TabsTrigger>
            <TabsTrigger value="audit" className="font-heading text-xs">📋 Audit Trail</TabsTrigger>
            <TabsTrigger value="settings" className="font-heading text-xs">⚙️ הגדרות</TabsTrigger>
          </TabsList>

          {/* ─── SCHOOLS ─── */}
          <TabsContent value="schools" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <School className="h-5 w-5 text-primary" />רשימת בתי ספר ({schools.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Bootstrap new school */}
                {isSuperAdmin ? (
                  <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
                    <p className="text-[11px] text-muted-foreground font-body">
                      יצירת בית ספר חדש בונה אוטומטית את כל השכבות (ז'-י"ב) והכיתות, ומקימה חשבון הנהלה ראשון.
                    </p>
                    <Input placeholder="שם בית הספר החדש..." value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} className="font-body text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="שם איש/ת ההנהלה" value={bootstrapMgmtName} onChange={e => setBootstrapMgmtName(e.target.value)} className="font-body text-sm" />
                      <Input placeholder="אימייל ההנהלה" type="email" value={bootstrapMgmtEmail} onChange={e => setBootstrapMgmtEmail(e.target.value)} className="font-body text-sm" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <Label className="text-xs font-heading shrink-0">כיתות לכל שכבה</Label>
                      <Input type="number" min={1} max={10} value={bootstrapClassesPerGrade} onChange={e => setBootstrapClassesPerGrade(e.target.value)} className="font-body text-sm w-20" />
                      <Button size="sm" className="gap-1 font-heading shrink-0 mr-auto" onClick={addSchool}
                        disabled={addingSchool || !newSchoolName.trim() || !bootstrapMgmtName.trim() || !bootstrapMgmtEmail.trim()}>
                        {addingSchool ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        בנה בית ספר
                      </Button>
                    </div>
                    {bootstrapResult && (
                      <div className="text-xs font-body p-2 rounded bg-success/10 text-success-foreground border border-success/30 space-y-1">
                        <p className="font-heading">חשבון ההנהלה של "{bootstrapResult.schoolName}" נוצר:</p>
                        <p>אימייל: <b dir="ltr">{bootstrapResult.managementEmail}</b></p>
                        <p>סיסמה זמנית: <b dir="ltr">{bootstrapResult.tempPassword}</b></p>
                        <p className="text-[10px] opacity-70">מסור פרטים אלה להנהלה ובקש להחליף סיסמה בכניסה הראשונה.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground font-body p-3 rounded-lg border border-dashed border-border">
                    יצירת בית ספר חדש זמינה רק למנהל-על (Super Admin).
                  </p>
                )}

                {schools.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="font-heading font-medium text-sm">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.studentCount} תלמידים רשומים</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">פעיל</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── USERS ─── */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input placeholder="חיפוש לפי שם / אימייל / בית ספר..."
                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                className="font-body text-sm flex-1" />
              <Button onClick={exportUsers} className="font-heading gap-2">
                <FileText className="h-4 w-4" /> ייצוא ל-CSV
              </Button>
            </div>

            <div className="space-y-2">
              {filteredUsers.slice(0, 30).map(u => (
                <Card key={u.id} className={!u.isApproved ? "border-muted/50 opacity-70" : ""}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-heading font-medium text-sm">{u.fullName}</p>
                          {!u.isApproved && <Badge variant="outline" className="text-[9px] text-muted-foreground">מושבת</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {u.roles.map(r => (
                            <Badge key={r} variant="secondary" className="text-[9px]">{ROLE_LABELS[r] || r}</Badge>
                          ))}
                          {u.schoolName && <Badge variant="outline" className="text-[9px]">{u.schoolName}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={u.isApproved} onCheckedChange={() => toggleApproval(u.id, u.isApproved)} />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary"
                          onClick={() => setPasswordDialog(u)} title="שנה סיסמה">
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                          onClick={() => setBlockDialog(u)} title="השבת משתמש">
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">לא נמצאו משתמשים</p>
              )}
            </div>
          </TabsContent>

          {/* ─── AUDIT ─── */}
          <TabsContent value="audit" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-heading font-medium">30 פעולות אחרונות</p>
              <Button size="sm" variant="outline" className="gap-1 font-heading text-xs" onClick={loadAuditLog}>
                <RefreshCw className="h-3.5 w-3.5" />רענן
              </Button>
            </div>
            {auditLog.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">אין עדיין פעולות מתועדות</p>
            )}
            {auditLog.map(e => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-heading font-medium">{e.action}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {e.actorName}{e.targetName ? ` ← ${e.targetName}` : ""}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(e.createdAt).toLocaleDateString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </TabsContent>

          {/* ─── SETTINGS ─── */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />סיומות מייל מורשות
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[11px] text-muted-foreground font-body">
                  הרשימה נאכפת בשרת — הרשמה עם סיומת שאינה ברשימה תיחסם גם אם עוקפים את הממשק.
                </p>
                <div className="flex gap-2">
                  <Input placeholder="הוסף סיומת (למשל: school.ac.il)"
                    value={newDomain} onChange={e => setNewDomain(e.target.value)}
                    className="font-body text-sm font-mono" dir="ltr"
                    onKeyDown={e => { if (e.key === "Enter") addDomain(); }} />
                  <Button size="sm" className="gap-1 font-heading shrink-0" onClick={addDomain} disabled={savingDomain || !newDomain.trim()}>
                    {savingDomain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    הוסף
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {domains.map(d => (
                    <div key={d.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border border-border">
                      <span className="text-xs font-mono" dir="ltr">{d.domain}</span>
                      <button onClick={() => removeDomain(d.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />פעולות חירום
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground font-body">
                  פעולות אלה בלתי הפיכות. השתמש בזהירות רבה.
                </p>
                <Button variant="destructive" size="sm" className="gap-2 font-heading"
                  onClick={() => setKillSwitchDialog(true)}>
                  <UserX className="h-4 w-4" />Kill-Switch — השבת כל החשבונות
                </Button>
                <p className="text-[10px] text-muted-foreground">משבית את כל החשבונות (מלבד מנהלי מערכת) באופן מיידי</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Block user dialog */}
      <Dialog open={!!blockDialog} onOpenChange={o => { if (!o) setBlockDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />השבתת חשבון
            </DialogTitle>
          </DialogHeader>
          {blockDialog && (
            <div className="space-y-4">
              <p className="text-sm font-body">
                האם להשבית את חשבון <b>{blockDialog.fullName}</b>?
                המשתמש לא יוכל להתחבר עד לשחזור ידני.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1 font-heading" onClick={blockUser} disabled={blocking}>
                  {blocking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  השבת
                </Button>
                <Button variant="outline" className="flex-1 font-heading" onClick={() => setBlockDialog(null)}>ביטול</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Kill-Switch Dialog */}
      <Dialog open={killSwitchDialog} onOpenChange={o => { if (!o) { setKillSwitchDialog(false); setKillSwitchConfirm(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />Kill-Switch — פעולת חירום
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-body text-muted-foreground">
              פעולה זו תשבית מיידית את כל החשבונות במערכת (מלבד מנהלי מערכת). הפעולה בלתי הפיכה אוטומטית — יידרש אישור ידני מחדש לכל חשבון.
              כדי לאשר, הקלד/י: <b>{KILL_SWITCH_PHRASE}</b>
            </p>
            <Input value={killSwitchConfirm} onChange={e => setKillSwitchConfirm(e.target.value)} placeholder={KILL_SWITCH_PHRASE} />
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1 font-heading"
                onClick={activateKillSwitch} disabled={killSwitchLoading || killSwitchConfirm !== KILL_SWITCH_PHRASE}>
                {killSwitchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                הפעל Kill-Switch
              </Button>
              <Button variant="outline" className="flex-1 font-heading" onClick={() => { setKillSwitchDialog(false); setKillSwitchConfirm(""); }}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={!!passwordDialog} onOpenChange={o => { if (!o) setPasswordDialog(null); setNewPassword(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />שינוי סיסמה
            </DialogTitle>
          </DialogHeader>
          {passwordDialog && (
            <div className="space-y-4">
              <p className="text-sm font-body text-muted-foreground">
                שינוי סיסמה עבור <b>{passwordDialog.fullName}</b>. (דורש הגדרת Backend לאימות Supabase)
              </p>
              <div className="space-y-2">
                <Label className="font-heading text-xs">סיסמה חדשה</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 font-heading" onClick={changePassword} disabled={changingPassword || !newPassword}>
                  {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  שנה סיסמה
                </Button>
                <Button variant="outline" className="flex-1 font-heading" onClick={() => { setPasswordDialog(null); setNewPassword(""); }}>ביטול</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default SystemAdminPage;
