import { STICKERS, STICKER_GROUPS, type El, type StickerArt } from "@/lib/subjectStickers";
import { SUBJECT_GLYPHS, SUBJECT_TILES } from "@/lib/subjectTiles";

const NAME_TO_ID: Record<string, string> = Object.fromEntries([
  ...STICKER_GROUPS.flatMap(([, items]) => items.map(([id, name]) => [name, id])),
  ...SUBJECT_TILES.map(([id, name]) => [name, id]),
]);

// Names the app uses that differ from the sticker catalog.
const ALIASES: Record<string, string> = {
  "עברית": "heb",
  "הבנה והבעה": "heb",
  'תנ"ך': "bible",
  "תנך": "bible",
  "גיאוגרפיה": "geo",
  "טכנולוגיה": "scitech",
  "אדריכלות": "design",
  "אקואטיקה": "pe",
  "תרבות יהודית-ישראלית": "judaism",
  "חינוך": "home",
  "מחשבים": "cs",
};

const normalize = (name: string) => name.trim().replace(/[״"]/g, "״");

/** Resolves a subject name (as stored in the app) to its sticker id, if any. */
export function subjectStickerId(subject: string): string | null {
  const n = normalize(subject);
  if (NAME_TO_ID[n]) return NAME_TO_ID[n];
  if (ALIASES[subject.trim()]) return ALIASES[subject.trim()];
  // "מתמטיקה 5 יח״ל", "אנגלית - הקבצה א" and the like.
  const prefix = Object.keys(NAME_TO_ID).find((k) => n.startsWith(k));
  return prefix ? NAME_TO_ID[prefix] : null;
}

// Fallback palettes for subjects without artwork (from the highlight colors).
const FALLBACK = ["#1268E8", "#23B26D", "#9257EC", "#EE5A8F", "#F0572A", "#FBBE24", "#14B8A6", "#E5484D"];
const fallbackColor = (subject: string) =>
  FALLBACK[[...subject].reduce((h, c) => h + c.charCodeAt(0), 0) % FALLBACK.length];

const TILE_COLOR: Record<string, string> = Object.fromEntries(SUBJECT_TILES.map(([id, , , color]) => [id, color]));

/** The subject's base color - for hero cards, timetable blocks and accents. */
export function subjectColor(subject: string): string {
  const id = subjectStickerId(subject);
  return (id && TILE_COLOR[id]) || fallbackColor(subject);
}

const mix = (a: string, b: string, t: number) => {
  const hx = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const x = hx(a), y = hx(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};

interface SubjectTileProps {
  subject: string;
  size?: number;
  /** No drop shadow - for tiles sitting inside a strip or another card. */
  flat?: boolean;
  className?: string;
}

/** Compact subject icon: white-rimmed rounded square in the subject color with a white glyph. */
export function SubjectTile({ subject, size = 42, flat = false, className }: SubjectTileProps) {
  const id = subjectStickerId(subject);
  const glyph = id ? SUBJECT_GLYPHS[id] : null;
  const c = subjectColor(subject);
  const hi = mix(c, "#FFFFFF", 0.35);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{
        display: "block",
        overflow: "visible",
        flexShrink: 0,
        filter: flat ? undefined : "drop-shadow(0 2.5px 2.5px rgba(40,30,15,.22))",
      }}
    >
      <rect x={6} y={6} width={88} height={88} rx={28} fill="#fff" />
      <rect x={13} y={13} width={74} height={74} rx={22} fill={c} />
      <path d="M24 20 H60" stroke={hi} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        {glyph ? (
          glyph.map(([tag, a], k) => {
            const { w, t, fs, ...rest } = a;
            if (tag === "text") {
              return (
                <text key={k} {...rest} textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight={900} fontSize={fs} fill="#fff" stroke="none">
                  {t}
                </text>
              );
            }
            if (tag === "dot") return <circle key={k} {...rest} fill="#fff" stroke="none" />;
            const Tag = tag as "path";
            return <Tag key={k} {...(rest as React.SVGProps<SVGPathElement>)} strokeWidth={Number(w) || 6} />;
          })
        ) : (
          <text x={50} y={63} textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight={900} fontSize={34} fill="#fff" stroke="none">
            {subject.trim().charAt(0)}
          </text>
        )}
      </g>
    </svg>
  );
}

interface SubjectStickerProps {
  subject: string;
  size?: number;
  /** No drop shadow - for stickers sitting inside a strip or another card. */
  flat?: boolean;
  className?: string;
}

/** True when the subject has free-form sticker artwork (otherwise SubjectSticker falls back to a letter badge). */
export function hasSubjectSticker(subject: string): boolean {
  const id = subjectStickerId(subject);
  return !!(id && STICKERS[id]);
}

/** A subject's sticker: free-form shape, white sticker rim, soft shadow. */
export function SubjectSticker({ subject, size = 40, flat = false, className }: SubjectStickerProps) {
  const id = subjectStickerId(subject);
  const art = id ? STICKERS[id] : null;

  if (!art) {
    const color = fallbackColor(subject);
    return (
      <span
        className={className}
        aria-hidden="true"
        style={{
          width: size, height: size, borderRadius: size * 0.3, background: color, color: "#fff",
          border: `${Math.max(2, size / 16)}px solid #fff`, boxShadow: "0 3px 6px -2px rgba(27,35,51,.3)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          font: `900 ${Math.round(size * 0.42)}px/1 Rubik, sans-serif`, flexShrink: 0,
        }}
      >
        {subject.trim().charAt(0)}
      </span>
    );
  }

  return <StickerArtSvg art={art} size={size} flat={flat} className={className} />;
}

interface StickerArtSvgProps {
  art: StickerArt;
  size?: number | string;
  flat?: boolean;
  className?: string;
}

/** Draws sticker artwork (subject or tool): silhouette with a white rim, then details. */
export function StickerArtSvg({ art, size = 40, flat = false, className }: StickerArtSvgProps) {
  const [m, d, l] = art.pal;
  const pal: Record<string, string> = { m, d, l };
  const col = (v: unknown) => (typeof v === "string" && v !== "none" ? pal[v] || v : v);

  const draw = (list: El[], key: string, rim?: boolean) =>
    list.map(([tag, a], k) => {
      const { fill, stroke, t, fs, strokeWidth, ...rest } = a;
      const props: Record<string, unknown> = {
        key: key + k,
        ...rest,
        fill: col(fill),
        stroke: col(stroke),
        strokeWidth,
      };
      if (rim) {
        Object.assign(props, {
          fill: fill === "none" ? "none" : "#fff",
          stroke: "#fff",
          strokeWidth: (Number(strokeWidth) || 0) + 13,
          strokeLinejoin: "round",
          strokeLinecap: "round",
          opacity: 1,
        });
      }
      if (tag === "text") {
        return (
          <text
            {...props}
            textAnchor="middle"
            direction="ltr"
            unicodeBidi="plaintext"
            fontFamily="Rubik, sans-serif"
            fontWeight={900}
            fontSize={fs}
          >
            {t}
          </text>
        );
      }
      const Tag = tag as "path";
      return <Tag {...(props as React.SVGProps<SVGPathElement>)} />;
    });

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{
        display: "block",
        overflow: "visible",
        flexShrink: 0,
        filter: flat ? undefined : "drop-shadow(0 3px 3px rgba(27,35,51,.22))",
      }}
    >
      <g>{draw(art.sil, "o", true)}</g>
      <g>{draw(art.sil, "s")}</g>
      <g>{draw(art.det, "d")}</g>
    </svg>
  );
}
