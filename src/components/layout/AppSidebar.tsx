import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
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

/** Lowercase, no niqqud / cantillation, collapsed spaces - so "שִׁיחוֹת" finds "שיחות". */
const normalize = (s: string) => s.toLowerCase().replace(/[֑-ׇ]/g, "").replace(/\s+/g, " ").trim();

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");

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
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const focusSearchOnOpen = useRef(false);
  // The group whose rail sticker was clicked: once the menu opens, scroll to it.
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isDrawer = mode === "drawer";
  const open = mode !== "rail";

  useEffect(() => {
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(folded)); } catch { /* private mode */ }
  }, [folded]);

  useEffect(() => {
    if (!open || !focusGroup) return;
    const el = groupRefs.current[focusGroup];
    const list = listRef.current;
    // Scroll the menu list itself (scrollIntoView gets cut short while the menu is still widening).
    if (el && list) {
      list.scrollTop += el.getBoundingClientRect().top - list.getBoundingClientRect().top - 4;
      el.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    }
    setFocusGroup(null);
  }, [open, focusGroup]);

  // The rail's search button opens the menu; focus the box once it is there.
  useEffect(() => {
    if (open && focusSearchOnOpen.current) {
      focusSearchOnOpen.current = false;
      searchRef.current?.focus();
    }
  }, [open]);

  // Ctrl/Cmd+K jumps to the menu search from anywhere (opening the rail if needed).
  useEffect(() => {
    if (isDrawer) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.code === "KeyK")) {
        e.preventDefault();
        if (open) searchRef.current?.focus();
        else { focusSearchOnOpen.current = true; onToggle?.(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isDrawer, onToggle]);

  const groups: MenuGroup[] = useMemo(() => {
    const managesSchool = profile.roles.some((r) => ["management", "system_admin"].includes(r));
    // Features the school turned off in its guidelines (management still sees them).
    const hidden = managesSchool ? new Set<string>() : disabledPages(guidelines);
    return buildMenu(profile)
      .map((g) => ({ ...g, items: g.items.filter((i) => !hidden.has(i.url.replace("/dashboard/", ""))) }))
      .filter((g) => g.items.length > 0);
  }, [profile, guidelines]);

  const q = normalize(query);
  // Searching shows every match, ignoring folded groups. A group-name match keeps the whole group.
  const shown: MenuGroup[] = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => (normalize(g.title).includes(q) ? g : { ...g, items: g.items.filter((i) => normalize(i.title).includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  const isActive = (url: string) => location.pathname === url;
  const roleLabel = profile.roles.map((r) => ROLE_LABELS[r]).filter(Boolean).slice(0, 2).join(" · ");

  const itemLinks = () => Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-menu-item]") ?? []);

  const go = (url: string) => {
    setQuery("");
    navigate(url);
    onClose?.();
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) { e.preventDefault(); e.stopPropagation(); setQuery(""); }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      itemLinks()[0]?.focus();
    } else if (e.key === "Enter" && q) {
      const first = shown[0]?.items[0];
      if (first) { e.preventDefault(); go(first.url); }
    }
  };

  // Up / down arrows walk the visible items; up from the first goes back to the search box.
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const links = itemLinks();
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    e.preventDefault();
    if (e.key === "ArrowDown") links[Math.min(i + 1, links.length - 1)].focus();
    else if (i === 0) searchRef.current?.focus();
    else links[i - 1].focus();
  };

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

      {/* Search */}
      {open ? (
        <div className="relative flex-none mx-0.5">
          <Search size={16} aria-hidden className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground pointer-events-none" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="חיפוש בתפריט"
            aria-label="חיפוש בתפריט"
            aria-controls="side-menu-items"
            autoComplete="off"
            enterKeyHint="go"
            className={cn(
              "w-full rounded-[13px] bg-card pr-9 pl-12 font-body font-bold text-sm text-foreground placeholder:text-muted-foreground placeholder:font-semibold",
              "focus:outline-none focus:ring-2 focus:ring-primary/25 [&::-webkit-search-cancel-button]:hidden",
              CHIP_SHADOW,
              isDrawer ? "h-11" : "h-10",
            )}
          />
          {query ? (
            <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="ניקוי החיפוש"
              className="absolute top-1/2 -translate-y-1/2 left-2 w-7 h-7 rounded-md text-muted-foreground hover:text-foreground flex items-center justify-center">
              <X size={15} />
            </button>
          ) : !isDrawer && (
            <kbd aria-hidden className="absolute top-1/2 -translate-y-1/2 left-2.5 px-1.5 py-0.5 rounded border border-border bg-background font-body text-[10.5px] leading-none text-muted-foreground" dir="ltr">
              Ctrl K
            </kbd>
          )}
        </div>
      ) : (
        <button
          type="button"
          title="חיפוש בתפריט (Ctrl+K)"
          aria-label="חיפוש בתפריט"
          onClick={() => { focusSearchOnOpen.current = true; onToggle?.(); }}
          className={cn("flex-none mx-auto w-[54px] h-[54px] rounded-[17px] bg-card flex items-center justify-center", CHIP_SHADOW)}
        >
          <ToolSticker id="search" size={34} />
        </button>
      )}

      {open ? (
        <div
          id="side-menu-items"
          ref={listRef}
          onKeyDown={onListKey}
          className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] flex flex-col gap-[18px] py-1 px-0.5"
        >
          {shown.length === 0 && (
            <p role="status" className="px-2 py-6 text-center font-body text-sm text-muted-foreground">
              לא נמצאו פריטים עבור "{query.trim()}"
            </p>
          )}
          {shown.map((g) => {
            const isFolded = !q && !!folded[g.title];
            return (
              <div key={g.title} ref={(el) => { groupRefs.current[g.title] = el; }} className="flex flex-col gap-[5px]">
                <button
                  type="button"
                  aria-expanded={!isFolded}
                  disabled={!!q}
                  onClick={() => setFolded((f) => ({ ...f, [g.title]: !f[g.title] }))}
                  className="flex items-center gap-2.5 px-1 pb-1.5 text-right disabled:cursor-default"
                >
                  <ToolSticker id={g.icon} size={isDrawer ? 32 : 30} />
                  <span className="flex-1 font-heading font-black text-[15px] leading-none text-foreground">{g.title}</span>
                  {!q && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5B6478" strokeWidth="3.5" strokeLinecap="round"
                      style={{ transform: isFolded ? "rotate(90deg)" : undefined }}><path d="M6 9l6 6 6-6" /></svg>
                  )}
                </button>
                {!isFolded && g.items.map((it) => {
                  const on = isActive(it.url);
                  return (
                    <Link
                      key={it.url}
                      to={it.url}
                      data-menu-item
                      onClick={() => { setQuery(""); onClose?.(); }}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "mr-[30px] flex items-center gap-2 rounded-[13px] font-body font-bold leading-none transition-transform",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        isDrawer ? "px-3 py-[11px] text-[15.5px]" : "px-3 py-[9px] text-[14.5px]",
                        on ? "text-white" : cn("bg-card text-foreground hover:-translate-x-0.5", CHIP_SHADOW),
                      )}
                      style={on ? { background: g.color, boxShadow: activeGlow(g.color) } : undefined}
                    >
                      <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{it.title}</span>
                      {!!it.badge && <CountTag n={it.badge} />}
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
                onClick={() => { setFolded((f) => ({ ...f, [g.title]: false })); setFocusGroup(g.title); onToggle?.(); }}
                className={cn("relative flex-none w-[54px] h-[54px] rounded-[17px] flex items-center justify-center bg-card", !hasActive && CHIP_SHADOW)}
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
      <div className={cn("flex-none flex items-center gap-2.5 rounded-[18px] bg-card shadow-[0_8px_18px_-12px_rgba(27,35,51,.45)] justify-center", open ? "p-2.5" : "p-1.5")}>
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
              {initials(profile.fullName)}
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
