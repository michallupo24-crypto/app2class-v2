import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import type { UserProfile } from "@/hooks/useAuth";
import DisplayNamesManager from "@/components/display-name/DisplayNamesManager";
import { canManageDisplayNames } from "@/lib/displayName";

/* Stand-alone screen for display names, for grade coordinators (management
   has the same manager as a tab in school settings). */
const DisplayNamesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4 pb-24">
      <h1 className="px-1 font-heading text-[27px] font-black leading-[1.05]">שמות תצוגה</h1>
      <div className="rounded-card bg-card p-4 shadow-card md:p-5">
        {canManageDisplayNames(profile.roles)
          ? <DisplayNamesManager profile={profile} />
          : <p className="font-body text-sm text-muted-foreground">רק הנהלת בית הספר ורכזי השכבה יכולים לקבוע שמות תצוגה.</p>}
      </div>
    </motion.div>
  );
};

export default DisplayNamesPage;
