import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, X, Users } from "lucide-react";
import { HEBREW_DAYS } from "@/lib/constants";
import type { SlotConflict, AlternativeSlot } from "@/lib/timetableConflicts";

interface ConflictResolutionDialogProps {
  conflict: SlotConflict;
  // Alternative (day, lesson) slots for the NEW placement itself.
  candidateAlternatives: AlternativeSlot[];
  // Alternative (day, lesson) slots for relocating the slot that was already
  // occupying the teacher instead (teacher_double_booked only).
  blockingAlternatives: AlternativeSlot[];
  // True when the blocking slot teaches the SAME subject as the new
  // placement, so "merge into one shared lesson" is a sensible offer.
  canMerge: boolean;
  onCancel: () => void;
  onMoveCandidate: (alt: AlternativeSlot) => void;
  onMoveBlocking: (alt: AlternativeSlot) => void;
  onMerge: () => void;
}

// Shown instead of silently saving whenever a manual edit in
// GeneratedTimetablePreview would violate a hard invariant (a teacher/room
// double-booking or an approved hard teacher_constraints row). For a teacher
// double-booking specifically, the coordinator gets three real choices -
// move the new lesson, move the class that was already there, or (same
// subject only) merge both classes into one shared lesson - rather than
// only ever being offered alternatives for the new placement. It never
// applies a fix on its own beyond what's explicitly picked.
const ConflictResolutionDialog = ({
  conflict, candidateAlternatives, blockingAlternatives, canMerge, onCancel, onMoveCandidate, onMoveBlocking, onMerge,
}: ConflictResolutionDialogProps) => {
  const blocking = conflict.blockingSlots?.[0];

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-heading flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> נמצאה התנגשות
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{conflict.message}</p>

        <div className="space-y-1.5">
          <p className="text-xs font-heading font-bold">אפשרות 1: העבירו את השיעור הזה לשעה אחרת</p>
          {candidateAlternatives.length === 0 ? (
            <p className="text-xs text-muted-foreground">לא נמצאה שעה חלופית פנויה לכיתה זו.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {candidateAlternatives.map((alt, i) => (
                <Button key={i} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onMoveCandidate(alt)}>
                  {HEBREW_DAYS[alt.day]}, שיעור {alt.lesson}
                </Button>
              ))}
            </div>
          )}
        </div>

        {blocking && (
          <div className="space-y-1.5">
            <p className="text-xs font-heading font-bold">
              אפשרות 2: העבירו את {blocking.subject} שכבר משובץ/ת שם לשעה אחרת (השיעור הזה יישאר במקומו)
            </p>
            {blockingAlternatives.length === 0 ? (
              <p className="text-xs text-muted-foreground">לא נמצאה שעה חלופית פנויה לכיתה שכבר משובצת שם.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {blockingAlternatives.map((alt, i) => (
                  <Button key={i} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onMoveBlocking(alt)}>
                    {HEBREW_DAYS[alt.day]}, שיעור {alt.lesson}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {canMerge && (
          <div className="space-y-1.5">
            <p className="text-xs font-heading font-bold">אפשרות 3: מזגו לשיעור משותף</p>
            <p className="text-xs text-muted-foreground">
              שתי הכיתות לומדות אותו מקצוע - אפשר לחבר אותן לשיעור אחד משותף באותה שעה, עם אותו מורה וחדר, במקום להזיז מישהו.
            </p>
            <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={onMerge}>
              <Users className="h-3.5 w-3.5" /> חבר לשיעור משותף
            </Button>
          </div>
        )}

        {candidateAlternatives.length === 0 && blockingAlternatives.length === 0 && !canMerge && (
          <p className="text-xs text-muted-foreground">לא נמצאה אף אפשרות זמינה - יש לבטל את השינוי או לשנות משהו בשכבה/כיתה אחרת.</p>
        )}

        <Button size="sm" variant="ghost" onClick={onCancel}>בטל שינוי</Button>
      </CardContent>
    </Card>
  );
};

export default ConflictResolutionDialog;
