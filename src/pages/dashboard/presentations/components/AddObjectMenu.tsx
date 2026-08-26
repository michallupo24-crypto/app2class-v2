import { useRef } from 'react';
import { Type, Image as ImageIcon, Square, Loader2 } from 'lucide-react';

interface Props {
  onAddText: () => void;
  onAddShape: () => void;
  onAddImageFile: (file: File) => void;
  uploadingImage: boolean;
}

export function AddObjectMenu({ onAddText, onAddShape, onAddImageFile, uploadingImage }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ml-2">הוספה</span>
      <button
        type="button"
        onClick={onAddText}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
      >
        <Type className="w-4 h-4" /> טקסט
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploadingImage}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground/80 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-60"
      >
        {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        תמונה
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAddImageFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={onAddShape}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
      >
        <Square className="w-4 h-4" /> צורה
      </button>
    </div>
  );
}
