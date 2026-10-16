// One place that knows how an avatar is stored (the `avatars` table), how it
// is held in the app (AvatarConfig) and what the renderer needs (ArtConfig).
// Older configs (camelCase "faceShape/skinColor..." and the 3-body SVG model)
// keep rendering: every field is read from whichever name it was stored under.
import type { AvatarConfig } from "./AvatarStudio";
import type { ArtConfig } from "./avatarArt";

/**
 * Columns to select whenever an avatar is going to be drawn. "*" rather than a
 * list so that a database without the newer columns (e.g. freckles before its
 * migration) still returns every avatar instead of failing the query.
 */
export const AVATAR_COLUMNS = "*";

const HAIR_KEYS = ["boy", "curly", "mullet", "girl_long", "bun", "curly_long", "ponytail", "short_girl", "none"];
const OUTFIT_KEYS = ["hoodie", "tshirt", "polo", "sweater", "jacket", "sport", "plaid", "formal", "dress"];

/** "brown_dark" / "#4A3728" / "blue" -> one of the three eye images. */
const eyeKey = (v?: string | null) => {
  if (!v) return "brown";
  const k = v.toLowerCase().replace(/_dark$/, "");
  return ["brown", "blue", "green"].includes(k) ? k : "brown";
};

/** A row from `avatars` (any subset of its columns) -> AvatarConfig. */
export function avatarFromRow(row: Record<string, any> | null | undefined): AvatarConfig | null {
  if (!row) return null;
  return {
    body_type: row.face_shape || "basic",
    skin: row.skin_color || "#F5C5A3",
    eye_color: eyeKey(row.eye_color),
    hair_style: row.hair_style || "boy",
    hair_color: row.hair_color || "#2C1A0E",
    facialHair: row.facial_hair || "none",
    outfit: row.outfit || "hoodie",
    outfitColor: row.outfit_color || "#3B82F6",
    accessory: row.accessory || "none",
    expression: row.expression || "happy",
    background: row.background || "#E0F2FE",
    freckles: row.freckles || "none",
  };
}

/** AvatarConfig -> the columns to write. `freckles` needs the 20261016 migration. */
export function avatarToRow(c: AvatarConfig) {
  const art = toArtConfig(c);
  return {
    face_shape: c.body_type || "basic",
    skin_color: art.skin!,
    eye_color: art.eyes!,
    hair_style: art.hair!,
    hair_color: art.hairColor!,
    facial_hair: art.facialHair!,
    outfit: art.outfit!,
    outfit_color: art.outfitColor!,
    accessory: art.accessory!,
    expression: art.expression!,
    background: art.background!,
    freckles: art.freckles!,
  };
}

/**
 * Saves (upserts) a user's avatar. If the database doesn't have the
 * `freckles` column yet, it saves everything else instead of failing.
 */
export async function saveAvatar(supabase: any, userId: string, c: AvatarConfig) {
  const row = avatarToRow(c);
  const write = async (data: Record<string, any>) => {
    const { data: existing } = await supabase.from("avatars").select("id").eq("user_id", userId).maybeSingle();
    return existing
      ? supabase.from("avatars").update(data).eq("user_id", userId)
      : supabase.from("avatars").insert({ user_id: userId, eye_shape: "round", ...data });
  };
  let { error } = await write(row);
  if (error && /freckles/i.test(error.message || "")) {
    const { freckles: _unused, ...rest } = row;
    ({ error } = await write(rest));
  }
  if (error) throw error;
}

/** Any AvatarConfig shape -> what the renderer draws. */
export function toArtConfig(c: AvatarConfig): ArtConfig {
  const hair = c.hair_style || c.hairStyle;
  const outfit = c.outfit === "casual" ? "tshirt" : c.outfit;
  return {
    skin: c.skin || c.skinColor || "#F5C5A3",
    eyes: eyeKey(c.eye_color || c.eyeColor),
    hair: hair && HAIR_KEYS.includes(hair) ? hair : "boy",
    hairColor: c.hair_color || c.hairColor || "#2C1A0E",
    expression: c.expression || "happy",
    outfit: outfit && OUTFIT_KEYS.includes(outfit) ? outfit : "hoodie",
    outfitColor: c.outfitColor || "#3B82F6",
    accessory: c.accessory || "none",
    facialHair: c.facialHair || "none",
    freckles: c.freckles || "none",
    background: c.background || "#E0F2FE",
  };
}

/** ArtConfig -> AvatarConfig (what the editor hands back to the app). */
export function fromArtConfig(a: ArtConfig, base: AvatarConfig = {}): AvatarConfig {
  return {
    ...base,
    skin: a.skin,
    eye_color: a.eyes,
    hair_style: a.hair,
    hair_color: a.hairColor,
    expression: a.expression,
    outfit: a.outfit,
    outfitColor: a.outfitColor,
    accessory: a.accessory,
    facialHair: a.facialHair,
    freckles: a.freckles,
    background: a.background,
  };
}
