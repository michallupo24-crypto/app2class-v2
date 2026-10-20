import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import { ToolSticker } from "@/components/ToolSticker";
import type { UserProfile } from "@/hooks/useAuth";
import { useSchoolGuidelines } from "@/hooks/useSchoolGuidelines";
import { disabledPages } from "@/lib/schoolSetup";
import { cn } from "@/lib/utils";
import { buildMenu, ROLE_LABELS, type MenuGroup } from "./menuConfig";

// The side menu per the "Side Menu" design. One menu in three shapes:
// "full" (desktop, 280px), "rail" (tablet / folded, 86px: group stickers only)
// and "drawer" (phone, slides in from the right).

export type SideMenuMode = "full" | "rail" | "drawer";

interface AppSidebarProps {
  profile: UserProfile;
  onLogout: () => void;
  mode: SideMenuMode;
  /** Folds the full menu to a rail, or opens the rail. Not used by the drawer. */
  onToggle?: () => void;
  /** Closes the drawer (also called after navigating from it). */
  onClose?: () => void;
}

const FOLDED_KEY = "a2c-menu-folded";
const readFolded = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(FOLDED_KEY) || "{}"); } catch { return {}; }
};

const ring = (color: string) => `0 0 0 2.5px ${color}, 0 10px 18px -10px rgba(27,35,51,.5)`;
// Active item: filled with the group color, a white rim and a colored glow.
const activeGlow = (color: string) => `0 0 0 2.5px #fff, 0 10px 18px -8px ${color}`;
const CHIP_SHADOW = "shadow-[0_3px_8px_-6px_rgba(27,35,51,.35)]";

function CountTag({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-label={`${n} חדשים`}
      className={cn("min-w-5 px-1.5 py-1 rounded-full border-2 border-white dark:border-card bg-[#E5484D] text-white font-heading font-black text-[10.5px] leading-none text-center", className)}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function AppSidebar({ profile, onLogout, mode, onToggle, onClose }: AppSidebarProps) {
  const guidelines = useSchoolGuidelines(profile.schoolId);
  const location = useLocation();
  const navigate = useNavigate();
  const [folded, setFolded] = useState<Record<string, boolean>>(readFolded);
  const isDrawer = mode === "drawer";
  const open = mode !== "rail";

  useEffect(() => {
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(folded)); } catch { /* private mode */ }
  }, [folded]);

  const groups: MenuGroup[] = useMemo(() => {
    const managesSchool = profile.roles.some((r) => ["management", "system_admin"].includes(r));
    // Features the school turned off in its guidelines (management still sees them).
    const hidden = managesSchool ? new Set<string>() : disabledPages(guidelines);
    return buildMenu(profile)
      .map((g) => ({ ...g, items: g.items.filter((i) => !hidden.has(i.url.replace("/dashboard/", ""))) }))
      .filter((g) => g.items.length > 0);
  }, [profile, guidelines]);

  const isActive = (url: string) => location.pathname === url;
  const roleLabel = profile.roles.map((r) => ROLE_LABELS[r]).filter(Boolean).slice(0, 2).join(" · ");

  return (
    <nav
      aria-label="תפריט ראשי"
      className={cn(
        "h-full flex-none flex flex-col gap-[18px] overflow-hidden bg-menu transition-[width] duration-200",
        "bg-[radial-gradient(hsl(var(--menu-dots))_1.2px,transparent_1.4px)] [background-size:18px_18px]",
        isDrawer ? "w-full pt-[58px] px-4 pb-6 shadow-[-20px_0_40px_-20px_rgba(11,17,32,.45)]"
          : cn("pt-[22px] px-4 pb-[18px] shadow-[inset_1px_0_0_rgba(27,35,51,.06)]", open ? "w-[280px]" : "w-[86px]"),
      )}
    >
      {/* Brand */}
      <div className={cn("flex items-center gap-2 px-1.5", open ? "justify-between" : "justify-center")}>
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-[9px]" aria-label="App2Class - דף הבית">
          <img src="/logo.png" alt="" className="w-9 h-9 object-contain flex-none" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          {open && <span className="font-heading font-black text-lg leading-none text-foreground whitespace-nowrap">App2Class</span>}
        </Link>
        {open && !isDrawer && onToggle && (
          <button type="button" onClick={onToggle} aria-label="צמצום התפריט"
            className="w-8 h-8 rounded-[11px] bg-card flex items-center justify-center shadow-[0_4px_10px_-6px_rgba(27,35,51,.4)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        )}
        {isDrawer && (
          <button type="button" onClick={onClose} aria-label="סגירת התפריט"
            className="w-[38px] h-[38px] rounded-xl bg-card flex items-center justify-center shadow-[0_4px_10px_-6px_rgba(27,35,51,.4)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>

      {open ? (
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] flex flex-col gap-[18px] py-1 px-0.5">
          {groups.map((g) => {
            const isFolded = !!folded[g.title];
            return (
              <div key={g.title} className="flex flex-col gap-[5px]">
                <button
                  type="button"
                  aria-expanded={!isFolded}
                  onClick={() => setFolded((f) => ({ ...f, [g.title]: !f[g.title] }))}
                  className="flex items-center gap-2.5 px-1 pb-1.5 text-right"
                >
                  <ToolSticker id={g.icon} size={isDrawer ? 32 : 30} />
                  <span className="flex-1 font-heading font-black text-[15px] leading-none text-foreground">{g.title}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5B6478" strokeWidth="3.5" strokeLinecap="round"
                    style={{ transform: isFolded ? "rotate(90deg)" : undefined }}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {!isFolded && g.items.map((it) => {
                  const on = isActive(it.url);
                  return (
                    <Link
                      key={it.url}
                      to={it.url}
                      onClick={onClose}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "mr-[30px] flex items-center gap-2 rounded-[13px] font-body font-bold leading-none transition-transform",
                        isDrawer ? "px-3 py-[11px] text-[15.5px]" : "px-3 py-[9px] text-[14.5px]",
                        on ? "text-white" : cn("bg-card text-foreground hover:-translate-x-0.5", CHIP_SHADOW),
                      )}
                      style={on ? { background: g.color, boxShadow: activeGlow(g.color) } : undefined}
                    >
                      <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{it.title}</span>
                      {!!it.badge && <CountTag n={it.badge} />}
                      {it.isNew && (
                        <span className="px-[7px] py-1 rounded-[7px] border-2 border-white dark:border-card bg-[#FFF0C2] text-[#7A5200] font-body font-extrabold text-[10.5px] leading-none">
                          חדש
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] flex flex-col items-center gap-3.5 py-1 -mx-4">
          {groups.map((g) => {
            const hasActive = g.items.some((i) => isActive(i.url));
            const sum = g.items.reduce((a, i) => a + (i.badge || 0), 0);
            return (
              <button
                key={g.title}
                type="button"
                title={g.title}
                aria-label={`${g.title} - פתיחת התפריט`}
                onClick={() => { setFolded((f) => ({ ...f, [g.title]: false })); onToggle?.(); }}
                className={cn("relative w-[54px] h-[54px] rounded-[17px] flex items-center justify-center bg-card", !hasActive && CHIP_SHADOW)}
                style={hasActive ? { boxShadow: ring(g.color) } : undefined}
              >
                <ToolSticker id={g.icon} size={34} />
                {sum > 0 && <CountTag n={sum} className="absolute -top-1 -left-1" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Profile */}
      <div className={cn("flex items-center gap-2.5 rounded-[18px] bg-card shadow-[0_8px_18px_-12px_rgba(27,35,51,.45)] justify-center", open ? "p-2.5" : "p-1.5")}>
        <button
          type="button"
          onClick={() => { navigate("/dashboard/avatar-edit"); onClose?.(); }}
          aria-label="עריכת אווטאר"
          title="עריכת אווטאר"
          className="flex-none"
        >
          {profile.avatar ? (
            <AvatarPreview config={profile.avatar} size={40} />
          ) : (
            <span className="w-10 h-10 rounded-full border-[3px] border-white dark:border-card shadow-[0_2px_6px_rgba(27,35,51,.25)] bg-info flex items-center justify-center font-heading font-black text-sm text-white">
              {profile.fullName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
            </span>
          )}
        </button>
        {open && (
          <>
            <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
              <span className="font-heading font-extrabold text-sm leading-none text-foreground truncate">{profile.fullName}</span>
              {roleLabel && <span className="font-body font-semibold text-xs leading-none text-muted-foreground truncate">{roleLabel}</span>}
            </div>
            <button type="button" onClick={onLogout} className="font-body font-bold text-[12.5px] leading-none text-destructive hover:underline">
              יציאה
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
