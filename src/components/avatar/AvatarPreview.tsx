import { useState, useEffect } from "react";
import type { AvatarConfig } from "./AvatarStudio";
import {
  BODY_TYPES,
  EYE_COLORS,
  HAIR_STYLES_BY_BODY,
  SKIN_CSS_FILTER,
  EXPRESSIONS,
  avatarUrl,
  replaceHairColors,
} from "./avatarData";
import { Glasses, GraduationCap, Star } from "lucide-react";

const ACCESSORY_ICONS: Record<string, typeof Glasses> = {
  glasses: Glasses,
  sunglasses: Glasses,
  cap: GraduationCap,
  star: Star,
};

const OUTFIT_LABELS: Record<string, string> = {
  hoodie: "קפוצ'ון",
  tshirt: "חולצת טי",
  formal: "מכופתרת",
  dress: "שמלה",
  casual: "קז'ואל",
};

const FacialHairIcon = ({ kind }: { kind: string }) => {
  if (kind === "mustache") {
    return (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
        <path d="M2 13c1.5-3 4-3 6-1 1.2 1.1 2.5 1.1 4 0 1.5-1.1 2.8-1.1 4 0 2 2 4.5 2 6 1-1 3-4 4-8 3-1.3-.3-2.7-.3-4 0-4 1-7-0-8-3Z" />
      </svg>
    );
  }
  if (kind === "beard") {
    return (
      <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
        <path d="M4 4c0 6 1 12 8 16 7-4 8-10 8-16-2 2-4 3-8 3S6 6 4 4Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor">
      <path d="M3 12c2-2.5 5-2.5 7-.7 1.2 1 2.6 1 4 0 2-1.8 5-1.8 7 .7-2 3-5 3-7 1.2-1.4-1-2.8-1-4 0-2 1.8-5 1.8-7-1.2Z" />
    </svg>
  );
};

function useSvg(svgUrl: string | null) {
  const [content, setContent] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!svgUrl) { setContent(""); setError(false); return; }
    setError(false);
    fetch(svgUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        // Verify it's actually SVG content
        if (text.includes("<svg") || text.includes("<SVG")) {
          setContent(text);
        } else {
          setError(true);
          setContent("");
        }
      })
      .catch(() => { setContent(""); setError(true); });
  }, [svgUrl]);
  return { content, error };
}

function useHairSvg(svgUrl: string | null, hairColor: string) {
  const [content, setContent] = useState("");
  useEffect(() => {
    if (!svgUrl) { setContent(""); return; }
    fetch(svgUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (text.includes("<svg") || text.includes("<SVG")) {
          setContent(replaceHairColors(text, hairColor));
        } else {
          setContent("");
        }
      })
      .catch(() => setContent(""));
  }, [svgUrl, hairColor]);
  return content;
}

function inlineSvg(raw: string) {
  return raw.replace(/<svg/, '<svg style="width:100%;height:100%;object-fit:contain"');
}

interface AvatarPreviewProps {
  config: AvatarConfig;
  size?: number;
  className?: string;
}

const AvatarPreview = ({ config, size = 160, className }: AvatarPreviewProps) => {
  const bodyTypeKey = config.body_type || "basic";
  const eyeColorKey = config.eye_color || "brown";
  const skinColor = config.skin || "#FDDBB4";
  const hairStyleKey = config.hair_style || "boy";
  const hairColor = config.hair_color || "#2C1A0E";

  const bodyTypeEntry = BODY_TYPES.find((b) => b.key === bodyTypeKey) || BODY_TYPES[0];
  const eyeEntry = EYE_COLORS.find((e) => e.key === eyeColorKey) || EYE_COLORS[0];
  const hairStyles = HAIR_STYLES_BY_BODY[bodyTypeKey] || HAIR_STYLES_BY_BODY.basic;
  const hairEntry = hairStyles.find((h) => h.key === hairStyleKey) || hairStyles[0];

  const faceUrl = avatarUrl(bodyTypeEntry.faceFile);
  const bodyUrl = avatarUrl(
    (eyeEntry.files as Record<string, string>)[bodyTypeKey] ||
      (eyeEntry.files as Record<string, string>).basic
  );
  const hairUrl = hairEntry.file ? avatarUrl(hairEntry.file) : null;

  const face = useSvg(faceUrl);
  const body = useSvg(bodyUrl);
  const hairSvg = useHairSvg(hairUrl, hairColor);
  const skinFilter = SKIN_CSS_FILTER[skinColor] || SKIN_CSS_FILTER["#F5C5A3"];

  const dim = size;
  const hasError = face.error || body.error;

  const backgroundColor = config.background || "#E0F2FE";
  const expressionEntry = EXPRESSIONS.find((e) => e.key === (config.expression || "happy")) || EXPRESSIONS[0];
  const AccessoryIcon = config.accessory && config.accessory !== "none" ? ACCESSORY_ICONS[config.accessory] : null;
  const facialHairKind = config.facialHair && config.facialHair !== "none" ? config.facialHair : null;
  const outfitLabel = config.outfit || "";
  const outfitColor = config.outfitColor || "#3B82F6";
  const badgeSize = Math.max(20, Math.round(dim * 0.15));

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative flex items-center justify-center rounded-2xl overflow-hidden shadow-md${className ? ` ${className}` : ""}`}
        style={{
          width: dim,
          height: dim,
          backgroundColor,
          boxShadow: `0 0 ${Math.round(dim * 0.12)}px hsl(${expressionEntry.glow} / 0.55)`,
        }}
      >
        {hasError ? (
          <div className="flex items-center justify-center w-full h-full bg-muted">
            <svg viewBox="0 0 24 24" fill="none" className="w-1/2 h-1/2 text-muted-foreground/40">
              <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z" fill="currentColor"/>
            </svg>
          </div>
        ) : face.content ? (
          <div
            className="absolute inset-0 w-full h-full flex items-center justify-center"
            style={{ filter: skinFilter }}
            dangerouslySetInnerHTML={{ __html: inlineSvg(face.content) }}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
        )}
        {body.content && (
          <div
            className="absolute inset-0 w-full h-full flex items-center justify-center"
            style={{ mixBlendMode: "multiply" }}
            dangerouslySetInnerHTML={{ __html: inlineSvg(body.content) }}
          />
        )}
        {hairSvg && (
          <div
            className="absolute inset-0 w-full h-full flex items-center justify-center"
            style={{ mixBlendMode: "multiply" }}
            dangerouslySetInnerHTML={{ __html: inlineSvg(hairSvg) }}
          />
        )}
        {outfitLabel && (
          <div
            className="absolute bottom-0 inset-x-0 flex items-center justify-center text-white font-heading"
            style={{ height: Math.round(dim * 0.14), backgroundColor: outfitColor, fontSize: Math.max(9, Math.round(dim * 0.055)) }}
          >
            {OUTFIT_LABELS[outfitLabel] || outfitLabel}
          </div>
        )}
        {AccessoryIcon && (
          <div
            className="absolute top-1.5 left-1.5 rounded-full bg-white/90 flex items-center justify-center shadow"
            style={{ width: badgeSize, height: badgeSize }}
            title={config.accessory}
          >
            <AccessoryIcon className="text-foreground" style={{ width: badgeSize * 0.6, height: badgeSize * 0.6 }} />
          </div>
        )}
        {facialHairKind && (
          <div
            className="absolute top-1.5 right-1.5 rounded-full bg-white/90 flex items-center justify-center shadow"
            style={{ width: badgeSize, height: badgeSize }}
            title={facialHairKind}
          >
            <div style={{ width: badgeSize * 0.6, height: badgeSize * 0.6 }} className="text-foreground flex items-center justify-center">
              <FacialHairIcon kind={facialHairKind} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarPreview;
