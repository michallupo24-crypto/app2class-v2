import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, LogOut, Search, X } from "lucide-react";
import AvatarPreview from "@/components/avatar/AvatarPreview";
import type { UserProfile } from "@/hooks/useAuth";
import { useSchoolGuidelines } from "@/hooks/useSchoolGuidelines";
import { disabledPages } from "@/lib/schoolSetup";
import { cn } from "@/lib/utils";
import { buildMenu, GROUP_ICONS, ROLE_LABELS, type MenuGroup } from "./menuConfig";

// The side menu per the "Side Menu" design. One menu in three shapes:
// "full" (desktop, 280px), "rail" (tablet / folded, 76px: group icons only)
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

/** Lowercase, no niqqud / cantillation, collapsed spaces - so "שִׁיחוֹת" finds "שיחות". */
const normalize = (s: string) => s.toLowerCase().replace(/[֑-ׇ]/g, "").replace(/\s+/g, " ").trim();

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("");

function CountTag({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-label={`${n} חדשים`}
      className={cn("min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-[#E5484D] text-white font-heading font-bold text-[11px] leading-none tabular-nums", className)}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function GroupIcon({ group, size = 28 }: { group: MenuGroup; size?: number }) {
  const Icon = GROUP_ICONS[group.icon] ?? GROUP_ICONS.home_flat;
  return (
    <span
      aria-hidden
      className="flex-none inline-flex items-center justify-center rounded-lg"
      style={{ width: size, height: size, color: group.color, backgroundColor: `${group.color}1A` }}
    >
      <Icon size={Math.round(size * 0.57)} strokeWidth={2} />
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
  const isDrawer = mode === "drawer";
  const open = mode !== "rail";

  useEffect(() => {
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(folded)); } catch { /* private mode */ }
  }, [folded]);

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
        "h-full flex-none flex flex-col gap-4 overflow-hidden bg-menu transition-[width] duration-200",
        isDrawer ? "w-full pt-5 px-4 pb-5 shadow-[-20px_0_40px_-20px_rgba(11,17,32,.45)]"
          : cn("pt-5 pb-4 shadow-[inset_1px_0_0_rgba(27,35,51,.08)]", open ? "w-[280px] px-4" : "w-[76px] px-3"),
      )}
    >
      {/* Brand */}
      <div className={cn("flex items-center gap-2 h-9", open ? "justify-between px-1" : "justify-center")}>
        <Link to="/dashboard" onClick={onClose} className="flex items-center gap-2.5 min-w-0" aria-label="App2Class - דף הבית">
          <img src="/logo.png" alt="" className="w-9 h-9 object-contain flex-none" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          {open && <span className="font-heading font-extrabold text-lg leading-none text-foreground whitespace-nowrap">App2Class</span>}
        </Link>
        {open && !isDrawer && onToggle && (
          <button type="button" onClick={onToggle} aria-label="צמצום התפריט" title="צמצום התפריט"
            className="w-8 h-8 flex-none rounded-lg text-muted-foreground hover:bg-card hover:text-foreground flex items-center justify-center transition-colors">
            <ChevronRight size={18} />
          </button>
        )}
        {isDrawer && (
          <button type="button" onClick={onClose} aria-label="סגירת התפריט"
            className="w-9 h-9 flex-none rounded-lg bg-card text-foreground flex items-center justify-center shadow-sm">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Search */}
      {open ? (
        <div className="relative flex-none">
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
              "w-full rounded-xl bg-card border border-transparent pr-9 pl-12 font-body text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden",
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
          className="flex-none mx-auto w-11 h-11 rounded-xl bg-card text-muted-foreground hover:text-foreground flex items-center justify-center shadow-sm"
        >
          <Search size={18} />
        </button>
      )}

      {open ? (
        <div
          id="side-menu-items"
          ref={listRef}
          onKeyDown={onListKey}
          className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] flex flex-col gap-4 -mx-1 px-1"
        >
          {shown.length === 0 && (
            <p role="status" className="px-2 py-6 text-center font-body text-sm text-muted-foreground">
              לא נמצאו פריטים עבור "{query.trim()}"
            </p>
          )}
          {shown.map((g) => {
            const isFolded = !q && !!folded[g.title];
            return (
              <div key={g.title} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  aria-expanded={!isFolded}
                  disabled={!!q}
                  onClick={() => setFolded((f) => ({ ...f, [g.title]: !f[g.title] }))}
                  className="flex items-center gap-2.5 h-9 px-1 rounded-lg text-right disabled:cursor-default"
                >
                  <GroupIcon group={g} />
                  <span className="flex-1 font-heading font-bold text-[13.5px] text-foreground">{g.title}</span>
                  {!q && (
                    <ChevronDown size={15} aria-hidden className={cn("text-muted-foreground transition-transform", isFolded && "rotate-90")} />
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
                        "mr-[38px] flex items-center gap-2 rounded-lg px-3 font-body text-[14px] transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        isDrawer ? "h-11" : "h-9",
                        on ? "bg-card text-foreground font-semibold shadow-sm" : "text-text-secondary hover:bg-card/60 hover:text-foreground",
                      )}
                      style={on ? { boxShadow: `inset -3px 0 0 ${g.color}, 0 1px 2px rgba(27,35,51,.06)` } : undefined}
                    >
                      <span className="flex-1 truncate">{it.title}</span>
                      {!!it.badge && <CountTag n={it.badge} />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] flex flex-col items-center gap-2 py-1">
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
                className={cn("relative w-12 h-12 flex-none rounded-xl flex items-center justify-center transition-colors", hasActive ? "bg-card shadow-sm" : "hover:bg-card/60")}
                style={hasActive ? { boxShadow: `inset -3px 0 0 ${g.color}` } : undefined}
              >
                <GroupIcon group={g} size={32} />
                {sum > 0 && <CountTag n={sum} className="absolute -top-1 -left-1 ring-2 ring-menu" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Profile */}
      <div className={cn("flex-none flex items-center gap-3 rounded-xl bg-card shadow-sm", open ? "p-2.5" : "p-1.5 justify-center")}>
        <button
          type="button"
          onClick={() => { navigate("/dashboard/avatar-edit"); onClose?.(); }}
          aria-label="עריכת אווטאר"
          title="עריכת אווטאר"
          className="flex-none w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
        >
          {profile.avatar ? (
            <AvatarPreview config={profile.avatar} size={40} />
          ) : (
            <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-heading font-bold text-sm leading-none">
              {initials(profile.fullName)}
            </span>
          )}
        </button>
        {open && (
          <>
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
              <span className="font-heading font-bold text-sm leading-tight text-foreground truncate">{profile.fullName}</span>
              {roleLabel && <span className="font-body text-xs leading-tight text-muted-foreground truncate">{roleLabel}</span>}
            </div>
            <button type="button" onClick={onLogout} aria-label="יציאה" title="יציאה"
              className="flex-none w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
              <LogOut size={17} className="-scale-x-100" />
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
