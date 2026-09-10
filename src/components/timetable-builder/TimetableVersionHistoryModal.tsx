import { useEffect, useState } from "react";
import { History, X, RotateCcw, Share2, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UserProfile } from "@/hooks/useAuth";
import type { GeneratedSlot } from "@/lib/timetableGenerator";
import TimetableShareModal from "@/components/timetable-builder/TimetableShareModal";

interface VersionRow {
  id: string;
  name: string;
  description: string | null;
  slots: GeneratedSlot[];
  is_published: boolean;
  created_at: string;
  created_by: string;
}

interface Props {
  schoolId: string;
  profile: UserProfile;
  onRestore: (slots: GeneratedSlot[]) => void;
  onClose: () => void;
}

// Same list + preview + restore shape as the documents editor's
// VersionHistoryModal.tsx, adapted to timetable_versions (a normal table,
// not a jsonb column on a parent row) with share/delete added alongside restore.
const TimetableVersionHistoryModal = ({ schoolId, profile, onRestore, onClose }: Props) => {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("timetable_versions")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    setVersions((data || []) as unknown as VersionRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("timetable_versions").delete().eq("id", id);
    if (!error) setVersions(vs => vs.filter(v => v.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-lg border border-border overflow-hidden max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-heading font-bold text-sm text-foreground">
            <History className="w-4 h-4 text-primary" />
            <span>היסטוריית גרסאות מערכת השעות</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">טוען...</p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">עדיין לא נשמרו גרסאות</p>
          ) : (
            versions.map(v => (
              <div key={v.id} className="border border-border/50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-bold text-sm">{v.name}</span>
                  {v.is_published && (
                    <Badge className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> פורסמה</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground mr-auto">
                    {new Date(v.created_at).toLocaleString("he-IL")}
                  </span>
                </div>
                {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => onRestore(v.slots)}>
                    <RotateCcw className="h-3.5 w-3.5" /> שחזר גרסה זו
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setSharingId(v.id)}>
                    <Share2 className="h-3.5 w-3.5" /> שתף
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs text-destructive mr-auto" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> מחק
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {sharingId && (
        <TimetableShareModal versionId={sharingId} schoolId={schoolId} profile={profile} onClose={() => setSharingId(null)} />
      )}
    </div>
  );
};

export default TimetableVersionHistoryModal;
