import React from 'react';

interface RulerProps {
  margins: { left: number; right: number };
  onMarginChange?: (left: number, right: number) => void;
  widthPx?: number;
}

export const Ruler: React.FC<RulerProps> = ({ margins, widthPx = 800 }) => {
  // Generate ruler marks (cm ticks)
  const totalCm = 21; // Standard A4 width is 21cm
  const ticks = Array.from({ length: totalCm * 2 + 1 });

  return (
    <div className="w-full flex justify-center bg-gray-100 border-b border-gray-200 py-0.5 select-none overflow-hidden shrink-0">
      <div 
        style={{ width: `${widthPx}px` }} 
        className="h-4 bg-white border border-gray-200 rounded-xs shadow-2xs relative flex items-end justify-between px-2 text-[9px] font-mono text-gray-400"
      >
        {/* Shaded margin left */}
        <div 
          style={{ width: `${margins.left * 3}px` }} 
          className="absolute right-0 top-0 bottom-0 bg-gray-100 border-l border-gray-300"
          title="שוליים ימניים"
        />

        {/* Shaded margin right */}
        <div 
          style={{ width: `${margins.right * 3}px` }} 
          className="absolute left-0 top-0 bottom-0 bg-gray-100 border-r border-gray-300"
          title="שוליים שמאליים"
        />

        {/* Cm ticks */}
        <div className="w-full flex justify-between items-end px-4 z-10">
          {ticks.map((_, index) => {
            const cm = index / 2;
            const isMajor = index % 2 === 0;
            return (
              <div key={index} className="flex flex-col items-center">
                {isMajor && <span className="leading-none mb-0.5 text-[8px]">{cm}</span>}
                <div className={`bg-gray-300 ${isMajor ? 'h-2 w-[1px]' : 'h-1 w-[1px]'}`} />
              </div>
            );
          })}
        </div>

        {/* Indent Stop Marker */}
        <div 
          style={{ right: `${margins.left * 3}px` }} 
          className="absolute top-0 transform translate-x-1/2 w-2 h-2 border-l-4 border-r-4 border-b-6 border-l-transparent border-r-transparent border-b-blue-600 cursor-ew-resize z-20"
          title="סמן פסקה ראשונה"
        />
      </div>
    </div>
  );
};
