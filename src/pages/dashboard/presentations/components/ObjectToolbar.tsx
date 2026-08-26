import { Bold, AlignRight, AlignCenter, AlignLeft, Trash2, Square, Circle, Sun } from 'lucide-react';
import type { SlideObject, TextFontFamily } from '../types';

interface Props {
  object: SlideObject;
  onUpdate: (updates: Partial<SlideObject>) => void;
  onDelete: () => void;
}

const btnBase = 'p-1.5 rounded-lg hover:bg-muted transition-colors';
const btnActive = 'bg-primary/10 text-primary';

const FONT_LABELS: Record<TextFontFamily, string> = {
  heading: 'Rubik',
  body: 'Assistant',
  serif: 'Frank Ruhl',
};

function OpacitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5" title="שקיפות">
      <Sun className="w-3.5 h-3.5 text-muted-foreground" />
      <input
        type="range"
        min={0.1}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 accent-primary"
      />
    </div>
  );
}

export function ObjectToolbar({ object, onUpdate, onDelete }: Props) {
  return (
    <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg shadow-sm px-2 py-1.5 flex-wrap max-w-[600px]">
      {object.type === 'text' && (
        <>
          <div className="flex items-center gap-0.5">
            {(Object.keys(FONT_LABELS) as TextFontFamily[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onUpdate({ fontFamily: f } as Partial<SlideObject>)}
                className={`${btnBase} text-[11px] font-semibold px-2 ${(object.fontFamily ?? 'body') === f ? btnActive : ''}`}
                title={FONT_LABELS[f]}
              >
                {FONT_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-border mx-1" />
          <input
            type="number"
            min={10}
            max={96}
            value={object.fontSize}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) } as Partial<SlideObject>)}
            className="w-14 h-7 text-xs border border-border rounded px-1 bg-background"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => onUpdate({ bold: !object.bold } as Partial<SlideObject>)}
            className={`${btnBase} ${object.bold ? btnActive : ''}`}
            title="מודגש"
          >
            <Bold className="w-4 h-4" />
          </button>
          <input
            type="color"
            value={object.color}
            onChange={(e) => onUpdate({ color: e.target.value } as Partial<SlideObject>)}
            className="w-7 h-7 rounded border border-border cursor-pointer"
            title="צבע טקסט"
          />
          <div className="w-px h-5 bg-border mx-1" />
          <button type="button" onClick={() => onUpdate({ align: 'right' } as Partial<SlideObject>)} className={`${btnBase} ${object.align === 'right' ? btnActive : ''}`} title="יישור לימין">
            <AlignRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onUpdate({ align: 'center' } as Partial<SlideObject>)} className={`${btnBase} ${object.align === 'center' ? btnActive : ''}`} title="מרכוז">
            <AlignCenter className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onUpdate({ align: 'left' } as Partial<SlideObject>)} className={`${btnBase} ${object.align === 'left' ? btnActive : ''}`} title="יישור לשמאל">
            <AlignLeft className="w-4 h-4" />
          </button>
        </>
      )}

      {object.type === 'shape' && (
        <>
          <input
            type="color"
            value={object.fill}
            onChange={(e) => onUpdate({ fill: e.target.value } as Partial<SlideObject>)}
            className="w-7 h-7 rounded border border-border cursor-pointer"
            title="צבע מילוי"
          />
          <div className="w-px h-5 bg-border mx-1" />
          <button type="button" onClick={() => onUpdate({ shape: 'rectangle' } as Partial<SlideObject>)} className={`${btnBase} ${object.shape === 'rectangle' ? btnActive : ''}`} title="מלבן">
            <Square className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onUpdate({ shape: 'circle' } as Partial<SlideObject>)} className={`${btnBase} ${object.shape === 'circle' ? btnActive : ''}`} title="עיגול">
            <Circle className="w-4 h-4" />
          </button>
          {object.shape === 'rectangle' && (
            <div className="flex items-center gap-1" title="עיגול פינות">
              <span className="text-[10px] text-muted-foreground">פינות</span>
              <input
                type="range"
                min={0}
                max={80}
                value={object.cornerRadius ?? 4}
                onChange={(e) => onUpdate({ cornerRadius: Number(e.target.value) } as Partial<SlideObject>)}
                className="w-14 accent-primary"
              />
            </div>
          )}
          <div className="w-px h-5 bg-border mx-1" />
          <div className="flex items-center gap-1" title="מסגרת">
            <input
              type="color"
              value={object.borderColor ?? '#000000'}
              onChange={(e) => onUpdate({ borderColor: e.target.value, borderWidth: object.borderWidth || 2 } as Partial<SlideObject>)}
              className="w-6 h-6 rounded border border-border cursor-pointer"
            />
            <input
              type="range"
              min={0}
              max={12}
              value={object.borderWidth ?? 0}
              onChange={(e) => onUpdate({ borderWidth: Number(e.target.value) } as Partial<SlideObject>)}
              className="w-12 accent-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ shadow: !object.shadow } as Partial<SlideObject>)}
            className={`${btnBase} text-[11px] font-semibold px-2 ${object.shadow ? btnActive : ''}`}
            title="צל"
          >
            צל
          </button>
        </>
      )}

      {object.type === 'image' && (
        <>
          <div className="flex items-center gap-1" title="עיגול פינות">
            <span className="text-[10px] text-muted-foreground">פינות</span>
            <input
              type="range"
              min={0}
              max={80}
              value={object.cornerRadius ?? 0}
              onChange={(e) => onUpdate({ cornerRadius: Number(e.target.value) } as Partial<SlideObject>)}
              className="w-14 accent-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ shadow: !object.shadow } as Partial<SlideObject>)}
            className={`${btnBase} text-[11px] font-semibold px-2 ${object.shadow ? btnActive : ''}`}
            title="צל"
          >
            צל
          </button>
        </>
      )}

      <div className="w-px h-5 bg-border mx-1" />
      <OpacitySlider value={object.opacity ?? 1} onChange={(v) => onUpdate({ opacity: v } as Partial<SlideObject>)} />
      <div className="w-px h-5 bg-border mx-1" />
      <button type="button" onClick={onDelete} className={`${btnBase} text-destructive`} title="מחק">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
