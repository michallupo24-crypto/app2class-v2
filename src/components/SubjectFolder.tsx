import { SubjectSticker, subjectColor } from "@/components/SubjectSticker";
import { cn } from "@/lib/utils";

// A subject as a colored folder with a tab and a sticker, per the "Subjects" design.

export interface FolderChip {
  text: string;
  tone: "info" | "warning" | "success" | "neutral";
}

interface SubjectFolderProps {
  /** Subject name - picks the sticker and the folder color. */
  subject: string;
  /** Shown on the label; defaults to the subject name (e.g. "מתמטיקה · י׳-1"). */
  title?: string;
  subtitle?: string;
  chips?: FolderChip[];
  live?: boolean;
  index?: number;
  onOpen: () => void;
}

const CHIP: Record<FolderChip["tone"], string> = {
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  neutral: "bg-muted text-text-secondary",
};


const darken = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * 0.72).toString(16).padStart(2, "0")).join("");
};

export function SubjectFolder({ subject, title, subtitle, chips = [], live, onOpen }: SubjectFolderProps) {
  const color = subjectColor(subject);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative pt-3 md:pt-3.5 text-right transition-transform hover:-translate-y-1 focus-visible:outline-none"
      aria-label={[title || subject, subtitle, live && "שיעור עכשיו"].filter(Boolean).join(", ")}
    >
      {/* Folder tab */}
      <span className="absolute top-0 right-3.5 md:right-[18px] w-[62px] md:w-[84px] h-6 md:h-7 rounded-t-[10px] md:rounded-t-xl" style={{ background: darken(color) }} />
      <span
        className="relative flex flex-col gap-2 md:gap-2.5 pt-[30px] md:pt-10 px-3 md:px-3.5 pb-3 md:pb-3.5 rounded-[6px_20px_20px_20px] md:rounded-[8px_24px_24px_24px] border-[3px] md:border-4 border-white dark:border-card group-focus-visible:ring-2 group-focus-visible:ring-ring"
        style={{ background: color, boxShadow: `0 14px 24px -16px ${color}` }}
      >
        <SubjectSticker subject={subject} size={62} className="absolute -top-5 md:-top-[26px] left-2 md:left-3 max-md:w-[46px] max-md:h-[46px]" />
        {live && (
          <span className="absolute top-2 md:top-2.5 right-2.5 md:right-3 px-[7px] md:px-[9px] py-1 md:py-[5px] rounded-[7px] md:rounded-[9px] border-2 border-white bg-[#E5484D] text-white font-body font-extrabold text-[10.5px] md:text-xs leading-none">
            שיעור עכשיו
          </span>
        )}
        <span className="flex flex-col gap-1.5 md:gap-2 px-2.5 md:px-3 pt-2.5 md:pt-3 pb-[9px] md:pb-[11px] rounded-[13px] md:rounded-[15px] bg-card">
          <span className="font-heading font-black text-[15px] md:text-[17px] leading-tight text-foreground">{title || subject}</span>
          {subtitle && <span className="font-body font-semibold text-[11.5px] md:text-[12.5px] leading-tight text-muted-foreground">{subtitle}</span>}
          {chips.length > 0 && (
            <span className="flex gap-1.5 flex-wrap">
              {chips.map((c) => (
                <span key={c.text} className={cn("px-2 py-[5px] rounded-full font-body font-extrabold text-[11px] md:text-[11.5px] leading-none", CHIP[c.tone])}>{c.text}</span>
              ))}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
