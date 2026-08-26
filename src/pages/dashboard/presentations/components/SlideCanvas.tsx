import { forwardRef, useState } from 'react';
import type { Slide, SlideObject } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';
import { CanvasObject } from './CanvasObject';
import { ObjectToolbar } from './ObjectToolbar';
import type { GuideLine } from '../utils/snapping';

interface Props {
  slide: Slide;
  onUpdateObject?: (objectId: string, updates: Partial<SlideObject>) => void;
  onDeleteObject?: (objectId: string) => void;
  readOnly?: boolean;
  /** Visual zoom factor - the canvas always renders/interacts at native
   * 960x540 px internally (so drag/resize math and exports stay exact),
   * this only scales how large it appears on screen. Defaults to 1
   * (native size) for contexts that don't need fit-to-container sizing,
   * like the hidden off-screen node used for PDF export. */
  scale?: number;
}

export const SlideCanvas = forwardRef<HTMLDivElement, Props>(function SlideCanvas(
  { slide, onUpdateObject = () => {}, onDeleteObject = () => {}, readOnly = false, scale = 1 },
  ref
) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const selectedObject = !readOnly ? slide.objects.find((o) => o.id === selectedObjectId) || null : null;

  return (
    <div className="flex flex-col items-center gap-3">
      {selectedObject && (
        <ObjectToolbar
          object={selectedObject}
          onUpdate={(updates) => onUpdateObject(selectedObject.id, updates)}
          onDelete={() => {
            onDeleteObject(selectedObject.id);
            setSelectedObjectId(null);
          }}
        />
      )}

      {/* Outer box reserves the correctly-scaled layout footprint; the
          inner div stays at native 960x540 resolution and is visually
          shrunk/grown via transform, so pointer coordinates inside it
          still need dividing by `scale` (done in CanvasObject), but the
          ref used for export capture always sees full native pixels. */}
      <div className="shadow-sm ring-1 ring-border/80 rounded-sm overflow-hidden" style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}>
        <div
          ref={ref}
          className="relative bg-white"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            backgroundColor: slide.background,
            transform: `scale(${scale})`,
            transformOrigin: 'top right',
          }}
          onPointerDown={() => !readOnly && setSelectedObjectId(null)}
        >
          {slide.objects.map((obj) => (
            <CanvasObject
              key={obj.id}
              object={obj}
              siblings={slide.objects.filter((o) => o.id !== obj.id)}
              selected={obj.id === selectedObjectId}
              onSelect={() => setSelectedObjectId(obj.id)}
              onUpdate={(updates) => onUpdateObject(obj.id, updates)}
              onGuidesChange={setGuides}
              readOnly={readOnly}
              scale={scale}
            />
          ))}

          {!readOnly && guides.map((g, i) => (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={
                g.orientation === 'v'
                  ? { left: g.pos, top: 0, width: 0, height: '100%', borderRight: '1px dashed #ec4899' }
                  : { top: g.pos, left: 0, height: 0, width: '100%', borderBottom: '1px dashed #ec4899' }
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
});
