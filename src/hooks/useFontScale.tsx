import { createContext, useContext, useEffect, useState } from "react";

// Tailwind's font-size AND spacing scales are both rem-based by default, so
// scaling the root font-size zooms text, padding, gaps, and sizes together
// proportionally - text grows without overflowing its card, unlike scaling
// font-size alone would.
export type FontScale = 100 | 112 | 125 | 137;
const SCALES: FontScale[] = [100, 112, 125, 137];

interface FontScaleCtx {
  scale: FontScale;
  setScale: (s: FontScale) => void;
}

const FontScaleContext = createContext<FontScaleCtx>({
  scale: 100,
  setScale: () => {},
});

export const FontScaleProvider = ({ children }: { children: React.ReactNode }) => {
  const [scale, setScaleState] = useState<FontScale>(() => {
    const stored = Number(localStorage.getItem("app2class-font-scale"));
    return (SCALES as number[]).includes(stored) ? (stored as FontScale) : 100;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${scale}%`;
    localStorage.setItem("app2class-font-scale", String(scale));
  }, [scale]);

  const setScale = (s: FontScale) => setScaleState(s);

  return (
    <FontScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </FontScaleContext.Provider>
  );
};

export const useFontScale = () => useContext(FontScaleContext);
