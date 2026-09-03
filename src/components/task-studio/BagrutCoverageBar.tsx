import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Loader2 } from "lucide-react";
import StudioModeWrapper from "./StudioModeWrapper";
import type { UserProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  profile: UserProfile;
  assignmentId: string | null;
  onBack: () => void;
}

interface TopicCoverage {
  topic: string;
  coverage: number;
}

const BagrutCoverageBar = ({ profile, assignmentId, onBack }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<TopicCoverage[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setTopics([]);
      if (!assignmentId) { setLoading(false); return; }

      try {
        const { data: assignment, error: assignmentError } = await supabase
          .from("assignments")
          .select("subject, class_id, classes(grade)")
          .eq("id", assignmentId)
          .maybeSingle();
        if (assignmentError) throw assignmentError;

        if (!assignment) { setLoading(false); return; }
        const cls = Array.isArray(assignment.classes) ? assignment.classes[0] : assignment.classes;
        const grade = cls?.grade;
        if (!grade) { setLoading(false); return; }

        const [{ data: syllabusTopics, error: syllabiError }, { data: classAssignments, error: classAssignmentsError }] = await Promise.all([
          supabase.from("syllabi").select("topic")
            .eq("school_id", profile.schoolId || "")
            .eq("subject", assignment.subject)
            .eq("grade", grade as any),
          supabase.from("assignments").select("id")
            .eq("class_id", assignment.class_id)
            .eq("subject", assignment.subject),
        ]);
        if (syllabiError) throw syllabiError;
        if (classAssignmentsError) throw classAssignmentsError;

        const assignmentIds = (classAssignments || []).map((a: any) => a.id);
        let tags: string[] = [];
        if (assignmentIds.length > 0) {
          const { data: questions, error: questionsError } = await supabase
            .from("task_questions")
            .select("tags")
            .in("assignment_id", assignmentIds);
          if (questionsError) throw questionsError;
          tags = (questions || []).flatMap((q: any) => q.tags || []);
        }
        const normalizedTags = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);

        const computed = (syllabusTopics || []).map((t: any) => {
          const topicKey = t.topic.trim().toLowerCase();
          const matches = normalizedTags.filter((tag) => tag.includes(topicKey) || topicKey.includes(tag));
          return { topic: t.topic, coverage: Math.min(100, matches.length * 25) };
        });

        setTopics(computed);
      } catch (err: any) {
        toast({ title: "שגיאה בחישוב חיפוי הבגרות", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assignmentId, profile.schoolId]);

  const overallCoverage = topics.length > 0
    ? Math.round(topics.reduce((sum, t) => sum + t.coverage, 0) / topics.length)
    : 0;

  return (
    <StudioModeWrapper
      title="בר הספק לבגרות"
      description="אחוז החיפוי של חומר הבגרות שהמשימות מכסות"
      icon={<Target className="h-6 w-6 text-warning" />}
      onBack={onBack}
    >
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !assignmentId ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">בחר/י מטלה כדי לראות את חיפוי הבגרות שלה</CardContent></Card>
      ) : topics.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">לא נמצא סילבוס בגרות מוגדר למקצוע/שכבה זו</CardContent></Card>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 bg-warning/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-bold">חיפוי כולל</h3>
                  <Badge className={`text-lg font-bold ${
                    overallCoverage >= 70 ? "bg-success" : overallCoverage >= 40 ? "bg-warning" : "bg-destructive"
                  } text-white border-0`}>
                    {overallCoverage}%
                  </Badge>
                </div>
                <Progress value={overallCoverage} className="h-4 rounded-full" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {topics.map((t) => (
              <Card key={t.topic}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-heading">{t.topic}</span>
                      <span className={`text-xs font-bold ${
                        t.coverage >= 70 ? "text-success" : t.coverage >= 40 ? "text-warning" : "text-destructive"
                      }`}>{t.coverage}%</span>
                    </div>
                    <Progress value={t.coverage} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-info/30 bg-info/5">
            <CardContent className="p-4 text-center">
              <p className="text-xs font-body text-info">
                הנתונים מחושבים בהתאם לתגיות הנושאים במשימות הקיימות אל מול סילבוס הבגרות
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </StudioModeWrapper>
  );
};

export default BagrutCoverageBar;
