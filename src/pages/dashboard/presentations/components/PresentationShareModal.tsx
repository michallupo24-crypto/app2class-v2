import { useEffect, useState } from 'react';
import { Share2, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/hooks/useAuth';

interface ClassOption {
  classId: string;
  grade: string;
  classNumber: number;
}

interface Props {
  presentationId: string;
  profile: UserProfile;
  onClose: () => void;
}

export function PresentationShareModal({ presentationId, profile, onClose }: Props) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sharedClassIds, setSharedClassIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyClassId, setBusyClassId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('teacher_classes').select('class_id, classes(id, grade, class_number)').eq('user_id', profile.id),
      supabase.from('presentation_shares').select('class_id').eq('presentation_id', presentationId),
    ]).then(([tcRes, sharesRes]) => {
      const opts: ClassOption[] = (tcRes.data || [])
        .map((row: any) => row.classes && { classId: row.classes.id, grade: row.classes.grade, classNumber: row.classes.class_number })
        .filter(Boolean)
        .sort((a: ClassOption, b: ClassOption) => a.grade.localeCompare(b.grade) || a.classNumber - b.classNumber);
      setClasses(opts);
      setSharedClassIds(new Set((sharesRes.data || []).map((r: any) => r.class_id)));
      setLoading(false);
    });
  }, [presentationId, profile.id]);

  const toggleClass = async (classId: string) => {
    setBusyClassId(classId);
    if (sharedClassIds.has(classId)) {
      const { error } = await supabase
        .from('presentation_shares')
        .delete()
        .eq('presentation_id', presentationId)
        .eq('class_id', classId);
      if (!error) setSharedClassIds((prev) => { const next = new Set(prev); next.delete(classId); return next; });
    } else {
      const { error } = await supabase
        .from('presentation_shares')
        .insert({ presentation_id: presentationId, class_id: classId, shared_by: profile.id });
      if (!error) setSharedClassIds((prev) => new Set(prev).add(classId));
    }
    setBusyClassId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-sm border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-heading font-bold text-sm text-foreground">
            <Share2 className="w-4 h-4 text-primary" />
            <span>שיתוף עם כיתה</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">תלמידי הכיתות המסומנות יוכלו לצפות במצגת, ללא אפשרות עריכה.</p>
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">טוען...</p>
          ) : classes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">אין לך כיתות משויכות</p>
          ) : (
            classes.map((c) => {
              const isShared = sharedClassIds.has(c.classId);
              return (
                <button
                  key={c.classId}
                  type="button"
                  onClick={() => toggleClass(c.classId)}
                  disabled={busyClassId === c.classId}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors disabled:opacity-60 ${
                    isShared ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/50 border-border hover:bg-muted'
                  }`}
                >
                  <span>כיתה {c.grade}׳{c.classNumber}</span>
                  {isShared && <Check className="w-4 h-4" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
