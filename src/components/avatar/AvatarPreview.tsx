import type { AvatarConfig } from "./AvatarStudio";
import { AvatarArt, type ArtMode } from "./avatarArt";
import { toArtConfig } from "./avatarModel";
import { cn } from "@/lib/utils";

interface AvatarPreviewProps {
  config: AvatarConfig | null | undefined;
  size?: number;
  className?: string;
  /** Framing; by default small avatars show the face, larger ones the head. */
  mode?: ArtMode;
}

/**
 * A person's avatar per the design language: round, white rim, pastel
 * background. Used everywhere a person appears (sidebar, chats, class map...).
 */
const AvatarPreview = ({ config, size = 160, className, mode }: AvatarPreviewProps) => {
  const framing: ArtMode = mode ?? (size <= 80 ? "face" : "head");
  const rim = Math.max(2, Math.round(size / 22));
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-full border-white shadow-[0_2px_6px_rgba(40,30,15,0.25)] dark:border-card", className)}
      style={{ width: size, height: size, borderWidth: rim }}
    >
      {config ? (
        <AvatarArt cfg={toArtConfig(config)} mode={framing} sticker={false} />
      ) : (
        <div className="h-full w-full bg-info-soft" />
      )}
    </div>
  );
};

export default AvatarPreview;
