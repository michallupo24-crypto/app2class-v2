import { useRef } from 'react';
import type { SlideObject, TextFontFamily } from '../types';
import { computeSnap, type GuideLine } from '../utils/snapping';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';

const MIN_SIZE = 20;

export const FONT_FAMILY_CSS: Record<TextFontFamily, string> = {
  heading: "'Rubik', sans-serif",
  body: "'Assistant', sans-serif",
  serif: "'Frank Ruhl Libre', serif",
};

interface Props {
  object: SlideObject;
  siblings: SlideObject[];
  selected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<SlideObject>) => void;
  onGuidesChange?: (guides: GuideLine[]) => void;
  readOnly?: boolean;
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export function CanvasObject({ object, siblings, selected, onSelect, onUpdate, onGuidesChange, readOnly = false }: Props) {
  const textRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.PointerEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: object.x, y: object.y, width: object.width, height: object.height };

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const candidate = { x: start.x + dx, y: start.y + dy, width: start.width, height: start.height };
      const { x, y, guides } = computeSnap(candidate, siblings, CANVAS_WIDTH, CANVAS_HEIGHT);
      onUpdate({ x, y });
      onGuidesChange?.(guides);
    };
    const onUp = () => {
      onGuidesChange?.([]);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onPointerDown={(e) => {
            // Still stop propagation (so the parent's drag gesture doesn't
            // hijack a click meant to place the text cursor), but select
            // explicitly here too - otherwise text objects could never be
            // selected at all, and the font/bold/color toolbar (which only
            // renders for a selected object) was permanently unreachable
            // for text, the one object type it matters most for.
            e.stopPropagation();
            if (!readOnly) onSelect();
          }}
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
            fontFamily: FONT_FAMILY_CSS[object.fontFamily ?? 'body'],
            direction: 'rtl',
          }}
        >
          {object.text || ' '}
        </div>
      );
    }
    if (object.type === 'image') {
      return object.url ? (
        <img
          src={object.url}
          alt=""
          className="w-full h-full object-contain pointer-events-none select-none"
          draggable={false}
          style={{
            borderRadius: object.cornerRadius ?? 0,
            boxShadow: object.shadow ? '0 8px 24px -8px rgba(0,0,0,0.35)' : undefined,
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">תמונה</div>
      );
    }
    return (
      <div
        className="w-full h-full"
        style={{
          backgroundColor: object.fill,
          borderRadius: object.shape === 'circle' ? '50%' : (object.cornerRadius ?? 4),
          boxShadow: object.shadow ? '0 8px 24px -8px rgba(0,0,0,0.35)' : undefined,
          border: object.borderWidth ? `${object.borderWidth}px solid ${object.borderColor ?? '#000000'}` : undefined,
        }}
      />
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        zIndex: object.zIndex,
        opacity: object.opacity ?? 1,
        outline: selected && !readOnly ? '2px solid var(--primary, #2D5FF6)' : 'none',
        outlineOffset: 2,
        cursor: readOnly ? 'default' : object.type === 'text' ? 'text' : 'move',
        touchAction: 'none',
      }}
      onPointerDown={startDrag}
    >
      {renderContent()}
      {selected && !readOnly && (
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
    </div>
  );
}
