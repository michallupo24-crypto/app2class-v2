import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock } from "lucide-react";
import { HEBREW_DAYS } from "@/lib/constants";

// Keyed by "after lesson N" (1..lessonCount-1). A gap missing from the map
// means no break there; present means a break of that many minutes.
type BreaksByGap = Record<number, number>;

interface ComputedRow {
  lesson_number: number;
  label: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  break_duration_minutes: number | null;
}

interface BellScheduleSetupProps {
  schoolId: string;
}

const SCHOOL_DAY_OPTIONS = [0, 1, 2, 3, 4, 5]; // Sun-Fri; Sat (6) never offered as a school day

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (m: number): string => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const buildSchedule = (
  dailyStart: string,
  lessonDuration: number,
  lessonCount: number,
  breaksByGap: BreaksByGap,
  hasZeroHour: boolean,
  zeroHourDuration: number
): ComputedRow[] => {
  const rows: ComputedRow[] = [];
  // שעת אפס gets lesson_number 0, ending exactly where lesson 1 starts, and
  // isn't part of the seq/lessonCount sequence below - it's an optional extra
  // period before the regular day, not counted toward lessonCount.
  if (hasZeroHour) {
    const start = timeToMinutes(dailyStart) - zeroHourDuration;
    rows.push({
      lesson_number: 0,
      label: "שעת אפס",
      start_time: minutesToTime(start),
      end_time: dailyStart,
      is_break: false,
      break_duration_minutes: null,
    });
  }
  let cursor = timeToMinutes(dailyStart);
  let seq = 1;
  for (let lessonNum = 1; lessonNum <= lessonCount; lessonNum++) {
    const start = cursor;
    const end = cursor + lessonDuration;
    rows.push({
      lesson_number: seq++,
      label: `שיעור ${lessonNum}`,
      start_time: minutesToTime(start),
      end_time: minutesToTime(end),
      is_break: false,
      break_duration_minutes: null,
    });
    cursor = end;

    const durationMinutes = breaksByGap[lessonNum];
    if (durationMinutes && lessonNum < lessonCount) {
      const bStart = cursor;
      const bEnd = cursor + durationMinutes;
      rows.push({
        lesson_number: seq++,
        label: "הפסקה",
        start_time: minutesToTime(bStart),
        end_time: minutesToTime(bEnd),
        is_break: true,
        break_duration_minutes: durationMinutes,
      });
      cursor = bEnd;
    }
  }
  return rows;
};

const BellScheduleSetup = ({ schoolId }: BellScheduleSetupProps) => {
  const { toast } = useToast();
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [dailyStart, setDailyStart] = useState("08:00");
  const [lessonDuration, setLessonDuration] = useState(45);
  const [lessonCount, setLessonCount] = useState(8);
  const [breaksByGap, setBreaksByGap] = useState<BreaksByGap>({ 4: 20 });
  const [hasZeroHour, setHasZeroHour] = useState(false);
  const [zeroHourDuration, setZeroHourDuration] = useState(45);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [bellRes, settingsRes] = await Promise.all([
      supabase.from("bell_schedule").select("*").eq("school_id", schoolId).order("lesson_number"),
      supabase.from("school_timetable_settings").select("days_of_week").eq("school_id", schoolId).maybeSingle(),
    ]);

    if (bellRes.data?.length) {
      const sorted = [...bellRes.data].sort((a: any, b: any) => a.lesson_number - b.lesson_number);
      const zeroRow = sorted.find((r: any) => !r.is_break && r.lesson_number === 0);
      if (zeroRow) {
        setHasZeroHour(true);
        setZeroHourDuration(
          timeToMinutes(zeroRow.end_time?.slice(0, 5)) - timeToMinutes(zeroRow.start_time?.slice(0, 5)) || 45
        );
      } else {
        setHasZeroHour(false);
      }
      const nonBreak = sorted.filter((r: any) => !r.is_break && r.lesson_number >= 1);
      if (nonBreak.length > 0) {
        setDailyStart(nonBreak[0].start_time?.slice(0, 5) || "08:00");
        setLessonDuration(timeToMinutes(nonBreak[0].end_time?.slice(0, 5)) - timeToMinutes(nonBreak[0].start_time?.slice(0, 5)) || 45);
        setLessonCount(nonBreak.length);
      }
      // Reconstruct which lesson each break follows, from the saved sequential order.
      const reconstructed: BreaksByGap = {};
      let lessonsSeen = 0;
      for (const row of sorted) {
        if (row.lesson_number === 0 && !row.is_break) continue; // שעת אפס isn't part of the gap sequence
        if (!row.is_break) {
          lessonsSeen++;
        } else {
          reconstructed[lessonsSeen] = row.break_duration_minutes
            || (timeToMinutes(row.end_time?.slice(0, 5)) - timeToMinutes(row.start_time?.slice(0, 5)));
        }
      }
      setBreaksByGap(reconstructed);
    }
    if (settingsRes.data?.days_of_week?.length) setDays(settingsRes.data.days_of_week);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const preview = useMemo(
    () => buildSchedule(dailyStart, lessonDuration, lessonCount, breaksByGap, hasZeroHour, zeroHourDuration),
    [dailyStart, lessonDuration, lessonCount, breaksByGap, hasZeroHour, zeroHourDuration]
  );

  const toggleDay = (day: number) => {
    setDays(d => d.includes(day) ? d.filter(x => x !== day) : [...d, day].sort());
  };

  const toggleGapBreak = (gap: number) => {
    setBreaksByGap(b => {
      if (gap in b) {
        const { [gap]: _removed, ...rest } = b;
        return rest;
      }
      return { ...b, [gap]: 15 };
    });
  };

  const updateGapDuration = (gap: number, durationMinutes: number) => {
    setBreaksByGap(b => ({ ...b, [gap]: durationMinutes }));
  };

  const handleSave = async () => {
    if (days.length === 0) {
      toast({ title: "יש לבחור לפחות יום לימודים אחד", variant: "destructive" });
      return;
    }
    if (lessonCount < 1 || lessonDuration < 1) {
      toast({ title: "יש להזין מספר שיעורים ואורך שיעור תקינים", variant: "destructive" });
      return;
    }
    if (hasZeroHour && zeroHourDuration < 1) {
      toast({ title: "יש להזין אורך תקין לשעת האפס", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { error: delError } = await supabase.from("bell_schedule").delete().eq("school_id", schoolId);
    if (delError) {
      toast({ title: "שגיאה בשמירה", description: delError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const { error: insError } = await supabase.from("bell_schedule").insert(
      preview.map(r => ({
        school_id: schoolId,
        lesson_number: r.lesson_number,
        label: r.label,
        start_time: r.start_time,
        end_time: r.end_time,
        is_break: r.is_break,
        break_duration_minutes: r.break_duration_minutes,
      }))
    );
    if (insError) {
      toast({ title: "שגיאה בשמירה", description: insError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const { error: settingsError } = await supabase.from("school_timetable_settings").upsert({
      school_id: schoolId,
      days_of_week: days,
      updated_at: new Date().toISOString(),
    });
    if (settingsError) {
      toast({ title: "שגיאה בשמירת ימי הלימוד", description: settingsError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    toast({ title: "יום הלימודים נשמר בהצלחה" });
    setSaving(false);
    loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            ימי לימוד
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {SCHOOL_DAY_OPTIONS.map(d => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={days.includes(d)} onCheckedChange={() => toggleDay(d)} />
              <span className="text-sm">{HEBREW_DAYS[d]}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">מבנה יום הלימודים</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">שעת התחלה יומית</Label>
            <Input type="time" className="w-32" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">אורך שיעור (דקות)</Label>
            <Input
              type="number"
              className="w-28"
              value={lessonDuration}
              onChange={(e) => setLessonDuration(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">כמות שיעורים ביום</Label>
            <Input
              type="number"
              className="w-28"
              value={lessonCount}
              onChange={(e) => setLessonCount(parseInt(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">שעת אפס</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={hasZeroHour} onCheckedChange={(v) => setHasZeroHour(!!v)} />
            <span className="text-sm">יש שעת אפס (שיעור נוסף לפני שיעור 1)</span>
          </label>
          {hasZeroHour && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">אורך שעת אפס (דקות)</Label>
              <Input
                type="number"
                className="w-28"
                value={zeroHourDuration}
                onChange={(e) => setZeroHourDuration(parseInt(e.target.value) || 0)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">הפסקות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lessonCount < 2 ? (
            <p className="text-sm text-muted-foreground">יש להזין לפחות 2 שיעורים כדי להגדיר הפסקות</p>
          ) : (
            Array.from({ length: lessonCount - 1 }, (_, i) => i + 1).map(gap => {
              const hasBreak = gap in breaksByGap;
              return (
                <div key={gap} className={`flex items-center gap-3 p-2 rounded-lg ${hasBreak ? "bg-warning/10" : "bg-muted/30"}`}>
                  <span className="text-sm w-24 shrink-0">אחרי שיעור {gap}</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={!hasBreak} onCheckedChange={() => toggleGapBreak(gap)} />
                    <span className="text-xs text-muted-foreground">אין הפסקה</span>
                  </label>
                  {hasBreak && (
                    <>
                      <Input
                        type="number"
                        className="w-24"
                        value={breaksByGap[gap]}
                        onChange={(e) => updateGapDuration(gap, parseInt(e.target.value) || 0)}
                      />
                      <span className="text-xs text-muted-foreground">דקות</span>
                    </>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">תצוגה מקדימה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {preview.map(row => (
            <div key={row.lesson_number} className={`flex items-center justify-between text-sm px-3 py-1.5 rounded-lg ${row.is_break ? "bg-warning/10" : "bg-muted/30"}`}>
              <span>{row.label}</span>
              <span className="text-muted-foreground text-xs">{row.start_time} – {row.end_time}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "שומר..." : "שמור יום לימודים"}
      </Button>
    </div>
  );
};

export default BellScheduleSetup;
