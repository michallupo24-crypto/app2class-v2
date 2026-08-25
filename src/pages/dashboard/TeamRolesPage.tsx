import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserCog, MoreVertical } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GRADES } from "@/lib/constants";

const STAFF_ROLE_SET = ["educator", "professional_teacher", "subject_coordinator", "grade_coordinator", "counselor", "management"];

const ROLE_LABELS: Record<string, string> = {
  educator: "מחנך/ת",
  professional_teacher: "מורה מקצועי/ת",
  subject_coordinator: "רכז/ת מקצוע",
  grade_coordinator: "רכז/ת שכבה",
  counselor: "יועץ/ת",
  management: "הנהלה",
  council_advisor: "אחראית מועצה",
};

// The roles management can grant/revoke from this screen. system_admin/super_admin
// stay bootstrap-only. subject_coordinator/grade_coordinator need one extra
// piece of metadata (which subject/grade) that other RLS in the app relies on.
const GRANTABLE_ROLES: { value: string; label: string; needsMeta?: "subject" | "grade" }[] = [
  { value: "council_advisor", label: "אחראית מועצה" },
  { value: "subject_coordinator", label: "רכז/ת מקצוע", needsMeta: "subject" },
  { value: "grade_coordinator", label: "רכז/ת שכבה", needsMeta: "grade" },
  { value: "counselor", label: "יועץ/ת" },
  { value: "professional_teacher", label: "מורה מקצועי/ת" },
  { value: "management", label: "הנהלה" },
];

interface StaffEntry {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
}

const TeamRolesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { toast } = useToast();
  const isManagement = profile.roles.some((r) => ["management", "system_admin"].includes(r));

  const [staff, setStaff] = useState<StaffEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [metaDialog, setMetaDialog] = useState<{ userId: string; role: string; needsMeta: "subject" | "grade" } | null>(null);
  const [metaValue, setMetaValue] = useState("");
  const [revokeManagementFor, setRevokeManagementFor] = useState<string | null>(null);

  const load = async () => {
    if (!profile.schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: profs } = await supabase.from("profiles").select("id, full_name, email").eq("school_id", profile.schoolId);
    const schoolProfileIds = (profs || []).map((p) => p.id);
    const { data: roleRows } = schoolProfileIds.length
      ? await supabase.from("user_roles").select("user_id, role").in("user_id", schoolProfileIds)
      : { data: [] };

    const rolesByUser: Record<string, string[]> = {};
    (roleRows || []).forEach((r) => {
      rolesByUser[r.user_id] = rolesByUser[r.user_id] || [];
      rolesByUser[r.user_id].push(r.role);
    });

    const staffEntries: StaffEntry[] = (profs || [])
      .filter((p) => (rolesByUser[p.id] || []).some((r) => STAFF_ROLE_SET.includes(r)))
      .map((p) => ({ ...p, roles: rolesByUser[p.id] || [] }));

    setStaff(staffEntries);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile.id, profile.schoolId]);

  const grantRole = async (userId: string, role: string, meta?: { subject?: string; grade?: string }) => {
    setBusyId(userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any, ...meta });
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else {
      toast({ title: `✅ התפקיד "${ROLE_LABELS[role] || role}" הוקצה` });
      load();
    }
    setBusyId(null);
  };

  const revokeRole = async (userId: string, role: string) => {
    setBusyId(userId);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else {
      toast({ title: "התפקיד הוסר" });
      load();
    }
    setBusyId(null);
  };

  const toggleRole = (userId: string, role: string, hasIt: boolean) => {
    const roleDef = GRANTABLE_ROLES.find((r) => r.value === role);
    if (hasIt) {
      if (role === "management") {
        setRevokeManagementFor(userId);
      } else {
        revokeRole(userId, role);
      }
      return;
    }
    if (roleDef?.needsMeta) {
      setMetaDialog({ userId, role, needsMeta: roleDef.needsMeta });
      setMetaValue("");
    } else {
      grantRole(userId, role);
    }
  };

  const confirmMeta = () => {
    if (!metaDialog || !metaValue) return;
    const meta = metaDialog.needsMeta === "subject" ? { subject: metaValue } : { grade: metaValue };
    grantRole(metaDialog.userId, metaDialog.role, meta);
    setMetaDialog(null);
    setMetaValue("");
  };

  if (!isManagement) {
    return <div className="text-center py-12 text-muted-foreground">אין לך הרשאה לצפות בעמוד זה</div>;
  }

  const filtered = staff.filter((s) => s.full_name.includes(search) || s.email.includes(search));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <UserCog className="h-7 w-7 text-primary" /> ניהול אנשי צוות
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">הקצאת תפקידים לאנשי הצוות - לחצו על שלוש הנקודות ליד כל איש/אשת צוות</p>
      </div>

      <Input placeholder="חיפוש לפי שם או אימייל..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between flex-wrap gap-3 py-4">
                <div>
                  <p className="font-heading font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {s.email}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {s.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">
                        {ROLE_LABELS[r] || r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" disabled={busyId === s.id}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>הקצאת תפקידים</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {GRANTABLE_ROLES.map((r) => (
                      <DropdownMenuCheckboxItem
                        key={r.value}
                        checked={s.roles.includes(r.value)}
                        onCheckedChange={() => toggleRole(s.id, r.value, s.roles.includes(r.value))}
                      >
                        {r.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">לא נמצאו אנשי צוות</p>}
        </div>
      )}

      <Dialog open={!!metaDialog} onOpenChange={(o) => !o && setMetaDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{metaDialog?.needsMeta === "subject" ? "איזה מקצוע?" : "איזו שכבה?"}</DialogTitle>
          </DialogHeader>
          {metaDialog?.needsMeta === "subject" ? (
            <div>
              <Label className="text-xs">שם המקצוע</Label>
              <Input value={metaValue} onChange={(e) => setMetaValue(e.target.value)} placeholder="למשל: מתמטיקה" />
            </div>
          ) : (
            <div>
              <Label className="text-xs">שכבה</Label>
              <Select value={metaValue} onValueChange={setMetaValue}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר/י שכבה" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      שכבה {g}׳
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={confirmMeta} disabled={!metaValue} className="w-full">
            הקצה תפקיד
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeManagementFor} onOpenChange={(o) => !o && setRevokeManagementFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>הסרת הרשאת הנהלה?</AlertDialogTitle>
            <AlertDialogDescription>הפעולה תסיר מהמשתמש/ת גישה לכלי ניהול בית הספר. ודאו שיש עוד לפחות איש/אשת הנהלה אחד/ת בבית הספר.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeManagementFor) revokeRole(revokeManagementFor, "management");
                setRevokeManagementFor(null);
              }}
            >
              הסר הרשאה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default TeamRolesPage;
