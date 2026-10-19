// Display name (שם תצוגה): set by management / the grade coordinator to show
// a person under a different name than the legal one in full_name (e.g. the
// surname of the parent a student lives with, or a nickname). Every place
// that shows a person's name goes through displayName(), so select
// "full_name, display_name" wherever a profile name is rendered.
// The rules mirror the profiles_display_name_format check constraint.

export type NamedProfile = { full_name?: string | null; display_name?: string | null } | null | undefined;

export const displayName = (p: NamedProfile, fallback = ""): string =>
  p?.display_name?.trim() || p?.full_name?.trim() || fallback;

/** The legal name when a display name hides it, for staff tooltips; otherwise undefined. */
export const legalNameHint = (p: NamedProfile): string | undefined =>
  p?.display_name?.trim() && p.full_name && p.display_name.trim() !== p.full_name.trim()
    ? `שם רשמי: ${p.full_name}`
    : undefined;

export const DISPLAY_NAME_MAX = 40;
const DISPLAY_NAME_RE = /^[A-Za-zא-ת]+([ '’׳־-][A-Za-zא-ת]+)*['’׳]?$/;

export const normalizeDisplayName = (raw: string): string => raw.trim().replace(/\s+/g, " ");

/** Hebrew error message, or null when the name is valid (empty = clear it). */
export const validateDisplayName = (raw: string): string | null => {
  const name = normalizeDisplayName(raw);
  if (!name) return null;
  if (/\d/.test(name)) return "שם תצוגה לא יכול לכלול ספרות";
  if (name.length < 2) return "שם תצוגה קצר מדי";
  if (name.length > DISPLAY_NAME_MAX) return `שם תצוגה ארוך מדי (עד ${DISPLAY_NAME_MAX} תווים)`;
  if (!DISPLAY_NAME_RE.test(name)) return "רק אותיות בעברית או באנגלית, רווח, מקף או גרש";
  return null;
};

/** Roles that may set someone else's display name (enforced again in set_display_name()). */
export const canManageDisplayNames = (roles: string[]): boolean =>
  roles.some((r) => r === "system_admin" || r === "super_admin" || r === "management" || r === "grade_coordinator");

/** PostgREST .or() filter matching a search term against the legal or the display name. */
export const nameSearchFilter = (term: string): string => {
  const t = term.replace(/[,()*%\\"]/g, " ").trim();
  return `full_name.ilike.%${t}%,display_name.ilike.%${t}%`;
};
