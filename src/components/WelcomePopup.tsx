import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// Every user sees the welcome card on their first two visits — existing users
// too, since nobody has the counter yet. Counted per user, per browser.
const MAX_SHOWS = 2;
const storageKey = (userId: string) => `a2c-welcome-shown:${userId}`;
// One show per page load, so leaving the dashboard (e.g. to /about) and coming
// back doesn't pop it again and burn the second show.
const shownThisLoad = new Set<string>();

const ICONS: [name: string, x: string, y: string, size: string, rotate: number][] = [
  ["whatsapp", "14%", "34%", "54px", -14], ["classroom", "74%", "10%", "58px", 10], ["drive", "10%", "62%", "56px", 8],
  ["webtop", "78%", "60%", "52px", -10], ["docs", "28%", "8%", "40px", 6], ["gemini", "58%", "70%", "48px", -6],
];

export function WelcomePopup({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [on, setOn] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    if (shownThisLoad.has(userId)) return;
    let count = 0;
    try { count = Number(localStorage.getItem(storageKey(userId))) || 0; } catch { return; /* private mode: skip */ }
    if (count >= MAX_SHOWS) return;
    shownThisLoad.add(userId);
    try { localStorage.setItem(storageKey(userId), String(count + 1)); } catch { /* private mode */ }
    setShow(true);
    timer.current = window.setTimeout(() => setOn(true), 60);
    return () => window.clearTimeout(timer.current);
  }, [userId]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  function close() {
    setOn(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 350);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div
        onClick={close}
        className="absolute inset-0 bg-[rgba(27,35,51,.42)] backdrop-blur-[6px] transition-opacity duration-[350ms]"
        style={{ opacity: on ? 1 : 0 }}
      />
      <div
        className="relative w-[min(420px,calc(100vw-32px))] rounded-[32px] bg-card border-[3px] border-card overflow-hidden shadow-[0_40px_80px_-30px_rgba(11,17,32,.55)]"
        style={{
          opacity: on ? 1 : 0,
          transform: on ? "translateY(0) scale(1)" : "translateY(24px) scale(.94)",
          transition: "opacity .4s ease, transform .5s cubic-bezier(.2,1.3,.4,1)",
        }}
      >
        <div className="relative h-[210px] bg-muted bg-[radial-gradient(hsl(var(--border))_1.1px,transparent_1.3px)] bg-[length:16px_16px]">
          {ICONS.map(([name, x, y, size, rotate], i) => (
            <img
              key={name}
              src={`/about/${name}.png`}
              alt=""
              className="absolute object-contain drop-shadow-[0_6px_10px_rgba(40,30,15,.22)]"
              style={{
                top: y, left: x, width: size, height: size,
                opacity: on ? 1 : 0,
                transform: on ? `rotate(${rotate}deg)` : `translate(${i % 2 ? -40 : 40}px, 30px) scale(.6)`,
                transition: "transform .7s cubic-bezier(.2,1.2,.4,1), opacity .5s ease",
              }}
            />
          ))}
          <div className="absolute top-1/2 left-1/2 w-[92px] h-[92px] rounded-[26px] bg-white border-[3px] border-white flex items-center justify-center overflow-hidden -translate-x-1/2 -translate-y-1/2 -rotate-[4deg] shadow-[0_14px_28px_-12px_rgba(27,35,51,.5)]">
            <img src="/logo.png" alt="App2Class" className="w-[76%] h-[76%] object-contain" />
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="סגירה"
            className="absolute top-3.5 left-3.5 w-9 h-9 rounded-full bg-card flex items-center justify-center font-heading font-bold text-xl leading-none text-muted-foreground shadow-[0_3px_8px_-4px_rgba(40,30,15,.35)]"
          >
            ×
          </button>
        </div>

        <div className="px-7 pt-[26px] pb-7 flex flex-col gap-[18px] text-center">
          <div className="self-center px-[11px] py-1.5 rounded-[9px] border-2 border-white bg-[#FFF0C2] text-[#7A5200] font-body font-extrabold text-[12.5px] leading-none -rotate-2 shadow-[0_2px_6px_-3px_rgba(40,30,15,.35)]">
            פעם ראשונה פה?
          </div>
          <div className="flex flex-col gap-2.5">
            <h2 id="welcome-title" className="font-heading font-black text-[26px] leading-[1.2] text-balance">כל בית הספר, באפליקציה אחת</h2>
            <p className="font-body font-semibold text-[15.5px] leading-normal text-muted-foreground text-pretty">
              וואטסאפ, קלאסרום, דרייב, וובטופ ועוד. ריכזנו הכול למקום אחד. מערכת שעות, ציונים, משימות וצ׳אט הכיתה, הכול במסך אחד.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              to="/about"
              className="flex items-center justify-center gap-2 px-[18px] py-[15px] rounded-2xl bg-foreground text-background hover:opacity-90 font-body font-extrabold text-base leading-none shadow-[0_10px_20px_-10px_rgba(27,35,51,.7)]"
            >
              קצת עלינו <span className="font-heading font-bold">←</span>
            </Link>
            <button
              type="button"
              onClick={close}
              className="px-[18px] py-[13px] rounded-2xl text-muted-foreground hover:bg-muted font-body font-extrabold text-[14.5px] leading-none"
            >
              אולי אחר כך
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
