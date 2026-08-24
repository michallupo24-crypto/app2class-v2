import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Award, Trophy, Lock, CheckCircle2, Zap, Flame, Shield
} from "lucide-react";
import { useGamification } from "@/hooks/useGamification";
import type { UserProfile } from "@/hooks/useAuth";

const ALL_BADGE_TYPES = [
  { key: "pioneer", title: "החלוץ", description: "הצטרפות ראשונית למערכת", icon: "🏴", category: "onboarding", color: "bg-secondary" },
  { key: "first_positive", title: "כוכב התנהגות", description: "קבלת הערכה חיובית ראשונה ממורה", icon: "⭐", category: "behavior", color: "bg-warning" },
  { key: "five_above_80", title: "רצף מצוינות", description: "5 ציונים מעל 80 ברצף", icon: "🏆", category: "academic", color: "bg-primary" },
  { key: "streak_7", title: "שבוע רצוף", description: "כניסה למערכת 7 ימים ברצף", icon: "🔥", category: "streak", color: "bg-destructive" },
  { key: "streak_30", title: "חודש רצוף", description: "כניסה למערכת 30 ימים ברצף", icon: "💎", category: "streak", color: "bg-info" },
  { key: "community_helper", title: "עוזר קהילתי", description: "עזרה לחברים בפורום הפלג", icon: "🌸", category: "community", color: "bg-accent" },
  { key: "faction_guardian", title: "נאמן פלג", description: "הגעה למדד אמינות של 90+", icon: "🛡️", category: "status", color: "bg-success" },
  { key: "perfect_score", title: "מצוינות מושלמת", description: "קבלת ציון 100", icon: "💯", category: "academic", color: "bg-primary" },
  { key: "early_bird", title: "הציפור המקדימה", description: "הגשת מטלה 3 ימים לפני הדדליין", icon: "🌅", category: "academic", color: "bg-warning" },
  { key: "ai_explorer", title: "חוקר AI", description: "שימוש בתובנות המנטור החכם", icon: "🤖", category: "onboarding", color: "bg-accent" },
  { key: "perfect_attendance", title: "נוכחות מושלמת", description: "אין חיסורים לא מוצדקים", icon: "🎯", category: "attendance", color: "bg-success" },
];

const BadgesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { badges, streak, reliability, loading } = useGamification(profile.id);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const earnedKeys = new Set(badges.map(b => b.badge_key));
  
  const totalBadges = badges.length;
  const activeDays = streak?.total_active_days || 0;
  const xp = (activeDays * 10) + (totalBadges * 100);
  const currentLevel = Math.floor(xp / 500) + 1;
  const nextLevelXp = currentLevel * 500;
  const progressToNext = ((xp % 500) / 500) * 100;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8 text-right" dir="rtl">
      <motion.div variants={item}>
        <h1 className="text-3xl font-heading font-black flex items-center gap-3">
          <Trophy className="h-8 w-8 text-warning" />היכל ההישגים
        </h1>
        <p className="text-muted-foreground mt-2">הדרך להצטיינות מרוצפת במעשים קטנים ומתמידים</p>
      </motion.div>

      <motion.div variants={item}>
        <Card className="relative overflow-hidden border border-border bg-card">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="relative">
                <div className="h-32 w-32 rounded-full border-4 border-primary/20 flex items-center justify-center bg-background relative z-10">
                  <span className="text-5xl font-heading font-black text-primary">{currentLevel}</span>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold z-20">LEVEL</div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-2xl font-heading font-bold">{profile.fullName}</h2>
                    <p className="text-muted-foreground text-sm flex items-center gap-1.5"><Zap className="h-3 w-3 text-warning fill-warning" />{xp} XP</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground font-bold italic tracking-tighter">הרמה הבאה: {currentLevel + 1}</p>
                  </div>
                </div>
                <Progress value={progressToNext} className="h-3 bg-primary/10" />
                <div className="flex gap-4 pt-2 overflow-x-auto pb-2">
                   <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 text-warning border border-warning/30 shrink-0"><Flame className="h-4 w-4 fill-warning" /><span className="text-xs font-bold">{streak?.current_streak || 0} ימי רצף</span></div>
                   <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-info/10 text-info border border-info/30 shrink-0"><Shield className="h-4 w-4 fill-info" /><span className="text-xs font-bold">{reliability?.score || 0} אמינות</span></div>
                   <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/30 shrink-0"><Award className="h-4 w-4 fill-accent" /><span className="text-xs font-bold">{badges.length} מדליות</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ALL_BADGE_TYPES.map((badge) => {
          const isEarned = earnedKeys.has(badge.key);
          const earnedData = badges.find(b => b.badge_key === badge.key);
          return (
            <motion.div key={badge.key} variants={item}>
              <Card className={`group transition-colors relative overflow-hidden ${!isEarned ? 'opacity-60 grayscale-[0.8]' : 'border-primary/20 hover:border-primary/40'}`}>
                {isEarned && <div className="absolute top-3 left-3"><CheckCircle2 className="h-5 w-5 text-success" /></div>}
                <CardContent className="p-6 flex gap-4">
                  <div className={`h-20 w-20 rounded-lg flex items-center justify-center text-4xl shrink-0 relative overflow-hidden ${isEarned ? badge.color : 'bg-muted'}`}>
                    <span className={!isEarned ? 'opacity-20' : ''}>{badge.icon}</span>
                    {!isEarned && <div className="absolute inset-0 flex items-center justify-center bg-background/20"><Lock className="h-8 w-8 text-muted-foreground/30" /></div>}
                  </div>
                  <div className="flex flex-col justify-center">
                    <h3 className={`font-heading font-extrabold text-lg mb-1`}>{badge.title}</h3>
                    <p className="text-xs text-muted-foreground leading-tight">{badge.description}</p>
                    {isEarned && earnedData && <p className="mt-2 text-[9px] font-black text-primary uppercase">הושג ב-{new Date(earnedData.earned_at).toLocaleDateString("he-IL")}</p>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default BadgesPage;
