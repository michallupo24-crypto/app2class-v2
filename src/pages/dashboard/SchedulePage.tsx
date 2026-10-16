import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import DailyTimetable from "@/components/schedule/DailyTimetable";
import MonthlyCalendar from "@/components/schedule/MonthlyCalendar";
import YearlyOverview from "@/components/schedule/YearlyOverview";
import TeacherAttendanceWidget from "@/components/schedule/TeacherAttendanceWidget";

const SchedulePage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const [tab, setTab] = useState("daily");

  const isTeacher = profile.roles.some(r =>
    ["educator", "professional_teacher", "subject_coordinator"].includes(r)
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
      {/* Teacher attendance widget */}
      {isTeacher && <TeacherAttendanceWidget profile={profile} />}

      {/* Header with tabs */}
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="font-heading text-[27px] font-black leading-[1.05] text-foreground">מערכת שעות</h1>
        <p className="font-body text-sm font-semibold text-muted-foreground">השבוע שלך, לוח המבחנים והחופשות</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="daily" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            שבועי
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            חודשי
          </TabsTrigger>
          <TabsTrigger value="yearly" className="gap-1.5">
            <CalendarRange className="h-4 w-4" />
            שנתי
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <DailyTimetable profile={profile} />
        </TabsContent>

        <TabsContent value="monthly" className="mt-4">
          <MonthlyCalendar profile={profile} />
        </TabsContent>

        <TabsContent value="yearly" className="mt-4">
          <YearlyOverview profile={profile} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default SchedulePage;
