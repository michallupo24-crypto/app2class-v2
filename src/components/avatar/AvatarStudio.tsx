import { useState } from "react";
import { Undo2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AvatarArt, type ArtConfig, type ArtMode } from "./avatarArt";
import { toArtConfig, fromArtConfig } from "./avatarModel";

// Full avatar config - supports both old camelCase fields (DB mapping) and new SVG fields
export interface AvatarConfig {
  // Old fields (kept for DB backwards compat)
  faceShape?: string;
  skinColor?: string;
  eyeShape?: string;
  eyeColor?: string;
  hairStyle?: string;
  hairColor?: string;
  facialHair?: string;
  outfit?: string;
  outfitColor?: string;
  accessory?: string;
  expression?: string;
  background?: string;
  // New SVG-based fields
  body_type?: string;
  eye_color?: string;
  skin?: string;
  hair_style?: string;
  hair_color?: string;
  freckles?: string;
}

export const defaultAvatarConfig: AvatarConfig = {
  body_type: "basic",
  eye_color: "brown",
  skin: "#F5C5A3",
  hair_style: "ponytail",
  hair_color: "#5C3317",
  facialHair: "none",
  outfit: "hoodie",
  outfitColor: "#3B82F6",
  accessory: "none",
  expression: "happy",
  background: "#E0F2FE",
  freckles: "light",
};

// Options, from the Avatar Editor design.
const SKINS: [string, string][] = [["לבן שנהב", "#FEECD2"], ["בהיר מאוד", "#FDDBB4"], ["בהיר", "#F5C5A3"], ["אפרסק", "#EEB98A"], ["חיטה", "#E0AC69"], ["זהוב", "#D4915A"], ["חום בינוני", "#C68642"], ["חום", "#A0622A"], ["כהה", "#8D5524"], ["כהה מאוד", "#6B3A1F"], ["שחום", "#4A2912"], ["שחור עור", "#2D1A0E"]];
const EYES: [string, string, string][] = [["חום", "brown", "#8B4513"], ["כחול", "blue", "#4A90D9"], ["ירוק", "green", "#1A4A1A"]];
const HAIRS: [string, string][] = [["ילד קצר", "boy"], ["מתולתל קצר", "curly"], ["מאלט", "mullet"], ["ארוך", "girl_long"], ["קשור", "bun"], ["מתולתל ארוך", "curly_long"], ["קוקו", "ponytail"], ["קצר", "short_girl"], ["ללא", "none"]];
const HAIR_COLORS: [string, string][] = [["שחור", "#0D0D0D"], ["חום כהה", "#2C1A0E"], ["חום", "#5C3317"], ["חום בינוני", "#8B4513"], ["חום אדמדם", "#A0522D"], ["ג'ינג'י כהה", "#8B2500"], ["ג'ינג'י", "#C0392B"], ["ג'ינג'י בהיר", "#E8603C"], ["בלונד כהה", "#B8860B"], ["בלונד", "#D4A017"], ["בלונד בהיר", "#F0C040"], ["אפור", "#808080"], ["אפור בהיר", "#B0B0B0"], ["לבן", "#E8E8E8"]];
const EXPR: [string, string][] = [["שמח", "happy"], ["נלהב", "excited"], ["רגוע", "calm"], ["מרוכז", "focused"], ["מגניב", "cool"]];
const OUTFITS: [string, string][] = [["קפוצ'ון", "hoodie"], ["חולצת טי", "tshirt"], ["פולו", "polo"], ["סוודר", "sweater"], ["ג'קט", "jacket"], ["חולצת ספורט", "sport"], ["משבצות", "plaid"], ["מכופתרת", "formal"], ["שמלה", "dress"]];
const OUTFIT_COLORS: [string, string][] = [["כחול", "#3B82F6"], ["אדום", "#EF4444"], ["ירוק", "#22C55E"], ["כתום", "#F59E0B"], ["סגול", "#A855F7"], ["אפור כהה", "#1F2937"]];
const ACC: [string, string][] = [["ללא", "none"], ["משקפיים", "glasses"], ["משקפי שמש", "sunglasses"], ["כובע מצחייה", "cap"], ["כיפה", "kippah"], ["חיג'אב", "hijab"], ["מטפחת", "headscarf"], ["מכשיר שמיעה", "hearing_aid"]];
const FRECKLES: [string, string][] = [["ללא", "none"], ["מעט", "light"], ["הרבה", "many"]];
const FACIAL: [string, string][] = [["ללא", "none"], ["שפם", "mustache"], ["זקן", "beard"], ["זקנקן", "goatee"]];
const BACKGROUNDS: [string, string][] = [["שמיים", "#E0F2FE"], ["ורוד", "#FCE7F3"], ["ירוק", "#DCFCE7"], ["צהוב", "#FEF3C7"], ["סגול", "#EDE9FE"], ["תכלת", "#E0F7FA"], ["אפור", "#E8EDF7"]];

type Tab = "face" | "hair" | "eyes" | "clothes";
const TABS: [Tab, string][] = [["face", "פנים"], ["hair", "שיער"], ["eyes", "עיניים"], ["clothes", "בגדים"]];
const ZOOMS: [ArtMode, string][] = [["full", "גוף"], ["head", "ראש"], ["face", "פנים"]];
const TAB_ZOOM: Record<Tab, ArtMode> = { face: "head", hair: "head", eyes: "head", clothes: "full" };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

interface AvatarStudioProps {
  config: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
  variant?: "student" | "adult";
}

/** Avatar editor (the "Avatar Editor" design). Saving is up to the page that hosts it. */
const AvatarStudio = ({ config, onChange }: AvatarStudioProps) => {
  const cfg = toArtConfig(config);
  const [tab, setTab] = useState<Tab>("face");
  const [zoom, setZoom] = useState<ArtMode | null>(null);
  const [history, setHistory] = useState<ArtConfig[]>([]);
  const view = zoom || TAB_ZOOM[tab];

  const apply = (next: ArtConfig) => {
    setHistory((h) => [...h, cfg].slice(-30));
    onChange(fromArtConfig(next, config));
  };
  const set = (key: keyof ArtConfig, value: string) => {
    if (cfg[key] !== value) apply({ ...cfg, [key]: value });
  };
  const undo = () => {
    if (!history.length) return;
    onChange(fromArtConfig(history[history.length - 1], config));
    setHistory((h) => h.slice(0, -1));
  };
  const randomize = () =>
    apply({
      ...cfg,
      skin: pick(SKINS)[1], eyes: pick(EYES)[1], hair: pick(HAIRS.slice(0, 8))[1], hairColor: pick(HAIR_COLORS)[1],
      expression: pick(EXPR)[1], outfit: pick(OUTFITS)[1], outfitColor: pick(OUTFIT_COLORS)[1],
      accessory: pick(["none", "none", "glasses", "cap"]), freckles: pick(["none", "none", "light", "many"]),
    });

  const Tiles = ({ title, field, list, mode }: { title: string; field: keyof ArtConfig; list: [string, string][]; mode: ArtMode }) => (
    <Section title={title} current={list.find((x) => x[1] === cfg[field])?.[0]}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
        {list.map(([label, value]) => {
          const on = cfg[field] === value;
          return (
            <button key={value} type="button" onClick={() => set(field, value)} aria-pressed={on} className="flex flex-col gap-1.5">
              <div className={cn("overflow-hidden rounded-[16px] outline-offset-2", on ? "outline outline-[3px] outline-link" : "outline outline-1 outline-border")}>
                <AvatarArt cfg={{ ...cfg, [field]: value }} mode={mode} />
              </div>
              <span className={cn("text-center font-body text-xs font-bold leading-tight", on ? "text-link" : "text-text-secondary")}>{label}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );

  const Swatches = ({ title, field, list, hexIdx = 1 }: { title: string; field: keyof ArtConfig; list: string[][]; hexIdx?: number }) => (
    <Section title={title} current={list.find((x) => x[1] === cfg[field])?.[0]}>
      <div className="flex flex-wrap gap-2.5">
        {list.map((x) => {
          const on = cfg[field] === x[1];
          return (
            <button
              key={x[1]}
              type="button"
              title={x[0]}
              aria-label={x[0]}
              aria-pressed={on}
              onClick={() => set(field, x[1])}
              className="h-10 w-10 rounded-full"
              style={{ background: x[hexIdx], boxShadow: on ? "0 0 0 3px #fff, 0 0 0 6px hsl(var(--link))" : "inset 0 0 0 1px rgba(27,35,51,.12)" }}
            />
          );
        })}
      </div>
    </Section>
  );

  return (
    <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Preview */}
      <div className="flex flex-col gap-4 rounded-card bg-card p-5 shadow-card md:sticky md:top-20">
        <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[18px]">
          <AvatarArt cfg={cfg} mode={view} />
        </div>
        <div className="flex justify-center gap-2">
          {ZOOMS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setZoom(k)}
              className={cn("rounded-full px-3.5 py-2 font-body text-[13px] font-bold", k === view ? "bg-primary text-primary-foreground" : "bg-muted text-text-secondary")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={undo} disabled={!history.length} className="gap-1.5">
            <Undo2 className="h-4 w-4" /> ביטול שינוי
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={randomize} className="gap-1.5">
            <Shuffle className="h-4 w-4" /> הפתיעו אותי
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex min-w-0 flex-col gap-[22px] rounded-card bg-card p-5 shadow-card">
        <div className="grid grid-cols-4 gap-1.5 rounded-[16px] bg-muted p-[5px]">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setTab(k); setZoom(null); }}
              className={cn("rounded-xl px-1.5 py-3 text-center font-heading text-[15px] font-extrabold", k === tab ? "bg-card text-foreground shadow-[0_1px_3px_rgba(27,35,51,0.12)]" : "text-muted-foreground")}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "face" && (
          <>
            <Swatches title="גוון עור" field="skin" list={SKINS} />
            <Tiles title="הבעה" field="expression" list={EXPR} mode="head" />
            <Tiles title="נמשים" field="freckles" list={FRECKLES} mode="head" />
            <Tiles title="שיער פנים" field="facialHair" list={FACIAL} mode="head" />
            <Swatches title="רקע" field="background" list={BACKGROUNDS} />
          </>
        )}
        {tab === "hair" && (
          <>
            <Tiles title="תסרוקת" field="hair" list={HAIRS} mode="head" />
            <Swatches title="צבע שיער" field="hairColor" list={HAIR_COLORS} />
          </>
        )}
        {tab === "eyes" && (
          <>
            <Swatches title="צבע עיניים" field="eyes" list={EYES} hexIdx={2} />
            <Tiles title="משקפיים ואביזרים" field="accessory" list={ACC} mode="head" />
          </>
        )}
        {tab === "clothes" && (
          <>
            <Tiles title="לבוש" field="outfit" list={OUTFITS} mode="full" />
            <Swatches title="צבע" field="outfitColor" list={OUTFIT_COLORS} />
          </>
        )}
      </div>
    </div>
  );
};

function Section({ title, current, children }: { title: string; current?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="font-heading text-[15px] font-extrabold text-foreground">{title}</span>
        {current && <span className="font-body text-[13px] font-semibold text-muted-foreground">{current}</span>}
      </div>
      {children}
    </div>
  );
}

export default AvatarStudio;
