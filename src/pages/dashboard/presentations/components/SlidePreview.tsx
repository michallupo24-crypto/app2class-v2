import type { Slide } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';

interface Props {
  slide: Slide;
  className?: string;
}

/**
 * Fluid, percentage-positioned render of a slide - fills whatever box its
 * container gives it (a fixed-size wrapper, or an `aspect-video` box), so
 * it works both for the slide sorter's fixed-width thumbnails and the
 * dashboard's responsive deck cards without any JS size measurement.
 * Font sizes use container query width units (cqw) so text scales with
 * the container itself.
 */
export function SlidePreview({ slide, className = '' }: Props) {
  return (
    <div
      className={`relative overflow-hidden w-full h-full ${className}`}
      style={{ backgroundColor: slide.background, containerType: 'inline-size' } as React.CSSProperties}
    >
      {slide.objects.map((obj) => (
        <div
          key={obj.id}
          className="absolute overflow-hidden"
          style={{
            left: `${(obj.x / CANVAS_WIDTH) * 100}%`,
            top: `${(obj.y / CANVAS_HEIGHT) * 100}%`,
            width: `${(obj.width / CANVAS_WIDTH) * 100}%`,
            height: `${(obj.height / CANVAS_HEIGHT) * 100}%`,
          }}
        >
          {obj.type === 'text' && (
            <div
              style={{
                fontSize: `${(obj.fontSize / CANVAS_WIDTH) * 100}cqw`,
                fontWeight: obj.bold ? 700 : 400,
                color: obj.color,
                textAlign: obj.align,
              }}
            >
              {obj.text}
            </div>
          )}
          {obj.type === 'image' && obj.url && <img src={obj.url} alt="" className="w-full h-full object-contain" />}
          {obj.type === 'shape' && (
            <div className="w-full h-full" style={{ backgroundColor: obj.fill, borderRadius: obj.shape === 'circle' ? '50%' : 2 }} />
          )}
        </div>
      ))}
    </div>
  );
}
