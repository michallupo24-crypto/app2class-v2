import { Bold, AlignRight, AlignCenter, AlignLeft, Trash2, Square, Circle } from 'lucide-react';
import type { SlideObject } from '../types';

interface Props {
  object: SlideObject;
  onUpdate: (updates: Partial<SlideObject>) => void;
  onDelete: () => void;
}

const btnBase = 'p-1.5 rounded-lg hover:bg-muted transition-colors';
const btnActive = 'bg-primary/10 text-primary';

export function ObjectToolbar({ object, onUpdate, onDelete }: Props) {
  return (
    <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg shadow-sm px-2 py-1.5 flex-wrap">
      {object.type === 'text' && (
        <>
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
        </>
      )}

      <div className="w-px h-5 bg-border mx-1" />
      <button type="button" onClick={onDelete} className={`${btnBase} text-destructive`} title="מחק">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
