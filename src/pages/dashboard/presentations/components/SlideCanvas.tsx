import { useState } from 'react';
import type { Slide, SlideObject } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';
import { CanvasObject } from './CanvasObject';
import { ObjectToolbar } from './ObjectToolbar';

interface Props {
  slide: Slide;
  onUpdateObject: (objectId: string, updates: Partial<SlideObject>) => void;
  onDeleteObject: (objectId: string) => void;
}

export function SlideCanvas({ slide, onUpdateObject, onDeleteObject }: Props) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const selectedObject = slide.objects.find((o) => o.id === selectedObjectId) || null;

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

      <div
        className="relative bg-white shadow-lg border border-border overflow-hidden"
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: slide.background }}
        onPointerDown={() => setSelectedObjectId(null)}
      >
        {slide.objects.map((obj) => (
          <CanvasObject
            key={obj.id}
            object={obj}
            selected={obj.id === selectedObjectId}
            onSelect={() => setSelectedObjectId(obj.id)}
            onUpdate={(updates) => onUpdateObject(obj.id, updates)}
          />
        ))}
      </div>
    </div>
  );
}
