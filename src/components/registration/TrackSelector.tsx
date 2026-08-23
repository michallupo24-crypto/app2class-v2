import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export interface TrackSelection {
  megamot: { clusterName: string; subject: string }[];
  hakbatzot: { baseSubject: string; subject: string }[];
}

export const EMPTY_TRACK_SELECTION: TrackSelection = { megamot: [], hakbatzot: [] };

interface MegamaCluster {
  clusterName: string;
  options: string[];
}

interface HakbatzaGroup {
  baseSubject: string;
  levels: string[]; // full "<subject> (<level>)" strings, as stored in subject
}

interface TrackSelectorProps {
  grade: string;
  schoolId: string;
  value: TrackSelection;
  onChange: (v: TrackSelection) => void;
}

// Runs with no session yet (registration signs up only at its final step),
// so this reads subject_requirements via the anon-accessible track-offerings
// policy - only rows with track_group set, scoped to this school+grade -
// showing exactly what the coordinator configured in the Timetable Builder's
// "מגמות ואשכולות בחירה" / "הקבצות" editor instead of a hardcoded national list.
const TrackSelector = ({ grade, schoolId, value, onChange }: TrackSelectorProps) => {
  const [clusters, setClusters] = useState<MegamaCluster[]>([]);
  const [hakbatzaGroups, setHakbatzaGroups] = useState<HakbatzaGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId || !grade) {
      setClusters([]);
      setHakbatzaGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("subject_requirements")
      .select("subject, track_group, track_kind, base_subject")
      .eq("school_id", schoolId)
      .eq("grade", grade)
      .not("track_group", "is", null)
      .then(({ data }) => {
        const rows = (data || []) as { subject: string; track_group: string; track_kind: string | null; base_subject: string | null }[];

        const clusterMap = new Map<string, string[]>();
        const hakbatzaMap = new Map<string, string[]>();
        for (const r of rows) {
          if (r.track_kind === "hakbatza" && r.base_subject) {
            if (!hakbatzaMap.has(r.base_subject)) hakbatzaMap.set(r.base_subject, []);
            hakbatzaMap.get(r.base_subject)!.push(r.subject);
          } else {
            if (!clusterMap.has(r.track_group)) clusterMap.set(r.track_group, []);
            clusterMap.get(r.track_group)!.push(r.subject);
          }
        }
        setClusters(Array.from(clusterMap.entries()).map(([clusterName, options]) => ({ clusterName, options })));
        setHakbatzaGroups(Array.from(hakbatzaMap.entries()).map(([baseSubject, levels]) => ({ baseSubject, levels })));
        setLoading(false);
      });
  }, [schoolId, grade]);

  const isHighSchool = ["י", "יא", "יב"].includes(grade);
  if (!isHighSchool) return null;
  if (loading) return <p className="text-sm text-muted-foreground">טוען מגמות והקבצות...</p>;
  if (clusters.length === 0 && hakbatzaGroups.length === 0) {
    return <p className="text-sm text-muted-foreground">בית הספר טרם הגדיר מגמות או הקבצות לשכבה זו.</p>;
  }

  const toggleMegama = (clusterName: string, subject: string) => {
    const current = value.megamot.find(m => m.clusterName === clusterName);
    const megamot = value.megamot.filter(m => m.clusterName !== clusterName);
    if (current?.subject !== subject) megamot.push({ clusterName, subject });
    onChange({ ...value, megamot });
  };

  const setHakbatza = (baseSubject: string, subject: string) => {
    const hakbatzot = [...value.hakbatzot.filter(h => h.baseSubject !== baseSubject), { baseSubject, subject }];
    onChange({ ...value, hakbatzot });
  };

  return (
    <div className="space-y-5">
      <div className="bg-info/5 border border-info/20 rounded-xl p-3">
        <p className="text-xs text-info font-heading font-medium">
          ℹ️ המידע הזה עובר אישור של המחנך/ת שלך - אנא מלא/י בדיוק
        </p>
      </div>

      {clusters.map(cluster => {
        const selected = value.megamot.find(m => m.clusterName === cluster.clusterName)?.subject;
        return (
          <div key={cluster.clusterName} className="space-y-2">
            <Label className="font-heading text-sm">{cluster.clusterName} - בחר מגמה אחת</Label>
            <div className="flex flex-wrap gap-2">
              {cluster.options.map(subject => (
                <Badge
                  key={subject}
                  variant={selected === subject ? "default" : "outline"}
                  className="cursor-pointer text-xs py-1 px-3 transition-all hover:scale-105"
                  onClick={() => toggleMegama(cluster.clusterName, subject)}
                >
                  {selected === subject ? "✓ " : ""}{subject}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}

      {hakbatzaGroups.length > 0 && (
        <div className="space-y-3">
          <Label className="font-heading">הקבצות (רמת לימוד)</Label>
          {hakbatzaGroups.map(group => {
            const selected = value.hakbatzot.find(h => h.baseSubject === group.baseSubject)?.subject;
            return (
              <div key={group.baseSubject} className="space-y-1.5">
                <span className="text-sm font-body">{group.baseSubject}</span>
                <div className="flex flex-wrap gap-2">
                  {group.levels.map(subject => (
                    <Badge
                      key={subject}
                      variant={selected === subject ? "default" : "outline"}
                      className="cursor-pointer text-xs py-1 px-3 transition-all hover:scale-105"
                      onClick={() => setHakbatza(group.baseSubject, subject)}
                    >
                      {selected === subject ? "✓ " : ""}{subject}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrackSelector;
