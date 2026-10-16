import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import template from "./about/aboutTemplate.html?raw";
import { aboutValues } from "./about/aboutLogic";
import { TemplateView } from "./about/TemplateView";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * About: the scroll story from the About design. Objects become one phone,
 * school apps become App2Class. Scroll progress drives every frame; the
 * wheel is eased the same way the design does it.
 */
const AboutPage = () => {
  const navigate = useNavigate();
  const [p, setP] = useState(0);
  const [size, setSize] = useState({ vw: window.innerWidth, vh: window.innerHeight });
  const [role, setRole] = useState({ i: 0, t: null as number | null });
  const [, kick] = useState(0);
  const target = useRef(0);
  const pRef = useRef(0);

  // The design's page background (no app dot grid; the story draws its own).
  useEffect(() => {
    const body = document.body.style;
    const prev = { bg: body.background, img: body.backgroundImage };
    body.background = "#F7F3EC";
    body.backgroundImage = "none";
    return () => { body.background = prev.bg; body.backgroundImage = prev.img; };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target.current = max > 0 ? clamp01(window.scrollY / max) : 0;
    };
    const onResize = () => { setSize({ vw: window.innerWidth, vh: window.innerHeight }); onScroll(); };

    // Eased wheel scrolling.
    let sy = window.scrollY, syT = sy, wheeling = false;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (!wheeling) { sy = window.scrollY; syT = sy; }
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      syT = Math.max(0, Math.min(max, syT + dy * 0.9));
      wheeling = true;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);
    onResize();

    let last = performance.now(), raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (wheeling) {
        sy += (syT - sy) * (1 - Math.exp(-dt / 0.11));
        if (Math.abs(syT - sy) < 0.5) { sy = syT; wheeling = false; }
        window.scrollTo(0, sy);
      }
      const d = target.current - pRef.current;
      if (Math.abs(d) > 0.00015) {
        pRef.current += d * (1 - Math.exp(-dt / 0.09));
        setP(pRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const values = aboutValues({
    p, vw: size.vw, vh: size.vh, role: role.i, roleT: role.t,
    pickRole: (i) => setRole({ i, t: performance.now() }),
    kick: () => requestAnimationFrame(() => kick((n) => n + 1)),
  });

  return (
    <div dir="rtl" className="about-story">
      <TemplateView
        html={template}
        values={values}
        onLink={(href, e) => { e.preventDefault(); navigate(href); }}
      />
    </div>
  );
};

export default AboutPage;
