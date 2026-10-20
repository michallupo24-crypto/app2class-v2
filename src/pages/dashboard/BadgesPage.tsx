import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PillSwitch } from "@/components/home/HomeKit";
import { useGamification } from "@/hooks/useGamification";
import type { UserProfile } from "@/hooks/useAuth";
import { BADGE_ART, BADGE_STICKER } from "@/lib/badgeArt";
import { cn } from "@/lib/utils";

type Cat = "onboarding" | "behavior" | "academic" | "streak" | "community" | "status" | "attendance";
const CAT_LABEL: Record<Cat, string> = {
  onboarding: "הצטרפות", behavior: "התנהגות", academic: "לימודים", streak: "רצפים",
  community: "קהילה", status: "מעמד", attendance: "נוכחות",
};

// The badges the app awards (useGamification / check_and_award_badge), with
// the mockup's artwork for each.
const ALL_BADGE_TYPES: { key: string; art: string; title: string; description: string; category: Cat }[] = [
  { key: "pioneer", art: "pioneer", title: "החלוץ", description: "התחברת לראשונה ל-App2Class.", category: "onboarding" },
  { key: "first_positive", art: "first_positive", title: "כוכב התנהגות", description: "קיבלת הערכה חיובית ראשונה ממורה.", category: "behavior" },
  { key: "five_above_80", art: "five_above_80", title: "רצף מצוינות", description: "חמישה ציונים רצופים מעל 80.", category: "academic" },
  { key: "streak_7", art: "streak_7", title: "שבוע רצוף", description: "7 ימים רצופים במערכת.", category: "streak" },
  { key: "streak_30", art: "streak_30", title: "חודש רצוף", description: "30 ימים רצופים במערכת.", category: "streak" },
  { key: "community_helper", art: "community_helper", title: "עוזר/ת קהילתי/ת", description: "עזרת לחברים בפורום הפלג.", category: "community" },
  { key: "faction_guardian", art: "faction_guardian", title: "נאמן/ת פלג", description: "מדד האמינות שלך הגיע ל-90.", category: "status" },
  { key: "perfect_score", art: "perfect", title: "מצוינות מושלמת", description: "קיבלת 100.", category: "academic" },
  { key: "early_bird", art: "early_bird", title: "הציפור המקדימה", description: "הגשת מטלה 3 ימים לפני הדדליין.", category: "academic" },
  { key: "ai_explorer", art: "curious", title: "חוקר/ת AI", description: "השתמשת בתובנות המנטור החכם.", category: "onboarding" },
  { key: "perfect_attendance", art: "perfect_attendance", title: "נוכחות מושלמת", description: "אין לך אף חיסור לא מוצדק.", category: "attendance" },
];

type Filter = "all" | "earned" | "locked" | "streak" | "academic";

/** A badge drawn as a sticker; locked badges are a dashed outline with a lock. */
function BadgeSticker({ art, locked }: { art: string; locked: boolean }) {
  const ic = BADGE_ART[art];
  if (!ic) return null;
  const [m, d, l] = BADGE_STICKER[art];
  const pal: Record<string, string> = { m, d, l };
  const col = (v: unknown) => (typeof v === "string" && v !== "none" ? pal[v] || v : v);
  const draw = (list: [string, Record<string, any>][], key: string, mode: "rim" | "locked" | "fill") =>
    list.map(([tag, a], k) => {
      const { fill, stroke, t, fs, strokeWidth, ...rest } = a;
      let props: Record<string, unknown> = { key: key + k, ...rest, fill: col(fill), stroke: col(stroke), strokeWidth };
      if (mode === "rim") props = { ...props, fill: fill === "none" ? "none" : "#fff", stroke: "#fff", strokeWidth: (Number(strokeWidth) || 0) + 13, strokeLinejoin: "round", strokeLinecap: "round" };
      if (mode === "locked") props = { ...props, fill: fill === "none" ? "none" : "#E6E9EE", stroke: "#B5BCC8", strokeWidth: Number(strokeWidth) || 2.5, strokeDasharray: "5 4", strokeLinejoin: "round" };
      if (tag === "text") return <text {...props} textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight={900} fontSize={fs}>{t}</text>;
      const Tag = tag as "path";
      return <Tag {...(props as React.SVGProps<SVGPathElement>)} />;
    });
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true"
      style={{ display: "block", overflow: "visible", filter: locked ? undefined : "drop-shadow(0 3px 3px rgba(27,35,51,.22))" }}>
      {locked ? (
        <>
          <g>{draw(ic.sil, "o", "locked")}</g>
          <g transform="translate(64 64)">
            <circle cx={14} cy={14} r={14} fill="#1B2333" stroke="#fff" strokeWidth={3} />
            <rect x={8.5} y={13} width={11} height={9} rx={1.8} fill="#fff" />
            <path d="M10.8 13V10.5a3.2 3.2 0 0 1 6.4 0V13" fill="none" stroke="#fff" strokeWidth={2.2} />
          </g>
        </>
      ) : (
        <>
          <g>{draw(ic.sil, "o", "rim")}</g>
          <g>{draw(ic.sil, "s", "fill")}</g>
          <g>{draw(ic.det, "d", "fill")}</g>
        </>
      )}
    </svg>
  );
}

const BadgesPage = () => {
  const { profile } = useOutletContext<{ profile: UserProfile }>();
  const { badges, streak, reliability, loading } = useGamification(profile.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const earnedBy = new Map(badges.map((b) => [b.badge_key, b]));
  const currentStreak = streak?.current_streak || 0;
  const reliabilityScore = reliability?.score || 0;

  // Progress toward a locked badge, where the app tracks it.
  const progressOf = (key: string): { now: number; goal: number; label: string } | null => {
    if (key === "streak_7") return { now: Math.min(currentStreak, 7), goal: 7, label: "ימים ברצף" };
    if (key === "streak_30") return { now: Math.min(currentStreak, 30), goal: 30, label: "ימים ברצף" };
    if (key === "faction_guardian") return { now: Math.min(reliabilityScore, 90), goal: 90, label: "מדד אמינות" };
    return null;
  };

  const earnedCount = ALL_BADGE_TYPES.filter((b) => earnedBy.has(b.key)).length;
  const total = ALL_BADGE_TYPES.length;
  const recent = [...badges].sort((a, b) => b.earned_at.localeCompare(a.earned_at))
    .map((b) => ALL_BADGE_TYPES.find((t) => t.key === b.badge_key)).filter(Boolean).slice(0, 3) as typeof ALL_BADGE_TYPES;
  const closest = ALL_BADGE_TYPES.filter((b) => !earnedBy.has(b.key))
    .map((b) => ({ b, p: progressOf(b.key) })).filter((x) => x.p && x.p.now < x.p.goal)
    .sort((x, y) => (y.p!.now / y.p!.goal) - (x.p!.now / x.p!.goal))[0];
  const nextLine = closest
    ? `עוד ${closest.p!.goal - closest.p!.now} ${closest.p!.label} ותקבל/י את "${closest.b.title}"`
    : earnedCount === total ? "אספת את כל התגים. אלופ/ה!" : "כל יום במערכת מקרב אותך לתג הבא";

  const shown = ALL_BADGE_TYPES.filter((b) =>
    filter === "all" ? true : filter === "earned" ? earnedBy.has(b.key) : filter === "locked" ? !earnedBy.has(b.key) : b.category === filter
  );
  const sel = selected ? ALL_BADGE_TYPES.find((b) => b.key === selected) : null;
  const selEarned = sel ? earnedBy.get(sel.key) : undefined;
  const selProgress = sel && !selEarned ? progressOf(sel.key) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-3xl flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="font-heading text-[28px] font-black leading-tight">אוסף התגים שלי</h1>
        <p className="font-body text-sm font-semibold text-muted-foreground">לחיצה על תג פותחת את הפרטים שלו</p>
      </div>

      {/* Collected so far */}
      <div className="flex flex-col gap-4 rounded-card bg-[#10182A] p-[22px] text-white shadow-raised">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-body text-[13px] font-bold tracking-wide text-[#FBBE24]">נאספו עד עכשיו</div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="font-heading text-[52px] font-black leading-none">{earnedCount}</span>
              <span className="font-heading text-xl font-bold leading-none text-[#8A93A5]">/ {total}</span>
            </div>
          </div>
          <div className="flex flex-row-reverse">
            {recent.map((b) => (
              <div key={b.key} className="-mr-2 h-[42px] w-[42px]"><BadgeSticker art={b.art} locked={false} /></div>
            ))}
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded bg-[#262F45]">
          <div className="h-full rounded bg-[#FBBE24]" style={{ width: `${Math.round((earnedCount / total) * 100)}%` }} />
        </div>
        <div className="font-body text-sm font-semibold leading-snug text-[#B7C0D4]">{nextLine}</div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <PillSwitch<Filter>
          options={[{ value: "all", label: "הכל" }, { value: "earned", label: "נאספו" }, { value: "locked", label: "בדרך" }, { value: "streak", label: "רצפים" }, { value: "academic", label: "לימודים" }]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {shown.map((b) => {
          const earned = earnedBy.get(b.key);
          const p = !earned ? progressOf(b.key) : null;
          return (
            <button key={b.key} type="button" onClick={() => setSelected(b.key)}
              className="flex flex-col items-center gap-2.5 rounded-[18px] bg-card px-2 pb-3.5 pt-4 shadow-card transition-transform hover:-translate-y-0.5">
              <div className="h-[76px] w-[76px]"><BadgeSticker art={b.art} locked={!earned} /></div>
              <span className="text-center font-body text-[13.5px] font-extrabold leading-tight text-foreground">{b.title}</span>
              <span className={cn("font-body text-[11.5px] font-semibold leading-none", earned ? "text-hint" : "text-link")}>
                {earned ? new Date(earned.earned_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" }) : p ? `${p.now} / ${p.goal}` : "עוד לא"}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm items-center text-center">
          {sel && (
            <div className="flex flex-col items-center gap-3.5">
              <div className="mt-2 h-[132px] w-[132px]"><BadgeSticker art={sel.art} locked={!selEarned} /></div>
              <span className="rounded-full bg-muted px-3 py-1.5 font-body text-xs font-bold text-text-secondary">{CAT_LABEL[sel.category]}</span>
              <DialogTitle className="font-heading text-[28px] font-black leading-tight">{sel.title}</DialogTitle>
              <p className="max-w-[300px] font-body text-base font-semibold leading-relaxed text-text-secondary">{sel.description}</p>
              {selEarned ? (
                <div className="w-full rounded-[14px] bg-soft p-3">
                  <div className="font-body text-xs font-semibold text-muted-foreground">התקבל</div>
                  <div className="mt-2 font-heading text-[15px] font-extrabold">{new Date(selEarned.earned_at).toLocaleDateString("he-IL")}</div>
                </div>
              ) : selProgress ? (
                <div className="flex w-full flex-col gap-2">
                  <div className="flex justify-between font-body text-[13px] font-bold text-text-secondary">
                    <span>{selProgress.label}</span><span dir="ltr">{selProgress.now} / {selProgress.goal}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-[5px] bg-muted">
                    <div className="h-full rounded-[5px] bg-link" style={{ width: `${Math.round((selProgress.now / selProgress.goal) * 100)}%` }} />
                  </div>
                </div>
              ) : (
                <p className="font-body text-[13px] font-bold text-hint">התג עוד לא נאסף</p>
              )}
              <button type="button" onClick={() => setSelected(null)} className="mt-1 w-full rounded-[14px] bg-primary p-4 font-body text-base font-extrabold text-primary-foreground">סגירה</button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default BadgesPage;
