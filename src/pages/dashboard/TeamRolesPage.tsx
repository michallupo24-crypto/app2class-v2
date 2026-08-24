import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCog, Landmark } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STAFF_ROLE_SET = ["educator", "professional_teacher", "subject_coordinator", "grade_coordinator", "counselor", "management"];

const ROLE_LABELS: Record<string, string> = {
  educator: "מחנך/ת",
  professional_teacher: "מורה מקצועי/ת",
  subject_coordinator: "רכז/ת מקצוע",
  grade_coordinator: "רכז/ת שכבה",
  counselor: "יועץ/ת",
  management: "הנהלה",
};

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

  const grantAdvisor = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "council_advisor" });
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else {
      toast({ title: "✅ מונה כאחראית מועצה" });
      load();
    }
    setBusyId(null);
  };

  const revokeAdvisor = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "council_advisor");
    if (error) toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    else {
      toast({ title: "התפקיד הוסר" });
      load();
    }
    setBusyId(null);
  };

  if (!isManagement) {
    return <div className="text-center py-12 text-muted-foreground">אין לך הרשאה לצפות בעמוד זה</div>;
  }

  const filtered = staff.filter((s) => s.full_name.includes(search) || s.email.includes(search));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <UserCog className="h-7 w-7 text-primary" /> ניהול תפקידי צוות
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">הקצאת תפקיד "אחראית מועצה" לאיש/אשת חינוך</p>
      </div>

      <Input placeholder="חיפוש לפי שם או אימייל..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">טוען...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const isAdvisor = s.roles.includes("council_advisor");
            return (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between flex-wrap gap-3 py-4">
                  <div>
                    <p className="font-heading font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {s.email}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.roles
                        .filter((r) => r !== "council_advisor")
                        .map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px]">
                            {ROLE_LABELS[r] || r}
                          </Badge>
                        ))}
                      {isAdvisor && (
                        <Badge className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/30">
                          <Landmark className="h-3 w-3" /> אחראית מועצה
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isAdvisor ? "outline" : "secondary"}
                    disabled={busyId === s.id}
                    onClick={() => (isAdvisor ? revokeAdvisor(s.id) : grantAdvisor(s.id))}
                  >
                    {isAdvisor ? "בטל מינוי" : "מנה כאחראית מועצה"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">לא נמצאו אנשי צוות</p>}
        </div>
      )}
    </motion.div>
  );
};

export default TeamRolesPage;
