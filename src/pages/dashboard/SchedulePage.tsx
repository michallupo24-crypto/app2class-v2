import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import type { UserProfile } from "@/hooks/useAuth";
import DailyTimetable from "@/components/schedule/DailyTimetable";
import MonthlyCalendar from "@/components/schedule/MonthlyCalendar";
import YearlyOverview from "@/components/schedule/YearlyOverview";
import TeacherAttendanceWidget from "@/components/schedule/TeacherAttendanceWidget";
import { CalendarDays } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Mode = "day" | "week" | "month" | "year";

// Header per the Timetable v2 mockup: title and week line on one side, the
// day/week pills on the other. Month and year (the app's exam/holiday
// calendars, not in the mockup) sit behind one small calendar pill so the row
// stays as in the design.
const MODES: { value: Mode; label: string }[] = [
  { value: "day", label: "יום" },
  { value: "week", label: "שבוע" },
];
const PILL = "rounded-full border-[2.5px] border-white font-body text-[13px] font-extrabold leading-none transition-transform dark:border-card";
const PILL_ON = "bg-primary text-primary-foreground shadow-[0_5px_10px_-5px_rgba(27,35,51,0.5)]";
const PILL_OFF = "bg-card text-text-secondary shadow-[0_3px_8px_-5px_rgba(40,30,15,0.3)]";

const SchedulePage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const [mode, setMode] = useState<Mode>("day");
  const [weekLine, setWeekLine] = useState("");

  const isTeacher = profile.roles.some(r =>
    ["educator", "professional_teacher", "subject_coordinator"].includes(r)
  );
  const isTimetable = mode === "day" || mode === "week";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-[18px]">
      {/* Teacher attendance widget */}
      {isTeacher && <TeacherAttendanceWidget profile={profile} />}

      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-col gap-[5px]">
          <h1 className="font-heading text-[27px] font-black leading-[1.05] text-foreground">מערכת שעות</h1>
          <p className="font-body text-[13px] font-semibold leading-snug text-muted-foreground">
            {isTimetable ? weekLine : mode === "month" ? "לוח חודשי · מבחנים וחופשות" : "סקירה שנתית"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {MODES.map((m, i) => {
            const on = m.value === mode;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                aria-pressed={on}
                className={cn(PILL, "px-[15px] py-[9px]", on ? PILL_ON : PILL_OFF)}
              >
                {m.label}
              </button>
            );
          })}
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="לוח חודשי ושנתי"
                className={cn(PILL, "grid h-[37px] w-[37px] place-items-center", isTimetable ? PILL_OFF : PILL_ON)}
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setMode("month")}>לוח חודשי</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMode("year")}>סקירה שנתית</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isTimetable && (
        <DailyTimetable
          profile={profile}
          view={mode as "day" | "week"}
          onViewChange={setMode}
          onSubtitle={setWeekLine}
        />
      )}
      {mode === "month" && <MonthlyCalendar profile={profile} />}
      {mode === "year" && <YearlyOverview profile={profile} />}
    </motion.div>
  );
};

export default SchedulePage;
