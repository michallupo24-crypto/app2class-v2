import { TOOL_STICKERS } from "@/lib/toolStickers";
import { StickerArtSvg } from "./SubjectSticker";

export type ToolStickerId = keyof typeof TOOL_STICKERS;

interface ToolStickerProps {
  id: string;
  size?: number | string;
  /** Small rotation, as in the mockup. On by default, like the menu stickers. */
  tilt?: boolean;
  flat?: boolean;
  className?: string;
}

/** A tool / menu sticker from the "Tool Icons" set. Renders nothing for an unknown id. */
export function ToolSticker({ id, size = 30, tilt = true, flat = false, className }: ToolStickerProps) {
  const art = TOOL_STICKERS[id];
  if (!art) return null;
  return <StickerArtSvg art={art} size={size} tilt={tilt} flat={flat} className={className} />;
}

/** The sticker's main color - for accents such as the active menu item's ring. */
export const toolStickerColor = (id: string): string | undefined => TOOL_STICKERS[id]?.pal[0];
