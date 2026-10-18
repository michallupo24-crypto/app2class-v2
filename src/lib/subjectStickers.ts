// Subject sticker artwork, ported from the "Subject Stickers" design mockup.
// Each sticker is a 100x100 drawing: `sil` is the silhouette (it also gets the
// white sticker rim) and `det` the details on top. Fill/stroke values "m",
// "d" and "l" resolve to the sticker's main / dark / light palette colors.
/* eslint-disable */

export type Attrs = Record<string, string | number>;
export type El = [string, Attrs];
export interface StickerArt { pal: [string, string, string]; tilt: number; sil: El[]; det: El[] }

const R = (x: number, y: number, w: number, h: number, rx: number, fill: string, extra?: Attrs): El => ["rect", { x, y, width: w, height: h, rx, fill, ...extra }];
const C = (cx: number, cy: number, r: number, fill: string, extra?: Attrs): El => ["circle", { cx, cy, r, fill, ...extra }];
const P = (d: string, fill: string, extra?: Attrs): El => ["path", { d, fill, ...extra }];
const L = (d: string, stroke: string, w: number): El => ["path", { d, fill: "none", stroke, strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" }];
const T = (t: string, y: number, fs: number, fill: string): El => ["text", { x: 50, y, t, fs, fill }];
const SH = (cx: number, cy: number, rx: number, ry: number, rot: number): El => ["ellipse", { cx, cy, rx, ry, fill: "#fff", opacity: .55, transform: "rotate(" + rot + " " + cx + " " + cy + ")" }];
const BUBBLE = "M18 12 H82 A10 10 0 0 1 92 22 V58 A10 10 0 0 1 82 68 H58 L40 88 V68 H18 A10 10 0 0 1 8 58 V22 A10 10 0 0 1 18 12Z";
const HEART = "M50 88 C20 68 7 52 7 34 A21 21 0 0 1 50 24 A21 21 0 0 1 93 34 C93 52 80 68 50 88Z";
const LET = (t: string, fs: number, y: number, m: string, d: string): El[] => [["text", { x: 53, y: y + 4, t, fs, fill: d }], ["text", { x: 50, y, t, fs, fill: m }]];
const LEAVES = (side: number): El[] => Array.from({ length: 8 }, (_, i) => { const th = (24 + i * 19) * Math.PI / 180, x = 50 - side * 34 * Math.sin(th), y = 54 + 34 * Math.cos(th), r = Math.atan2(-Math.sin(th), -side * Math.cos(th)) * 180 / Math.PI + side * 30;
  return ["ellipse", { cx: x.toFixed(1), cy: y.toFixed(1), rx: 10, ry: 5, fill: i % 2 ? "m" : "d", transform: "rotate(" + r.toFixed(1) + " " + x.toFixed(1) + " " + y.toFixed(1) + ")" }]; });

export const STICKERS: Record<string, StickerArt> = {
  heb: { pal: ["#2F6BFF", "#1B3FA8", "#FFFFFF"], tilt: -5, sil: [P(BUBBLE, "m")], det: [T("אב", 52, 30, "l"), SH(22, 24, 6, 3.5, -30)] },
  eng: { pal: ["#FF5C93", "#C22E62", "#FFFFFF"], tilt: 5, sil: [["polygon", { points: "60,74 86,92 78,64", fill: "m" }], C(48, 46, 40, "m")], det: [T("ABC", 55, 24, "l"), SH(28, 26, 7, 4, -35)] },
  arabic: { pal: ["#18B394", "#0B6F5B", "#FFFFFF"], tilt: -6, sil: [["polygon", { points: "54,64 76,64 74,90", fill: "m" }], R(8, 12, 84, 58, 14, "m")], det: [T("ع", 56, 44, "l"), SH(22, 24, 6, 3.5, -30)] },
  french: { pal: ["#4F70C9", "#2E4790", "#FFFFFF"], tilt: -5, sil: [["polygon", { points: "30,64 20,90 48,68", fill: "m" }], C(30, 44, 22, "m"), C(54, 34, 26, "m"), C(72, 50, 20, "m"), R(14, 44, 72, 26, 13, "m")], det: [T("Fr", 58, 26, "l"), SH(30, 30, 6, 3.5, -30)] },
  spanish: { pal: ["#FF7A45", "#B8460F", "#FFE066"], tilt: 6, sil: [["polygon", { points: "62,64 82,90 50,70", fill: "m" }], R(6, 14, 88, 56, 28, "m")], det: [T("¡Hola!", 50, 20, "l")] },
  russian: { pal: ["#D93B6A", "#8E1A3F", "#FFF4E0"], tilt: 4, sil: [P("M50 30 C76 30 82 58 80 74 C78 88 66 94 50 94 C34 94 22 88 20 74 C18 58 24 30 50 30Z", "m"), C(50, 26, 20, "m")],
    det: [C(50, 28, 12, "#FFE3C8"), C(46, 27, 1.8, "d"), C(54, 27, 1.8, "d"), C(44, 32, 2.5, "#FF8FA8"), C(56, 32, 2.5, "#FF8FA8"), ["ellipse", { cx: 50, cy: 70, rx: 18, ry: 16, fill: "l" }], C(50, 70, 7, "m"), C(50, 70, 3, "#FFC23D")] },
  chinese: { pal: ["#E5302F", "#C98A00", "#FFC23D"], tilt: -6, sil: [L("M50 92 V99", "d", 4), R(34, 6, 32, 10, 3, "d"), R(34, 84, 32, 10, 3, "d"), ["ellipse", { cx: 50, cy: 50, rx: 40, ry: 34, fill: "m" }]], det: [L("M30 20 Q20 50 30 80 M70 20 Q80 50 70 80", "#B01E1E", 3), T("中", 61, 30, "l")] },
  amharic: { pal: ["#2E9D5B", "#1A6438", "#FFE066"], tilt: 5, sil: [["polygon", { points: "26,72 12,94 44,82", fill: "m" }], C(50, 46, 40, "m")], det: [T("አ", 61, 42, "l"), SH(28, 26, 7, 4, -35)] },
  german: { pal: ["#FFC23D", "#B8860B", "#2B1A14"], tilt: 5, sil: [["polygon", { points: "62,64 82,90 50,70", fill: "m" }], R(6, 14, 88, 56, 28, "m")], det: [T("Hallo", 50, 21, "l"), SH(24, 26, 7, 3.5, -25)] },
  italian: { pal: ["#2FB86E", "#16753F", "#FFFFFF"], tilt: -5, sil: [["polygon", { points: "40,74 14,92 22,64", fill: "m" }], C(52, 46, 40, "m")], det: [T("Ciao", 54, 22, "l"), SH(32, 26, 7, 4, -35)] },
  japanese: { pal: ["#E5484D", "#9E1F24", "#FFFFFF"], tilt: 6, sil: [["polygon", { points: "30,64 26,92 50,66", fill: "m" }], R(8, 10, 84, 60, 14, "m")], det: [T("あ", 54, 36, "l"), SH(22, 22, 6, 3.5, -30)] },
  yiddish: { pal: ["#5A6B88", "#3B4A66", "#FFFFFF"], tilt: -4, sil: [["polygon", { points: "68,64 78,90 52,68", fill: "m" }], C(30, 44, 22, "m"), C(54, 34, 26, "m"), C(72, 50, 20, "m"), R(14, 44, 72, 26, 13, "m")], det: [T("א", 60, 34, "l"), SH(30, 30, 6, 3.5, -30)] },
  latin: { pal: ["#C2603A", "#7A3A20", "#FFFFFF"], tilt: 5, sil: [P(BUBBLE, "m", { transform: "scale(-1 1) translate(-100 0)" })], det: [T("Salve", 48, 20, "l"), SH(78, 24, 6, 3.5, 30)] },
  lit: { pal: ["#8B34D6", "#5E1C9E", "#E7D2F8"], tilt: -5, sil: [R(8, 68, 80, 22, 5, "#8B34D6"), R(18, 46, 72, 22, 5, "#FFC23D"), R(6, 24, 76, 22, 5, "#2FD08E"), P("M62 24 V40 L67 35 L72 40 V24Z", "#F0453A")],
    det: [L("M18 79 H62", "#E7D2F8", 3), L("M30 57 H72", "#7A4E00", 3), L("M16 35 H52", "#0E6B48", 3)] },
  bible: { pal: ["#FFD98A", "#B8660A", "#FFF4CC"], tilt: -4, sil: [R(22, 18, 56, 64, 3, "m"), R(10, 10, 16, 80, 8, "d"), R(74, 10, 16, 80, 8, "d")],
    det: [L("M34 32 H66 M34 43 H66 M34 54 H66 M34 65 H56", "d", 3.5), R(15, 16, 4, 68, 2, "l", { opacity: .5 }), R(79, 16, 4, 68, 2, "l", { opacity: .5 })] },
  talmud: { pal: ["#FFF4E0", "#A86B3C", "#D08A45"], tilt: 5, sil: [P("M4 28 V88 Q28 80 50 92 Q72 80 96 88 V28 Z", "d"), P("M8 22 Q30 12 49 24 V84 Q30 74 8 82Z", "m"), P("M51 24 Q70 12 92 22 V82 Q70 74 51 84Z", "m")],
    det: [L("M16 36 Q28 31 40 36 M16 47 Q28 42 40 47 M16 58 Q28 53 40 58 M60 36 Q72 31 84 36 M60 47 Q72 42 84 47 M60 58 Q72 53 84 58", "l", 3.2)] },
  jthought: { pal: ["#4B4FC9", "#2B2E8A", "#C9CBFA"], tilt: -7, sil: [["polygon", { points: "50,6 88,72 12,72", fill: "m" }], ["polygon", { points: "50,94 12,28 88,28", fill: "m" }]], det: [C(50, 50, 13, "l"), SH(36, 30, 5, 3, -30)] },
  judaism: { pal: ["#7C8DB5", "#4A5A80", "#FFFFFF"], tilt: -4, sil: [
      ...[14, 26, 38, 50, 62, 74, 86].map(x => P(`M${x} 10 C${x + 5} 17 ${x + 5} 23 ${x} 25 C${x - 5} 23 ${x - 5} 17 ${x} 10Z`, "#FF9F1C")),
      L("M50 30 V80 M14 30 Q14 64 50 64 Q86 64 86 30 M26 30 Q26 54 50 54 Q74 54 74 30 M38 30 Q38 44 50 44 Q62 44 62 30", "m", 6), R(30, 78, 40, 12, 5, "d")],
    det: [...[14, 26, 38, 50, 62, 74, 86].map(x => C(x, 20, 2.2, "#FFE066"))] },
  math: { pal: ["#3CC6E6", "#1A8BAA", "#C4F3FC"], tilt: 6, sil: [R(18, 6, 64, 88, 12, "m")],
    det: [R(27, 15, 46, 20, 5, "l"), ["text", { x: 50, y: 30, t: "3.14", fs: 12, fill: "d" }], ...[42, 56, 70].flatMap(y => [28, 44, 60].map(x => R(x, y, 12, 10, 3, x === 60 ? "#FF6A3D" : "d")))] },
  phys: { pal: ["#6B5BFF", "#3E2FC2", "#FFC23D"], tilt: -4, sil: [
      ["ellipse", { cx: 50, cy: 50, rx: 40, ry: 14, fill: "none", stroke: "m", strokeWidth: 7 }],
      ["ellipse", { cx: 50, cy: 50, rx: 40, ry: 14, fill: "none", stroke: "m", strokeWidth: 7, transform: "rotate(60 50 50)" }],
      ["ellipse", { cx: 50, cy: 50, rx: 40, ry: 14, fill: "none", stroke: "m", strokeWidth: 7, transform: "rotate(-60 50 50)" }], C(50, 50, 10, "d")],
    det: [C(50, 50, 4, "l"), C(90, 50, 5, "l"), C(30, 15, 5, "l"), C(30, 85, 5, "l")] },
  chem: { pal: ["#BDEBF7", "#1A8BAA", "#2FD08E"], tilt: 5, sil: [P("M36 6 H64 V14 H58 V38 L84 80 A8 8 0 0 1 77 92 H23 A8 8 0 0 1 16 80 L42 38 V14 H36Z", "m")],
    det: [P("M30 60 H70 L80 78 A6 6 0 0 1 75 87 H25 A6 6 0 0 1 20 78Z", "l"), C(44, 74, 4, "#fff", { opacity: .8 }), C(58, 68, 3, "#fff", { opacity: .8 }), C(52, 50, 3.5, "l"), C(46, 40, 2.5, "l"), L("M38 6 H62", "d", 4)] },
  bio: { pal: ["#7DD13B", "#3F8A12", "#C9F29E"], tilt: -6, sil: [L("M16 84 L8 92", "d", 6), P("M14 86 C14 40 40 12 90 10 C90 60 62 86 14 86Z", "m")],
    det: [L("M18 82 L74 26", "d", 4), L("M38 62 L36 44 M52 48 L52 30 M38 62 L56 64 M52 48 L70 50", "d", 3), SH(56, 22, 8, 4, -25)] },
  biotech: { pal: ["#D946B5", "#8E2378", "#F7C6EA"], tilt: 6, sil: [L("M38 18 H62 M44 30 H56 M44 70 H56 M38 82 H62", "l", 5), L("M32 8 C32 30 68 30 68 50 C68 70 32 70 32 92", "m", 8), L("M68 8 C68 30 32 30 32 50 C32 70 68 70 68 92", "d", 8)], det: [] },
  science: { pal: ["#FF9F1C", "#B8660A", "#D6F1FF"], tilt: 5, sil: [L("M64 64 L86 86", "d", 14), C(42, 42, 32, "m")], det: [C(42, 42, 22, "l"), SH(32, 32, 8, 4, -40)] },
  env: { pal: ["#2FC6C0", "#12807C", "#FFFFFF"], tilt: -5, sil: [P("M50 6 C50 6 16 46 16 64 A34 34 0 0 0 84 64 C84 46 50 6 50 6Z", "m")],
    det: [P("M36 78 C36 58 50 48 66 48 C66 66 54 78 36 78Z", "#7DD13B"), L("M38 76 L58 56", "#3F8A12", 3), SH(34, 46, 4, 9, 25)] },
  agri: { pal: ["#8AC926", "#4F7A10", "#FFFFFF"], tilt: 5, sil: [L("M50 56 V30", "d", 6), P("M50 40 C50 24 38 16 20 16 C20 32 32 40 50 40Z", "m"), P("M50 34 C50 18 62 8 82 8 C82 26 70 34 50 34Z", "m"), P("M24 58 H76 L68 92 H32Z", "#C2603A"), R(18, 52, 64, 12, 4, "#A64B28")],
    det: [L("M48 38 L28 22 M52 32 L74 14", "d", 2.5)] },
  astro: { pal: ["#FF9F6B", "#6B5BFF", "#FFFFFF"], tilt: -6, sil: [["polygon", { points: "84,2 87,10 95,13 87,16 84,24 81,16 73,13 81,10", fill: "#FFC23D" }], C(50, 52, 27, "m"), ["ellipse", { cx: 50, cy: 54, rx: 46, ry: 12, fill: "none", stroke: "d", strokeWidth: 7, transform: "rotate(-18 50 54)" }]],
    det: [P("M26 46 A26 26 0 0 1 74 40", "none", { stroke: "#E07A45", strokeWidth: 4, strokeLinecap: "round" }), SH(40, 36, 7, 4, -30)] },
  geology: { pal: ["#A07AE0", "#5E3F99", "#DCCBFA"], tilt: 4, sil: [["polygon", { points: "30,90 18,50 32,24 46,50 42,90", fill: "m" }], ["polygon", { points: "46,90 44,40 60,8 76,40 70,90", fill: "m" }], ["polygon", { points: "68,90 72,56 84,40 94,58 86,90", fill: "m" }], R(8, 84, 88, 10, 5, "d")],
    det: [["polygon", { points: "32,24 46,50 34,50", fill: "l" }], ["polygon", { points: "60,8 76,40 60,40", fill: "l" }], ["polygon", { points: "84,40 94,58 84,58", fill: "l" }]] },
  cs: { pal: ["#5A6B88", "#3B4A66", "#1B2333"], tilt: -4, sil: [R(16, 16, 68, 50, 7, "m"), P("M4 70 H96 L89 84 H11Z", "d")], det: [R(22, 22, 56, 38, 3, "l"), T("</>", 48, 20, "#6FF0A8"), R(40, 74, 20, 4, 2, "#8A93A5")] },
  software: { pal: ["#7457E0", "#452EA0", "#EDE6FF"], tilt: -5, sil: [...Array.from({ length: 8 }, (_, i) => R(42, 4, 16, 20, 3, "m", { transform: `rotate(${i * 45} 50 50)` })), C(50, 50, 34, "m")], det: [C(50, 50, 22, "l"), T("{ }", 57, 20, "m")] },
  robot: { pal: ["#FF6A3D", "#C53D16", "#2B1A14"], tilt: 6, sil: [L("M50 22 V10", "d", 5), C(50, 8, 6, "#FFC23D"), R(4, 40, 14, 22, 5, "d"), R(82, 40, 14, 22, 5, "d"), R(14, 20, 72, 62, 16, "m")],
    det: [R(24, 32, 52, 30, 11, "l"), C(39, 47, 6, "#FFE066"), C(61, 47, 6, "#FFE066"), L("M40 72 H60", "d", 4)] },
  electro: { pal: ["#2FD08E", "#13804F", "#FFE066"], tilt: 6, sil: [R(38, 4, 24, 10, 3, "d"), R(22, 12, 56, 84, 12, "m")], det: [P("M56 22 L34 56 H48 L42 86 L68 48 H54Z", "l"), SH(32, 24, 4, 8, 0)] },
  scitech: { pal: ["#0E8FB5", "#FF6A3D", "#D6F1FF"], tilt: -7, sil: [["polygon", { points: "34,52 16,80 34,74", fill: "d" }], ["polygon", { points: "66,52 84,80 66,74", fill: "d" }], P("M40 74 Q50 100 60 74Z", "#FFC23D"), P("M50 4 C69 19 73 44 66 74 H34 C27 44 31 19 50 4Z", "m")],
    det: [C(50, 36, 10, "l"), C(50, 36, 5, "d")] },
  hist: { pal: ["#D6F1FF", "#A86B3C", "#F2B200"], tilt: -5, sil: [P("M26 18 H74 C74 38 56 44 56 50 C56 56 74 62 74 82 H26 C26 62 44 56 44 50 C44 44 26 38 26 18Z", "m"), R(16, 6, 68, 13, 5, "d"), R(16, 81, 68, 13, 5, "d")],
    det: [P("M34 26 H66 C64 36 54 40 50 46 C46 40 36 36 34 26Z", "l"), P("M30 80 C34 68 46 64 50 62 C54 64 66 68 70 80Z", "l"), L("M50 48 V62", "l", 2.5)] },
  civ: { pal: ["#3A7BFF", "#1F49B8", "#fff"], tilt: 4, sil: [R(10, 42, 80, 50, 9, "m"), R(32, 4, 30, 40, 3, "l", { transform: "rotate(-7 47 24)" }), R(6, 36, 88, 12, 5, "d")],
    det: [L("M38 20 L45 27 L57 13", "m", 4.5), R(30, 40, 40, 4, 2, "#0B2466"), ["polygon", { points: "50,58 56,68 50,78 44,68", fill: "l", opacity: .85 }]] },
  geo: { pal: ["#FFD27A", "#E0A63A", "#2F6BFF"], tilt: -5, sil: [P("M6 28 L34 18 L62 28 L92 18 V78 L62 88 L34 78 L6 88Z", "m"), P("M34 18 L62 28 V88 L34 78Z", "d"),
      P("M72 4 C62 4 56 12 56 20 C56 32 72 46 72 46 C72 46 88 32 88 20 C88 12 82 4 72 4Z", "#F0453A")],
    det: [P("M14 72 C26 56 40 66 50 52 C56 44 64 46 70 40", "none", { stroke: "l", strokeWidth: 3.5, strokeDasharray: "5 5", strokeLinecap: "round" }), C(72, 20, 6, "#fff")] },
  econ: { pal: ["#18B394", "#0B6F5B", "#9EF0D8"], tilt: 5, sil: [R(10, 62, 18, 30, 4, "m"), R(34, 48, 18, 44, 4, "m"), R(58, 34, 18, 58, 4, "m"), L("M12 44 L36 24 L54 36 L80 12", "d", 7), ["polygon", { points: "68,8 90,4 86,26", fill: "d" }]],
    det: [R(14, 66, 4, 22, 2, "l"), R(38, 52, 4, 36, 2, "l"), R(62, 38, 4, 50, 2, "l")] },
  fin: { pal: ["#FFC23D", "#C98A00", "#FFE9A8"], tilt: -7, sil: [C(56, 56, 36, "d"), C(46, 46, 36, "m")], det: [C(46, 46, 27, "none", { stroke: "l", strokeWidth: 3 }), ["text", { x: 46, y: 58, t: "₪", fs: 34, fill: "d" }]] },
  psych: { pal: ["#FF8FB8", "#C22E62", "#FFD0E0"], tilt: 4, sil: [R(40, 70, 16, 20, 6, "d"), C(34, 38, 22, "m"), C(60, 30, 22, "m"), C(74, 54, 19, "m"), C(52, 62, 22, "m"), C(26, 60, 19, "m")],
    det: [L("M42 28 Q50 40 42 50 M62 38 Q54 50 64 58 M30 62 Q42 56 46 70 M70 30 Q78 36 76 44", "d", 3.5), SH(30, 28, 6, 3.5, -35)] },
  socio: { pal: ["#E5484D", "#9E1F24", "#FFFFFF"], tilt: 5, sil: [C(24, 36, 12, "d"), P("M6 82 C6 60 42 60 42 82Z", "d"), C(76, 36, 12, "d"), P("M58 82 C58 60 94 60 94 82Z", "d"), C(50, 32, 15, "m"), P("M24 92 C24 62 76 62 76 92Z", "m")], det: [SH(45, 26, 5, 3, -30)] },
  socsci: { pal: ["#FFC23D", "#3CC6E6", "#FF5C93"], tilt: -4, sil: [C(36, 40, 26, "m"), C(64, 40, 26, "d", { opacity: .85 }), C(50, 64, 26, "l", { opacity: .85 })], det: [] },
  media: { pal: ["#F04E98", "#A3215F", "#FFD0E6"], tilt: 5, sil: [L("M84 36 L94 30 M86 50 H96 M84 64 L94 70", "d", 5), R(22, 58, 14, 26, 5, "d"), P("M14 40 H30 L74 16 V84 L30 60 H14 A6 6 0 0 1 8 54 V46 A6 6 0 0 1 14 40Z", "m")], det: [R(70, 14, 10, 72, 5, "l")] },
  law: { pal: ["#A86B3C", "#5C3410", "#F2D3A8"], tilt: -4, sil: [L("M50 14 V82", "d", 7), R(28, 80, 44, 12, 5, "d"), L("M20 26 L8 54 M20 26 L32 54 M80 26 L68 54 M80 26 L92 54", "d", 3), L("M16 26 H84", "m", 7),
      P("M4 54 H36 A16 16 0 0 1 4 54Z", "m"), P("M64 54 H96 A16 16 0 0 1 64 54Z", "m"), C(50, 14, 7, "m")], det: [C(50, 14, 3, "l"), L("M10 58 H28 M70 58 H88", "l", 3)] },
  mgmt: { pal: ["#3D5A9E", "#22386E", "#FFC23D"], tilt: 4, sil: [L("M38 26 V16 H62 V26", "d", 6), R(8, 26, 84, 62, 12, "m")], det: [R(8, 50, 84, 6, 0, "d"), R(42, 44, 16, 18, 4, "l")] },
  art: { pal: ["#F2C48D", "#B8803E", "#FFF1DD"], tilt: -5, sil: [P("M50 8 C20 8 6 30 8 52 C10 76 32 92 50 90 C60 89 60 80 56 74 C52 68 56 60 66 60 H78 C88 60 94 52 92 40 C88 20 70 8 50 8Z", "m")],
    det: [C(28, 36, 8, "#F0453A"), C(50, 22, 8, "#FFC23D"), C(72, 32, 8, "#2F6BFF"), C(26, 60, 8, "#18B394"), C(40, 76, 6, "#8B34D6")] },
  music: { pal: ["#E0478E", "#9E1F5C", "#FFC7DE"], tilt: 6, sil: [L("M36 72 V24 M84 62 V14", "m", 8), ["polygon", { points: "32,20 88,8 88,24 32,36", fill: "m" }],
      ["ellipse", { cx: 26, cy: 74, rx: 14, ry: 11, fill: "m", transform: "rotate(-20 26 74)" }], ["ellipse", { cx: 74, cy: 64, rx: 14, ry: 11, fill: "m", transform: "rotate(-20 74 64)" }]], det: [SH(22, 70, 5, 3, -20), SH(70, 60, 5, 3, -20)] },
  theater: { pal: ["#FFC23D", "#7A4E00", "#FF8FA8"], tilt: -6, sil: [P("M12 12 C34 22 66 22 88 12 C92 50 78 84 50 92 C22 84 8 50 12 12Z", "m")],
    det: [P("M24 42 Q34 32 44 42 Q34 38 24 42Z", "d", { stroke: "d", strokeWidth: 4, strokeLinejoin: "round" }), P("M56 42 Q66 32 76 42 Q66 38 56 42Z", "d", { stroke: "d", strokeWidth: 4, strokeLinejoin: "round" }), P("M30 58 Q50 84 70 58Z", "d"), C(24, 56, 5, "l"), C(76, 56, 5, "l")] },
  film: { pal: ["#2B3550", "#1B2333", "#FFFFFF"], tilt: 5, sil: [R(10, 40, 80, 50, 6, "m"), R(8, 18, 82, 18, 4, "d", { transform: "rotate(-12 10 36)" })],
    det: [...["22,18 34,18 28,36 16,36", "46,18 58,18 52,36 40,36", "70,18 82,18 76,36 64,36"].map(points => ["polygon", { points, fill: "l", transform: "rotate(-12 10 36)" }]), L("M22 60 H78 M22 74 H58", "#5A6B88", 4)] },
  dance: { pal: ["#F2668B", "#B03358", "#FFD0DE"], tilt: 6, sil: [L("M10 70 C26 30 42 30 50 50 C58 70 74 70 90 30", "m", 14), ["polygon", { points: "22,8 25,16 33,19 25,22 22,30 19,22 11,19 19,16", fill: "#FFC23D" }]], det: [L("M14 62 C28 34 40 34 48 50", "l", 3)] },
  design: { pal: ["#FFC23D", "#2B1A14", "#FFFFFF"], tilt: 4, sil: [R(38, 2, 24, 14, 5, "#FF8FA8", { transform: "rotate(45 50 50)" }), R(38, 14, 24, 56, 0, "m", { transform: "rotate(45 50 50)" }), ["polygon", { points: "38,70 62,70 50,96", fill: "#FFE3C8", transform: "rotate(45 50 50)" }]],
    det: [["polygon", { points: "45,85 55,85 50,96", fill: "d", transform: "rotate(45 50 50)" }], R(38, 14, 24, 4, 0, "#C4C9D4", { transform: "rotate(45 50 50)" }), R(47, 20, 4, 48, 2, "l", { opacity: .6, transform: "rotate(45 50 50)" })] },
  photo: { pal: ["#2F8F9D", "#1B5A63", "#9EDDE6"], tilt: -6, sil: [R(30, 18, 24, 16, 4, "d"), R(6, 28, 88, 60, 14, "m")], det: [C(50, 58, 22, "d"), C(50, 58, 15, "l"), SH(44, 52, 5, 3, -30), R(72, 36, 12, 8, 3, "#FFC23D")] },
  home: { pal: ["#FFB23D", "#B8660A", "#fff"], tilt: 6, sil: [R(43, 2, 14, 12, 5, "d"), C(50, 86, 9, "d"), P("M50 10 C30 10 20 28 20 50 V66 L8 80 H92 L80 66 V50 C80 28 70 10 50 10Z", "m")], det: [SH(36, 36, 5, 11, 15), L("M22 68 H78", "d", 3)] },
  pe: { pal: ["#FF8A2B", "#9E4A0A", "#FFC08A"], tilt: -4, sil: [C(50, 50, 42, "m")], det: [L("M8 50 H92 M50 8 V92 M22 20 C38 36 38 64 22 80 M78 20 C62 36 62 64 78 80", "d", 3.5), SH(30, 26, 8, 4, -40)] },
  health: { pal: ["#F0453A", "#8E1A13", "#fff"], tilt: -5, sil: [P(HEART, "m")], det: [L("M14 48 H32 L39 34 L49 64 L57 40 L63 48 H86", "l", 5), SH(26, 32, 7, 4, -35)] },
  nutrition: { pal: ["#FF9F1C", "#B8660A", "#7DD13B"], tilt: 6, sil: [L("M72 26 L80 6 M74 28 L94 18 M70 24 L66 4", "#3F8A12", 7), P("M60 18 C70 18 82 30 82 38 L24 94 C14 98 2 88 6 78Z", "m")], det: [L("M30 60 L38 66 M44 46 L52 52 M24 78 L30 82", "d", 3.5)] },
  shelach: { pal: ["#6E9E2A", "#3F5E14", "#C9F29E"], tilt: -5, sil: [["polygon", { points: "50,10 92,82 8,82", fill: "m" }], R(4, 80, 92, 11, 5, "d")], det: [["polygon", { points: "50,42 66,82 34,82", fill: "d" }], L("M50 20 L24 70", "l", 3)] },
  volunteer: { pal: ["#FF6F91", "#C22E62", "#FFD0E0"], tilt: 6, sil: [P(HEART, "m"), P(HEART, "d", { transform: "translate(62 0) scale(.38)" })], det: [SH(28, 34, 8, 5, -35)] },
  leader: { pal: ["#F2B200", "#A87600", "#FFE07A"], tilt: -4, sil: [["polygon", { points: "24,4 44,4 58,44 38,44", fill: "#2F6BFF" }], ["polygon", { points: "76,4 56,4 42,44 62,44", fill: "#F0453A" }], C(50, 62, 30, "m")],
    det: [C(50, 62, 21, "l"), ["polygon", { points: "50,48 54,57 63,58 56,64 58,73 50,68 42,73 44,64 37,58 46,57", fill: "d" }]] },
  traffic: { pal: ["#2B3550", "#1B2333", "#FFFFFF"], tilt: 4, sil: [R(43, 80, 14, 14, 3, "d"), R(28, 6, 44, 78, 14, "m")], det: [C(50, 22, 9, "#F0453A"), C(50, 45, 9, "#FFC23D"), C(50, 68, 9, "#2FD08E")] },
};

/** Catalog groups (sticker id, Hebrew name), as laid out in the mockup. */
export const STICKER_GROUPS: [string, [string, string][]][] = [
  ["שפות", [["heb", "לשון"], ["lit", "ספרות"], ["eng", "אנגלית"], ["arabic", "ערבית"], ["french", "צרפתית"], ["spanish", "ספרדית"], ["russian", "רוסית"], ["chinese", "סינית"], ["amharic", "אמהרית"], ["german", "גרמנית"], ["italian", "איטלקית"], ["japanese", "יפנית"], ["yiddish", "יידיש"], ["latin", "לטינית"]]],
  ["יהדות ורוח", [["bible", "תנ״ך"], ["talmud", "תושב״ע"], ["jthought", "מחשבת ישראל"], ["judaism", "יהדות"]]],
  ["מדעים", [["math", "מתמטיקה"], ["phys", "פיזיקה"], ["chem", "כימיה"], ["bio", "ביולוגיה"], ["biotech", "ביוטכנולוגיה"], ["science", "מדעים"], ["env", "מדעי הסביבה"], ["agri", "חקלאות"], ["astro", "אסטרונומיה"], ["geology", "גאולוגיה"]]],
  ["טכנולוגיה", [["cs", "מדעי המחשב"], ["software", "הנדסת תוכנה"], ["robot", "רובוטיקה"], ["electro", "אלקטרוניקה"], ["scitech", "מדע וטכנולוגיה"]]],
  ["חברה", [["hist", "היסטוריה"], ["civ", "אזרחות"], ["geo", "גאוגרפיה"], ["econ", "כלכלה"], ["fin", "חינוך פיננסי"], ["psych", "פסיכולוגיה"], ["socio", "סוציולוגיה"], ["socsci", "מדעי החברה"], ["media", "תקשורת"], ["law", "משפטים"], ["mgmt", "ניהול"]]],
  ["אמנויות", [["art", "אמנות"], ["music", "מוזיקה"], ["theater", "תיאטרון"], ["film", "קולנוע"], ["dance", "מחול"], ["design", "עיצוב"], ["photo", "צילום"]]],
  ["חינוך, גוף ומעורבות", [["home", "שעת חינוך"], ["pe", "חינוך גופני"], ["health", "בריאות"], ["nutrition", "תזונה"], ["shelach", "של״ח"], ["volunteer", "מעורבות חברתית"], ["leader", "מנהיגות"], ["traffic", "חינוך תעבורתי"]]],
];
