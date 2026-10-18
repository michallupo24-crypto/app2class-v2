// Building blocks for the role home pages (the "Home Pages" design mockup):
// a greeting, one tilted hero card in a subject/role color, and sections that
// are a lesson strip, stat tiles, bars or a list of rows.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SubjectSticker } from "@/components/SubjectSticker";

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HEB_MONTHS = ["בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני", "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"];

export const greeting = (d = new Date()) => {
  const h = d.getHours();
  return h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
};

/** "יום ראשון, 11 באוקטובר" */
export const longHebrewDate = (d = new Date()) => `יום ${HEB_DAYS[d.getDay()]}, ${d.getDate()} ${HEB_MONTHS[d.getMonth()]}`;

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;

// Status pairs: light background + dark ink. "alert" is the orange used for exams.
export type Tone = "success" | "warning" | "info" | "alert" | "danger" | "neutral" | "ink";
const TONES: Record<Tone, { bg: string; ink: string }> = {
  success: { bg: "#E3F6EC", ink: "#11734A" },
  warning: { bg: "#FFF0C2", ink: "#7A5200" },
  info: { bg: "#EAF1FE", ink: "#2F5FB8" },
  alert: { bg: "#FFE1D6", ink: "#A8320F" },
  danger: { bg: "#FDE2E2", ink: "#B42318" },
  neutral: { bg: "#F4EEE6", ink: "#6B5A44" },
  ink: { bg: "#E8EDF7", ink: "#2B3350" },
};

const AVATAR_COLORS = ["#3B7BF2", "#EE5A8F", "#9257EC", "#D98B0A", "#1E9E62", "#1592B3", "#F0602F", "#4F70C9", "#C93FA6", "#0F9393"];
const colorFor = (s: string) => AVATAR_COLORS[[...s].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export function HomeHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-[26px] font-black leading-tight text-foreground md:text-[30px]">{title}</h1>
        {subtitle && <p className="font-body text-sm font-semibold text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Pill switcher (e.g. a parent's children). */
export function PillSwitch<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border-[2.5px] border-white px-3.5 py-2 font-body text-[13.5px] font-extrabold transition-colors dark:border-card",
            o.value === value
              ? "bg-primary text-primary-foreground shadow-[0_6px_12px_-6px_rgba(27,35,51,0.55)]"
              : "bg-card text-text-secondary shadow-[0_3px_8px_-5px_rgba(40,30,15,0.35)] hover:bg-soft"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface HeroCardProps {
  color: string;
  /** Subject name for the sticker in the corner, or any custom node. */
  subject?: string;
  icon?: ReactNode;
  tag: string;
  title: string;
  meta?: string;
  action?: { label: string; onClick: () => void };
  onClick?: () => void;
  children?: ReactNode;
}

/** The big tilted card at the top of a home page - "what matters right now". */
export function HeroCard({ color, subject, icon, tag, title, meta, action, onClick, children }: HeroCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={cn(
        "relative mx-1 mt-4 flex flex-col gap-3.5 rounded-[28px] border-[6px] border-white px-[26px] pb-[22px] pt-6 text-white dark:border-card md:-rotate-[0.8deg]",
        onClick && "cursor-pointer transition-transform hover:rotate-0"
      )}
      style={{ background: color, boxShadow: `0 18px 30px -16px ${color}` }}
    >
      <div className="absolute -top-[30px] left-[22px] h-[76px] w-[76px] rotate-[7deg] md:h-[92px] md:w-[92px]">
        {icon ?? (subject ? <SubjectSticker subject={subject} size={92} className="h-full w-full" /> : null)}
      </div>
      <div className="flex flex-col gap-[9px] pl-[84px] md:pl-[100px]">
        <span className="self-start rounded-full bg-white/20 px-[11px] py-1.5 font-body text-[13px] font-extrabold">{tag}</span>
        <div className="font-heading text-[28px] font-black leading-[1.05] md:text-[36px]">{title}</div>
        {meta && <div className="font-body text-[15px] font-semibold leading-snug text-white/90 md:text-base">{meta}</div>}
      </div>
      {children}
      {action && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); action.onClick(); }}
          className="self-start rotate-[1.2deg] rounded-[13px] bg-white px-4 py-[11px] font-body text-[14.5px] font-extrabold"
          style={{ color }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function HomeSection({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="font-heading text-lg font-black leading-none text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Two-column home layout: the wider main column and the side column (stacks on mobile). */
export function HomeColumns({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid items-start gap-x-7 gap-y-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-[26px]">{main}</div>
      <div className="flex min-w-0 flex-col gap-[26px] lg:pt-4">{side}</div>
    </div>
  );
}

export interface StripLesson {
  subject: string | null;
  time: string;
  state: "past" | "now" | "upcoming";
}

/** Today's lessons as a row of subject tiles; a dashed slot is a free period. */
export function LessonStrip({ lessons, onClick }: { lessons: StripLesson[]; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn("flex gap-2.5 overflow-x-auto rounded-card bg-card px-4 py-3.5 shadow-card", onClick && "cursor-pointer")}
    >
      {lessons.map((l, i) => (
        <div key={i} className={cn("flex min-w-[44px] flex-1 flex-col items-center gap-1.5", l.state === "past" && "opacity-40")}>
          <div
            className={cn(
              "relative aspect-square w-full max-w-[56px] rounded-[14px]",
              !l.subject && "border-[1.5px] border-dashed border-[#D6CDBD]",
              l.state === "now" && "shadow-[0_0_0_2.5px_hsl(var(--foreground))]"
            )}
            title={l.subject ?? "חלון"}
          >
            {l.subject && (
              <div className="absolute -inset-px">
                <SubjectSticker subject={l.subject} flat size={58} className="h-full w-full" />
              </div>
            )}
          </div>
          <div className="font-body text-[11.5px] font-bold text-hint" dir="ltr">{l.time}</div>
        </div>
      ))}
    </div>
  );
}

export interface StatItem {
  value: string | number;
  label: string;
  tone: Tone;
}

/** Colored stat tiles, slightly tilted like stickers. */
export function StatTiles({ items, size = "md" }: { items: StatItem[]; size?: "md" | "sm" }) {
  const tilts = ["-rotate-2", "rotate-2", "-rotate-1"];
  return (
    <div className="grid grid-cols-3 gap-2.5 md:gap-3">
      {items.map((s, i) => {
        const t = TONES[s.tone];
        return (
          <div
            key={s.label}
            className={cn("flex flex-col gap-2 rounded-[20px] border-[3px] border-white shadow-[0_8px_16px_-11px_rgba(40,30,15,0.45)] dark:border-card", tilts[i % 3], size === "md" ? "p-4" : "p-3.5")}
            style={{ background: t.bg, color: t.ink }}
          >
            <div className={cn("font-heading font-black leading-none", size === "md" ? "text-[30px]" : "text-[26px]")}>{s.value}</div>
            <div className={cn("font-body font-extrabold leading-tight", size === "md" ? "text-[13.5px]" : "text-[12.5px]")}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal bars (attendance per class etc.); values under `threshold` turn orange. */
export function BarList({ items, threshold = 91, unit = "%" }: { items: { label: string; value: number }[]; threshold?: number; unit?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-[18px] shadow-card">
      {items.map((b) => {
        const low = b.value < threshold;
        return (
          <div key={b.label} className="flex items-center gap-3">
            <div className="w-12 shrink-0 font-heading text-sm font-extrabold text-foreground">{b.label}</div>
            <div className="h-3.5 flex-1 overflow-hidden rounded-[7px] bg-[#F0EBE2] dark:bg-muted">
              <div className="h-full rounded-[7px]" style={{ width: `${Math.max(0, Math.min(100, b.value))}%`, background: low ? "#F0602F" : "#23B26D" }} />
            </div>
            <div className="w-11 shrink-0 font-heading text-[13.5px] font-extrabold" style={{ color: low ? "#A8320F" : "#11734A" }}>
              {b.value}{unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A status sticker for a row: light background, dark ink, white rim, tilted. */
export function RowTag({ label, tone }: { label: string; tone: Tone }) {
  const t = TONES[tone];
  return (
    <span
      className="shrink-0 rotate-[4deg] rounded-[10px] border-[2.5px] border-white px-2.5 py-1.5 font-body text-xs font-extrabold leading-none shadow-[0_3px_6px_-3px_rgba(27,35,51,0.35)] dark:border-card"
      style={{ background: t.bg, color: t.ink }}
    >
      {label}
    </span>
  );
}

/** A subject-tile-shaped icon (white rim, colored square, white glyph) for things that aren't a subject. */
export function IconTile({ icon: Icon, color, size = 42 }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center border-white shadow-[0_2.5px_3px_rgba(40,30,15,0.22)] dark:border-card"
      style={{ width: size, height: size, background: color, borderRadius: size * 0.3, borderWidth: Math.max(3, size * 0.07) }}
    >
      <Icon className="text-white" style={{ width: size * 0.48, height: size * 0.48 }} />
    </div>
  );
}

/** Initials in a colored circle - stands in where a person has no avatar. */
export function PersonBadge({ name, tilt = 0 }: { name: string; tilt?: number }) {
  const parts = name.trim().split(/\s+/);
  const ini = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  return (
    <div
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-[3px] border-white font-heading text-sm font-black text-white shadow-[0_2px_5px_rgba(40,30,15,0.25)] dark:border-card"
      style={{ background: colorFor(name), transform: tilt ? `rotate(${tilt}deg)` : undefined }}
    >
      {ini}
    </div>
  );
}

interface HomeRowProps {
  subject?: string;
  person?: string;
  icon?: ReactNode;
  title: string;
  meta?: ReactNode;
  tag?: { label: string; tone: Tone };
  action?: { label: string; onClick: () => void };
  onClick?: () => void;
  index?: number;
  children?: ReactNode;
}

/** A white row card: subject tile / person / icon, title + meta, then a tag sticker or an ink button. */
export function HomeRow({ subject, person, icon, title, meta, tag, action, onClick, index = 0, children }: HomeRowProps) {
  const tilt = index % 2 ? 5 : -5;
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3.5 rounded-[20px] bg-card px-4 py-3.5 shadow-[0_8px_16px_-12px_rgba(40,30,15,0.4)]",
        onClick && "cursor-pointer transition-colors hover:bg-soft"
      )}
    >
      {subject && (
        <div style={{ transform: `rotate(${tilt}deg)` }}>
          <SubjectSticker subject={subject} size={42} />
        </div>
      )}
      {person && !subject && <PersonBadge name={person} tilt={tilt} />}
      {icon && !subject && !person && <div className="shrink-0">{icon}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <div className="font-heading text-[15.5px] font-extrabold leading-tight text-foreground">{title}</div>
        {meta && <div className="font-body text-[13px] font-semibold leading-snug text-muted-foreground">{meta}</div>}
        {children}
      </div>
      {tag && <RowTag {...tag} />}
      {action && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); action.onClick(); }}
          className="shrink-0 rounded-xl bg-primary px-3.5 py-[9px] font-body text-[13px] font-extrabold text-primary-foreground"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Empty state as an invitation, per the design language ("ריק = הזמנה"). */
export function HomeEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[20px] border-[1.5px] border-dashed border-input px-4 py-5 text-center font-body text-[13.5px] font-bold text-muted-foreground">
      {children}
    </div>
  );
}
