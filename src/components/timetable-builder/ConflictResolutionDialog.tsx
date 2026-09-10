import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, X } from "lucide-react";
import { HEBREW_DAYS } from "@/lib/constants";
import type { SlotConflict, AlternativeSlot } from "@/lib/timetableConflicts";

interface ConflictResolutionDialogProps {
  conflict: SlotConflict;
  alternatives: AlternativeSlot[];
  onCancel: () => void;
  onChooseAlternative: (alt: AlternativeSlot) => void;
}

// Shown instead of silently saving whenever a manual edit in
// GeneratedTimetablePreview would violate a hard invariant (a teacher/room
// double-booking or an approved hard teacher_constraints row). Only offers
// "cancel" or "pick one of the valid alternatives" - it never applies a fix
// on its own, per the product decision to keep automatic conflict handling
// at "detect + list options" rather than full auto-resolution.
const ConflictResolutionDialog = ({ conflict, alternatives, onCancel, onChooseAlternative }: ConflictResolutionDialogProps) => {
  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-heading flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> נמצאה התנגשות
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{conflict.message}</p>
        {alternatives.length === 0 ? (
          <p className="text-xs text-muted-foreground">לא נמצאה שעה חלופית פנויה לאותה כיתה — יש לבטל את השינוי או לשנות משהו בשכבה/כיתה אחרת.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">אפשר להעביר את השיעור לאחת המשבצות הפנויות הבאות במקום:</p>
            <div className="flex flex-wrap gap-1.5">
              {alternatives.map((alt, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onChooseAlternative(alt)}
                >
                  {HEBREW_DAYS[alt.day]}, שיעור {alt.lesson}
                </Button>
              ))}
            </div>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onCancel}>בטל שינוי</Button>
      </CardContent>
    </Card>
  );
};

export default ConflictResolutionDialog;
