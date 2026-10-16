// Scroll-driven "About" story, ported from the App2Class About design.
// aboutValues() turns scroll progress (and the chosen role) into every value
// the template (aboutTemplate.html) binds to; AboutPage drives it each frame.
/* eslint-disable */

const CH = [
  { title: 'המפה הפכה לניווט', body: 'במקום מפה מקופלת בתא הכפפות, הדרך מחכה בכיס.' },
  { title: 'הטלפון יצא מהקיר', body: 'שיחה כבר לא מחכה בבית, ליד השפופרת.' },
  { title: 'העיתון הפך לפיד', body: 'החדשות מגיעות עוד לפני שהעיתון יוצא לדפוס.' },
  { title: 'העט הפך לפתקים', body: 'רשימות, תזכורות וחתימות, בלי לחפש עט בתיק.' },
  { title: 'המצלמה נכנסה לכיס', body: 'כל רגע מצולם, בלי פילם ובלי פיתוח.' },
  { title: 'רב-קו הפך לאפליקציה', body: 'משלמים על הנסיעה בהצמדת הטלפון.' },
  { title: 'המכתב הפך להודעה', body: 'במקום לחכות לדוור, ההודעה מגיעה בשנייה.' },
  { title: 'נגן ה-MP3 הפך לפלייליסט', body: 'כל השירים בכיס, בלי כבל סנכרון ובלי לבחור מה נכנס.' }
];
const OBJ = ['מפה','טלפון','עיתון','עט','מצלמה','רב-קו','מכתב','נגן MP3'];
const MHERO = [[-0.72,-0.78,-8],[0,-0.86,10],[0.72,-0.74,6],[-0.42,-0.06,-30],[0.42,-0.02,-6],[-0.72,0.7,8],[0,0.8,-4],[0.72,0.66,9]];
const HERO = [[190,190,-10],[1100,180,12],[1110,560,7],[170,560,40],[400,690,-7],[880,690,9],[640,110,-4],[430,185,8]];
const ICON1 = [
  { name: 'מפות', c: '#23B26D', gw: '22px', gh: '22px', gr: '999px 999px 999px 0' },
  { name: 'טלפון', c: '#14B8A6', gw: '26px', gh: '12px', gr: '999px' },
  { name: 'חדשות', c: '#E5484D', gw: '26px', gh: '30px', gr: '4px' },
  { name: 'פתקים', c: '#FBBE24', gw: '28px', gh: '6px', gr: '999px' },
  { name: 'מצלמה', c: '#1B2333', gw: '24px', gh: '24px', gr: '999px' },
  { name: 'ארנק', c: '#1268E8', gw: '30px', gh: '20px', gr: '5px' },
  { name: 'דואר', c: '#9257EC', gw: '30px', gh: '20px', gr: '3px' },
  { name: 'מוזיקה', c: '#EE5A8F', gw: '14px', gh: '24px', gr: '999px' }
];
const COLS2 = [228, 138, 48], ROW2 = 162, ROWH2 = 76;
const H = 'logos/hd/';
const LOGO = {
  ofek: { src: '/about/ofek.png', w: 150, h: 50, r: '999px', fill: '#FFFFFF', pad: '9px 18px' },
  webtop: { src: '/about/webtop.png', w: 58, h: 58, r: '9px', fit: 'cover' },
  whatsapp: { src: '/about/whatsapp.png', w: 60, h: 60, flat: true },
  classroom: { src: '/about/classroom.png', w: 64, h: 55, r: '6px' },
  drive: { src: '/about/drive.png', w: 62, h: 55, flat: true },
  galim: { src: '/about/galim.png', w: 150, h: 50, r: '999px', fill: '#FFFFFF', pad: '4px 16px' },
  docs: { src: '/about/docs.png', w: 44, h: 60, flat: true },
  ppt: { src: '/about/ppt.png', w: 60, h: 58, flat: true },
  smile: { src: '/about/smile.png', w: 58, h: 58, r: '16px', fit: 'cover' },
  check: { src: '/about/check.png', w: 60, h: 59, flat: true },
  speak: { src: '/about/speak.png', w: 116, h: 54, r: '999px', fill: '#00A2F2', pad: '0 6px' },
  q: { src: '/about/q.png', w: 58, h: 58, r: '999px', fit: 'cover' },
  gemini: { src: '/about/gemini.png', w: 58, h: 58, flat: true },
  classoos: { src: '/about/classoos.png', w: 58, h: 58, r: '14px', fit: 'cover' }
};
// [file, name, badge, col (0-2 or 'wide'), row]
const ICON2 = [
  ['ofek', 'אופק', '3', 'w0', 0], ['webtop', 'Webtop', '7', 2, 0],
  ['whatsapp', 'WhatsApp', '99+', 0, 1], ['classroom', 'Classroom', '4', 1, 1], ['drive', 'Drive', '', 2, 1],
  ['galim', 'גלים PRO', '2', 'w1', 2], ['docs', 'Docs', '5', 2, 2],
  ['ppt', 'PowerPoint', '', 0, 3], ['smile', 'App', '1', 1, 3], ['check', 'Check', '6', 2, 3],
  ['speak', 'Speak2Go', '', 'w0', 4], ['q', 'Q', '2', 2, 4],
  ['gemini', 'Gemini', '', 0, 5], ['classoos', 'classoos', '1', 1, 5]
].map(([f, name, badge, col, row]) => {
  const wide = typeof col === 'string';
  const x = wide ? 179 : COLS2[col];
  const st = LOGO[f];
  return { src: st.src, name, badge, x, y: ROW2 + row * ROWH2, w: wide ? 156 : 64,
    bw: `${st.w}px`, bh: `${st.h}px`, r: st.r || '0', fill: st.fill || 'transparent', pad: st.pad || '0', fit: st.fit || 'contain', sh: st.flat ? 'none' : '0 8px 18px -12px rgba(40,30,15,.5)' };
});
const TILES = [['#9257EC', 'הנחיות מהמורה', 'משימות'], ['#FBBE24', 'מחר בשיעור 2 · 08:50', 'מערכת'], ['#1268E8', 'ציון בעבודה הקודמת: 88', 'ציונים'], ['#23B26D', 'המורה: אפשר לשאול כאן', 'צ׳אט']];
const COLS = [220, 138, 56], ROW0 = 180, ROWH = 100, CX = 138, CY = 300;

const N = 8, C0 = 0.07, C1 = 0.50, CW = (C1 - C0) / N;
const cl = x => Math.max(0, Math.min(1, x));
const seg = (p, a, b) => cl((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const MOTION = {
  move: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  pull: t => t * t * t,
  pop: t => t <= 0 ? 0 : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)
};
const pos = i => ({ x: COLS[i % 3], y: ROW0 + Math.floor(i / 3) * ROWH });

export interface AboutState {
  p: number;
  vw: number;
  vh: number;
  role: number;
  roleT: number | null;
  pickRole: (i: number) => void;
  kick: () => void;
}

export function aboutValues(st: AboutState, props: { pace?: number; smoothScroll?: boolean; dotGrid?: boolean } = {}): Record<string, any> {
    const hp = /[#&]p=([\d.]+)/.exec(location.hash);
    const P = hp ? +hp[1] : st.p, B = 0.2, AT = 0.56, raw = P * (1 + B);
    const p = raw < AT ? raw : raw < AT + B ? AT : raw - B;
    const bt2 = raw < AT ? 0 : raw < AT + B ? (raw - AT) / B : 1;
    const bt = Math.min(1, bt2 / 0.72), qt = MOTION.move(seg(bt2, 0.74, 0.88));
    const inBeat = bt2 > 0 && bt2 < 1;
    const pace = props.pace ?? 100;
    const s = Math.max(0.1, Math.min((st.vw || 1280) / 1280, (st.vh || 800) / 800));
    const tOf = i => (p - C0 - i * CW) / CW;
    const out = {};

    const mobV = (st.vw || 1280) < 760 && (st.vh || 800) > (st.vw || 1280);
    // Act 1 — objects into phone
    const k = MOTION.move(seg(p, 0.035, 0.08));
    let active = -1;
    for (let i = 0; i < N; i++) {
      const t = tOf(i);
      if (t >= 0 && t < 1) active = i;
      const [hx, hy, hr] = HERO[i];
      const drift = seg(p, 0, 0.04) * (1 - k);
      let x = lerp(hx + (hx - 640) * 0.12 * drift, 1180 - i * 150, k);
      let y = lerp(hy + (hy - 400) * 0.12 * drift, 738, k);
      let r = lerp(hr, hr * 0.3, k);
      let sc = lerp(0.85, 0.42, k);
      const e1 = MOTION.move(seg(t, 0, 0.3));
      x = lerp(x, 300, e1); y = lerp(y, 390, e1); sc = lerp(sc, 1.2, e1); r = lerp(r, -4, e1);
      y -= 10 * Math.sin(Math.PI * seg(t, 0.3, 0.5));
      const e2 = MOTION.pull(seg(t, 0.5, 0.7));
      x = lerp(x, 640, e2); y = lerp(y, 380, e2); sc = lerp(sc, 0.1, e2); r = lerp(r, r + 25, e2);
      let op = 1 - seg(t, 0.62, 0.7);
      if (bt > 0) {
        const slot = { 4: 0, 0: 1, 6: 2 }[i];
        if (slot === undefined) op = 0;
        else {
          const e = MOTION.move(seg(bt, 0.03 + slot * 0.03, 0.13 + slot * 0.03));
          x = lerp(960, [470, 360, 250][slot], e); y = lerp(470, [450, 485, 455][slot], e); sc = lerp(0.1, 0.62, e); r = lerp(0, [-12, 6, 14][slot], e);
          op = cl(e * 3) * (1 - 0.55 * seg(bt, 0.42, 0.5)) * (1 - seg(bt2, 0.93, 0.99));
        }
      }
      if (mobV) {
        if (bt > 0) {
          const slot = { 4: 0, 0: 1, 6: 2 }[i];
          if (slot !== undefined) {
            const e = MOTION.move(seg(bt, 0.03 + slot * 0.03, 0.13 + slot * 0.03));
            x = lerp(640, [760, 640, 520][slot], e); y = lerp(560, [135, 160, 130][slot], e);
          }
        } else if (t < 0) { const [u, v, mr] = MHERO[i]; const mZ = (st.vh || 800) * 0.63, msm = Math.min(mZ / 670, (st.vw || 390) / 330); const hw = (st.vw || 390) / msm / 2, hh = mZ / msm / 2; const msc = Math.min(0.62, hw / 330); const mx = 640 + u * (hw - 130 * msc - 10), my = 455 + v * (hh - 120 * msc - 10); const d = seg(p, 0, 0.035); x = lerp(mx, 640, k * 0.5); y = lerp(my - d * 14, 455, k * 0.5); sc = msc * (1 - 0.4 * k); r = mr; op = 1 - k; }
        else {
          const f1 = MOTION.move(seg(t, 0, 0.3)), f2 = MOTION.pull(seg(t, 0.5, 0.72));
          x = 640; y = lerp(lerp(60, 130, f1), 430, f2); sc = lerp(0.5, 0.85, f1) * lerp(1, 0.12, f2); r = lerp(hr * 0.4, -3, f1) + f2 * 20;
          op = f1 * (1 - seg(t, 0.62, 0.7));
        }
      }
      out['o' + i] = { tf: `translate(${x - 130}px, ${y - 130}px) rotate(${r}deg) scale(${sc})`, op, z: active === i ? 25 : 10 };
    }
    const a1Out = seg(p, 0.565, 0.6);
    out.icons1 = ICON1.map((ic, i) => {
      const { x, y } = pos(i);
      const pin = MOTION.pop(seg(tOf(i), 0.68, 0.8));
      const sc = pin * (1 - a1Out * 0.6);
      return { ...ic, left: `${x - 42}px`, top: `${y - 31}px`, op: cl(pin) * (1 - a1Out) * (1 - seg(bt, 0.44, 0.5)), tf: `scale(${sc * (1 - 0.3 * seg(bt, 0.44, 0.5))})` };
    });

    // Integration beat
    const bIn = MOTION.move(seg(bt, 0, 0.1)), bOut = MOTION.move(seg(bt2, 0.93, 1));
    const vis = bIn * (1 - bOut), dimL = 1 - 0.55 * seg(bt, 0.42, 0.5);
    out.bHead2 = { op: qt * (1 - bOut), tf: `translateY(${(1 - qt) * 20 - bOut * 14}px)` };
    out.bHead = { op: vis * (1 - qt), tf: `translateY(${(1 - bIn) * 20 - bOut * 14}px)` };
    out.bDiv = vis;
    out.bTapes = [[-8, -18], [14, 22]].map(([rot, dy], i) => {
      const a = MOTION.move(seg(bt, 0.15 + i * 0.05, 0.22 + i * 0.05));
      return { op: a > 0 ? dimL * (1 - bOut) : 0, tf: `${mobV ? 'translate(280px, -322px) ' : ''}translateY(${dy}px) rotate(${rot}deg) scaleX(${a})` };
    });
    out.bArrows = [434, 249].map((x, i) => ({ x: `${x}px`, op: seg(bt, 0.26 + i * 0.05, 0.3 + i * 0.05) * dimL * (1 - bOut) }));
    out.steps = [['1', 'מצלמים', 0.24], ['2', 'מסמנים במפה', 0.29], ['3', 'שולחים מכתב', 0.34]].map(([n, label, a0], i) => {
      const a = MOTION.pop(seg(bt, a0, a0 + 0.05));
      return { n, label, x: `${540 - i * 185 - 70}px`, op: cl(a) * dimL * (1 - bOut), tf: `scale(${a})` };
    });
    const la = MOTION.move(seg(bt, 0.36, 0.42)), lb = MOTION.move(seg(bt, 0.8, 0.86));
    out.lblA = { op: la * (1 - bOut), tf: `translate(-50%, ${(1 - la) * 12}px)` };
    out.lblB = { op: lb * (1 - bOut), tf: `translate(-50%, ${(1 - lb) * 12}px)` };
    const gone = 1 - seg(bt2, 0.93, 0.99);
    const cardA = MOTION.move(seg(bt, 0.48, 0.56));
    out.cardOp = cardA * gone;
    out.cardTf = `translateY(${(1 - cardA) * 30}px) scale(${lerp(0.92, 1, cardA)})`;
    const chipIn = i => MOTION.pop(seg(bt, 0.56 + i * 0.05, 0.62 + i * 0.05));
    out.ch0 = { op: cl(chipIn(0)), tf: `scale(${chipIn(0)})`, fl: `blur(${(1 - qt) * 3.5}px) saturate(${0.5 + qt * 0.7})`, badge: qt > 0.5 ? 'צילום חד' : 'מהמצלמה' };
    out.chips = [
      ['#23B26D', qt > 0.5 ? 'ניווט חי · 12 דק׳ הליכה' : 'נפגשים בתחנה המרכזית', 'מפות']
    ].map(([c, text, src], i) => { const a = chipIn(i + 1); return { c, text, src, op: cl(a), tf: `translateX(${(1 - cl(a)) * -20}px) scale(${0.9 + 0.1 * a})` }; });
    out.sendOp = seg(bt, 0.66, 0.72);
    out.qGlow = `0 0 0 ${qt * 3}px rgba(35,178,109,${qt * 0.5})`;

    // Act 2 — school apps merge
    out.icons2 = ICON2.map((ic, j) => {
      const { x, y } = ic;
      const pin = MOTION.pop(seg(p, 0.6 + j * 0.006, 0.62 + j * 0.006));
      const m = MOTION.pull(seg(p, 0.7 + j * 0.004, 0.755 + j * 0.004));
      const dx = (CX - x) * m, dy = (CY - y) * m;
      return { ...ic, bg: `url(${ic.src})`, w: `${ic.w}px`, badge: ic.badge || null, left: `${x - ic.w / 2}px`, top: `${y - 29}px`, op: cl(pin) * (1 - seg(m, 0.75, 1)), tf: `translate(${dx}px, ${dy}px) scale(${pin * (1 - 0.65 * m)}) rotate(${m * (j % 2 ? 30 : -30)}deg)` };
    });
    const a2c = MOTION.pop(seg(p, 0.765, 0.8));
    const tap = Math.sin(Math.PI * seg(p, 0.825, 0.845)) * 0.12;
    const appO = seg(p, 0.84, 0.87);
    out.a2cOp = cl(a2c) * (1 - appO);
    out.a2cTf = `scale(${a2c * (1 - tap)})`;
    const ROLES = [
      { label: 'תלמיד/ה', cta: 'כניסה כתלמיד/ה', c: '#1268E8', hello: 'שלום, נועה', sub: 'תיכון הדר · י״א 3', heroS: 'עכשיו · שיעור 3', heroB: 'מתמטיקה · חדר 108', insT: 'תובנת מנטור לשבוע', ins: 'המבחן במתמטיקה ביום חמישי. כדאי לחזור כבר היום על פרק 4, שבו הציון האחרון היה נמוך.', alT: 'המבחן הקרוב', alB: 'מתמטיקה · 5 יח״ל', alP: 'בעוד 3 ימים', listT: 'מה קורה השבוע', list: [['הגשה · עבודה בספרות', 'שני', '#EAF1FE'], ['טיול שכבתי', 'רביעי', '#F4EEFC']] },
      { label: 'הורה', cta: 'כניסה כהורה', c: '#23B26D', hello: 'שלום, דנה', sub: 'אמא של נועה · י״א 3', heroS: 'נועה עכשיו', heroB: 'מתמטיקה · נוכחת', insT: 'סיכום שבועי על נועה', ins: 'נועה הגישה 4 מתוך 5 משימות השבוע. נשארה עבודה בספרות להגשה ביום שני.', alT: 'אישור הורים', alB: 'טיול שכבתי · יום רביעי', alP: 'לאישור', listT: 'הודעות מבית הספר', list: [['המחנכת: אסיפת הורים', 'ראשון', '#E3F6EC'], ['ציון חדש במתמטיקה: 88', 'אתמול', '#EAF1FE']] },
      { label: 'צוות', cta: 'כניסה כצוות', c: '#9257EC', hello: 'שלום, רונית', sub: 'מחנכת י״א 3 · מתמטיקה', heroS: 'השיעור הבא · 10:15', heroB: 'י״א 3 · חדר 108', insT: 'תובנה על הכיתה', ins: '6 תלמידים עוד לא הגישו את המשימה בפרק 4. אפשר לשלוח להם תזכורת מכאן.', alT: 'נוכחות', alB: 'י״א 3 · שיעור 3', alP: '2 חסרים', listT: 'משימות לבדיקה', list: [['מבחן פרק 4 · 31 עבודות', 'עד חמישי', '#F4EEFC'], ['טופס טיול · 4 חסרים', 'רביעי', '#FDF3DA']] },
      { label: 'הנהלה', cta: 'כניסה כהנהלה', c: '#C98A00', hello: 'שלום, אבי', sub: 'מנהל · תיכון הדר', heroS: 'נוכחות היום', heroB: '94% · 812 תלמידים', insT: 'תובנה לשבוע', ins: 'הנוכחות בשכבת י׳ ירדה ב-5% מאז החג. כדאי לבדוק עם רכזת השכבה.', alT: 'דורש טיפול', alB: 'מורה מחליף לשיעור 5', alP: 'פתוח', listT: 'אירועים השבוע', list: [['ישיבת צוות', 'שני', '#FDF3DA'], ['טיול שכבתי י״א', 'רביעי', '#F4EEFC']] }
    ];
    const ro = ROLES[st.role];
    out.rd = { ...ro, href: ['/register/student', '/register/parent', '/register/staff', '/register/staff'][st.role], list: ro.list.map(([t, d, bg]) => ({ t, d, bg })) };
    out.roleBtns = ROLES.map((r, i) => {
      const on = st.role === i;
      return { label: r.label, tbg: on ? r.c : 'transparent', tc: on ? '#FFFFFF' : '#1B2333', on: on ? 'true' : 'false', bd: on ? `2px solid ${r.c}` : '1px solid #E3DCCF', sh: on ? `0 10px 24px -16px ${r.c}` : 'none', pick: e => { e.preventDefault(); st.pickRole(i); } };
    });
    out.appOp = appO;
    out.appTf = `scale(${lerp(0.3, 1, MOTION.move(appO))})`;
    const since = st.roleT ? (performance.now() - st.roleT) / 1000 : 9;
    [0, 1, 2, 3, 4].forEach(i => { const sw = MOTION.move(cl((since - i * 0.04) / 0.28)); const a = MOTION.move(seg(p, 0.86 + i * 0.01, 0.885 + i * 0.01)) * sw; out['r' + i] = { op: a, tf: `translateY(${(1 - a) * 12}px)` }; });
    if (since < 0.6) st.kick();
    out.appTiles = TILES.map(([c, text, mod], i) => {
      const a = MOTION.move(seg(p, 0.86 + i * 0.012, 0.885 + i * 0.012));
      return { c, text, mod, op: a, tf: `translateY(${(1 - a) * 12}px)` };
    });

    // phone
    const rise = MOTION.move(seg(p, 0.035, 0.09));
    const fin = MOTION.move(seg(p, 0.885, 0.94));
    let bump = 0, flash = 0;
    for (let i = 0; i < N; i++) {
      bump += Math.sin(Math.PI * seg(tOf(i), 0.66, 0.8)) * 0.035;
      flash += Math.sin(Math.PI * seg(tOf(i), 0.64, 0.74)) * 0.45;
    }
    bump += Math.sin(Math.PI * seg(p, 0.765, 0.8)) * 0.05;
    flash += Math.sin(Math.PI * seg(p, 0.76, 0.78)) * 0.6;
    const shake = Math.sin(p * 900) * 3 * Math.sin(Math.PI * seg(p, 0.64, 0.7));
    const px = (mobV ? 640 : lerp(640, 440, fin)) + shake, py = lerp(1150, mobV ? 470 : 380, rise);
    const bm = MOTION.move(seg(bt, 0, 0.1)) * (1 - MOTION.move(seg(bt2, 0.93, 1)));
    const bpx = lerp(px, mobV ? 640 : 960, bm), bpy = lerp(py, mobV ? 520 : 470, bm), bps = lerp(lerp(0.95, 1.04, fin) + bump, 0.82, bm);
    out.phoneTf = `translate(${bpx - 150}px, ${bpy - 310}px) rotate(${lerp(10, 0, rise)}deg) scale(${bps})`;
    out.flash = flash;

    // captions
    const span = (a, b, f = 0.012) => seg(p, a, a + f) * (1 - seg(p, b - f, b));
    const caps = CH.map((c, i) => {
      const a0 = C0 + i * CW;
      return { tag: String(i + 1).padStart(2, '0'), eyebrow: OBJ[i], title: c.title, body: c.body, a: a0 + CW * 0.02, b: a0 + CW * 0.98, tagBg: '#EFE9DE', tagC: '#5B5548' };
    });
    caps.push({ tag: 'הטלפון', eyebrow: 'סיכום', title: 'טלפון אחד במקום תיק שלם.', body: 'הטלפון לא המציא צרכים חדשים. הוא איחד את מה שכבר סחבנו איתנו.', a: 0.505, b: 0.56, tagBg: '#EFE9DE', tagC: '#5B5548' });
    caps.push({ tag: 'בית הספר', eyebrow: 'ואז', title: 'כל צורך קיבל אפליקציה משלו.', body: 'אופק, Webtop, WhatsApp, Classroom, Drive, גלים ועוד. תלמידים, הורים וצוות קופצים בין כולן.', a: 0.585, b: 0.705, tagBg: '#FDE2E2', tagC: '#B42318' });
    caps.push({ tag: 'App2Class', eyebrow: 'מאחדים', title: 'מה שהטלפון עשה לחפצים, App2Class עושה לאפליקציות.', body: 'מערכת ניהול בית ספרית אחת: מערכת שעות, ציונים, משימות, נוכחות ושיחות, שמכירים זה את זה.', a: 0.71, b: 0.875, tagBg: '#EAF1FE', tagC: '#2F5FB8' });
    out.caps = caps.map(c => {
      const o = span(c.a, c.b);
      const inT = seg(p, c.a, c.a + 0.012);
      return { ...c, op: o, tf: `translateY(${(1 - inT) * 24 - seg(p, c.b - 0.012, c.b) * 16}px)` };
    });
    const bcap = (tag, eyebrow, title, body, a, b, bg, fg) => {
      const i = seg(bt, a, a + 0.06), o = seg(bt, b - 0.06, b);
      return { tag, eyebrow, title, body, tagBg: bg, tagC: fg, op: i * (1 - o), tf: `translateY(${(1 - i) * 24 - o * 16}px)` };
    };

    const hOut = seg(p, 0.02, 0.05);
    out.heroOp = 1 - hOut;
    out.heroTf = `translateY(${-hOut * 40}px)`;
    out.hintOp = 1 - seg(p, 0, 0.02);
    const f = seg(p, 0.9, 0.95);
    out.finOp = f;
    out.finTf = `translateY(${(1 - f) * 24}px)`;
    out.finPE = f > 0.5 ? 'auto' : 'none';

    out.progW = `${p * 100}%`;
    out.act1C = p < 0.5 ? '#1B2333' : '#7A7468';
    out.act2C = p >= 0.5 ? '#1B2333' : '#7A7468';
    const vw = st.vw || 1280, vh = st.vh || 800;
    const mob = vw < 760 && vh > vw, desk = mob ? 0 : 1;
    out.mob = mob; out.deskOp = desk; out.stageClip = mob ? 'inset(0)' : 'none';
    out.m = { hero: out.heroOp, bh: Math.max(0, out.bHead.op * 2 - 1), bh2: Math.max(0, out.bHead2.op * 2 - 1), fin: out.finOp };
    out.phoneOp = 1;
    if (mob) {
      out.heroOp = 0; out.hintOp = 0; out.finOp = 0;
      out.bHead = { ...out.bHead, op: 0 }; out.bHead2 = { ...out.bHead2, op: 0 };
      const fo = seg(p, 0.885, 0.93);
      const Z = lerp(vh * 0.63, Math.min(vh * 0.58, vh - 50 - 236), fo), cy = 50 + Z / 2;
      const span = lerp(lerp(670, 724, bm), 640, fo);
      const sm = Math.min(Z / span, vw / 330);
      const Fy = lerp(lerp(455, 412, bm), 470, fo);
      out.stageTf = `translate(-50%, -50%) translateY(${cy - vh / 2}px) scale(${sm}) translateY(${400 - Fy}px)`;
      out.mTextTop = `${50 + Z + 8}px`;
      out.mTextBot = '20px';
      out.mF = { op: fo, pe: fo > 0.5 ? 'auto' : 'none', tf: `translateY(${(1 - fo) * 20}px)` };
    } else out.stageTf = `translate(-50%, -50%) scale(${s})`;
    out.totalH = `${pace * 20}vh`;
    out.dotBg = (props.dotGrid ?? true) ? 'radial-gradient(#E8E0D2 1.4px, transparent 1.4px)' : 'none';
    out.screenLabel = p < C0 ? '00 פתיחה' : active >= 0 ? `${String(active + 1).padStart(2, '0')} ${OBJ[active]}` : inBeat ? '09 ממשק אינטגרטיבי' : p < 0.585 ? '08 טלפון אחד' : p < 0.71 ? '09 אפליקציות בית הספר' : p < 0.9 ? '10 איחוד' : '11 סיום';
    return out;
}
