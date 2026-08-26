import { useRef } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import type { SlideObject } from '../types';

const MIN_SIZE = 20;

interface Props {
  object: SlideObject;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<SlideObject>) => void;
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export function CanvasObject({ object, selected, onSelect, onUpdate }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const textRef = useRef<HTMLDivElement>(null);

  const startResize = (corner: ResizeCorner, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: object.x, y: object.y, width: object.width, height: object.height };

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let { x: nx, y: ny, width: nw, height: nh } = start;
      if (corner === 'se') { nw = Math.max(MIN_SIZE, start.width + dx); nh = Math.max(MIN_SIZE, start.height + dy); }
      if (corner === 'sw') { nw = Math.max(MIN_SIZE, start.width - dx); nh = Math.max(MIN_SIZE, start.height + dy); nx = start.x + start.width - nw; }
      if (corner === 'ne') { nw = Math.max(MIN_SIZE, start.width + dx); nh = Math.max(MIN_SIZE, start.height - dy); ny = start.y + start.height - nh; }
      if (corner === 'nw') { nw = Math.max(MIN_SIZE, start.width - dx); nh = Math.max(MIN_SIZE, start.height - dy); nx = start.x + start.width - nw; ny = start.y + start.height - nh; }
      onUpdate({ x: nx, y: ny, width: nw, height: nh });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const renderContent = () => {
    if (object.type === 'text') {
      return (
        <div
          ref={textRef}
          contentEditable
          suppressContentEditableWarning
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            // An emptied contentEditable div collapses to a lone <br>, whose
            // innerText reads as "\n" rather than "" - normalize that so a
            // cleared text box saves as genuinely empty, not a stray newline.
            const raw = e.currentTarget.innerText;
            onUpdate({ text: raw.trim() === '' ? '' : raw } as Partial<SlideObject>);
          }}
          className="w-full h-full outline-none overflow-hidden"
          style={{
            fontSize: object.fontSize,
            fontWeight: object.bold ? 700 : 400,
            color: object.color,
            textAlign: object.align,
            direction: 'rtl',
          }}
        >
          {object.text || ' '}
        </div>
      );
    }
    if (object.type === 'image') {
      return object.url ? (
        <img src={object.url} alt="" className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">תמונה</div>
      );
    }
    return (
      <div
        className="w-full h-full"
        style={{ backgroundColor: object.fill, borderRadius: object.shape === 'circle' ? '50%' : 4 }}
      />
    );
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        zIndex: object.zIndex,
        x,
        y,
        outline: selected ? '2px solid var(--primary, #2D5FF6)' : 'none',
        outlineOffset: 2,
        cursor: object.type === 'text' ? 'text' : 'move',
      }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
      onDragEnd={(_, info) => {
        onUpdate({ x: object.x + info.offset.x, y: object.y + info.offset.y });
        x.set(0);
        y.set(0);
      }}
    >
      {renderContent()}
      {selected && (
        <>
          {(['nw', 'ne', 'sw', 'se'] as ResizeCorner[]).map((corner) => (
            <div
              key={corner}
              onPointerDown={(e) => startResize(corner, e)}
              className="absolute w-3 h-3 bg-primary border border-white rounded-full"
              style={{
                cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                top: corner.includes('n') ? -6 : undefined,
                bottom: corner.includes('s') ? -6 : undefined,
                left: corner.includes('w') ? -6 : undefined,
                right: corner.includes('e') ? -6 : undefined,
              }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
}
