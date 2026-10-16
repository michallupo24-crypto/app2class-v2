// Badge sticker artwork, ported from the "Badge Collection" design mockup.
/* eslint-disable */
type El = [string, Record<string, string | number>];

const starPts = (cx: number, cy: number, R: number, r: number, n: number, rot = -90) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (rot + i * 180 / n) * Math.PI / 180, d = i % 2 ? r : R;
  return (cx + d * Math.cos(a)).toFixed(1) + "," + (cy + d * Math.sin(a)).toFixed(1);
}).join(" ");

const SHIELD = "M50 6 L86 18 V46 C86 69 70 83 50 92 C30 83 14 69 14 46 V18 Z";
export const BADGE_ART: Record<string, { sil: El[]; det: El[] }> = {
  pioneer: { sil: [["rect", { x: 20, y: 8, width: 10, height: 84, rx: 5, fill: "d" }], ["path", { d: "M30 14 C46 5 58 23 84 13 L84 54 C58 64 46 46 30 55 Z", fill: "m" }]],
    det: [["circle", { cx: 57, cy: 34, r: 9, fill: "l" }]] },
  streak_7: { sil: [["path", { d: "M50 6 C57 26 80 36 80 62 A30 30 0 0 1 20 62 C20 47 29 38 35 32 C36 43 42 49 47 51 C43 36 43 21 50 6Z", fill: "m" }]],
    det: [["path", { d: "M50 44 C55 56 66 60 66 72 A16 16 0 0 1 34 72 C34 62 42 57 50 44Z", fill: "l" }], ["text", { x: 50, y: 82, t: "7", fs: 22, fill: "d" }]] },
  streak_30: { sil: [["polygon", { points: "28,16 72,16 92,40 50,90 8,40", fill: "m" }]],
    det: [["polygon", { points: "28,16 72,16 62,40 38,40", fill: "l" }], ["path", { d: "M8 40 H92 M38 40 L50 90 L62 40", fill: "none", stroke: "d", strokeWidth: 3, strokeLinejoin: "round" }]] },
  first_positive: { sil: [["polygon", { points: starPts(50, 53, 46, 21, 5), fill: "m" }]],
    det: [["circle", { cx: 42, cy: 52, r: 3.6, fill: "d" }], ["circle", { cx: 58, cy: 52, r: 3.6, fill: "d" }], ["path", { d: "M43 61 Q50 67 57 61", fill: "none", stroke: "d", strokeWidth: 3.2, strokeLinecap: "round" }], ["circle", { cx: 36, cy: 59, r: 3.5, fill: "l" }], ["circle", { cx: 64, cy: 59, r: 3.5, fill: "l" }]] },
  five_above_80: { sil: [["path", { d: "M27 22 H15 A13 13 0 0 0 31 48 M73 22 H85 A13 13 0 0 1 69 48", fill: "none", stroke: "m", strokeWidth: 7, strokeLinecap: "round" }], ["path", { d: "M26 10 H74 V38 A24 24 0 0 1 26 38 Z", fill: "m" }], ["rect", { x: 43, y: 60, width: 14, height: 14, fill: "d" }], ["rect", { x: 27, y: 72, width: 46, height: 17, rx: 4, fill: "m" }]],
    det: [["polygon", { points: starPts(50, 33, 11, 5, 5), fill: "l" }], ["rect", { x: 35, y: 78, width: 30, height: 5, rx: 2.5, fill: "l" }]] },
  community_helper: { sil: [["path", { d: "M50 88 C20 68 7 52 7 34 A21 21 0 0 1 50 24 A21 21 0 0 1 93 34 C93 52 80 68 50 88Z", fill: "m" }]],
    det: [["ellipse", { cx: 28, cy: 34, rx: 8, ry: 5, fill: "l", transform: "rotate(-35 28 34)" }]] },
  faction_guardian: { sil: [["path", { d: SHIELD, fill: "m" }]],
    det: [["path", { d: "M50 16 L77 25 V46 C77 63 65 74 50 81 Z", fill: "d", opacity: .35 }], ["path", { d: "M34 48 L46 60 L67 36", fill: "none", stroke: "l", strokeWidth: 8, strokeLinecap: "round", strokeLinejoin: "round" }]] },
  perfect_attendance: { sil: [["circle", { cx: 46, cy: 54, r: 40, fill: "m" }], ["path", { d: "M46 54 L86 14", fill: "none", stroke: "d", strokeWidth: 5, strokeLinecap: "round" }], ["polygon", { points: "78,8 92,8 92,22 84,22 84,16 78,16", fill: "d" }]],
    det: [["circle", { cx: 46, cy: 54, r: 28, fill: "l" }], ["circle", { cx: 46, cy: 54, r: 16, fill: "m" }], ["circle", { cx: 46, cy: 54, r: 6, fill: "l" }], ["path", { d: "M46 54 L70 30", fill: "none", stroke: "d", strokeWidth: 5, strokeLinecap: "round" }]] },
  perfect: { sil: [["polygon", { points: starPts(50, 50, 47, 38, 14), fill: "m" }]],
    det: [["text", { x: 50, y: 61, t: "100", fs: 30, fill: "l", transform: "rotate(-8 50 50)" }]] },
  early_bird: { sil: [["path", { d: "M50 8 V20 M17 21 L26 30 M83 21 L74 30 M6 52 H17 M94 52 H83", fill: "none", stroke: "m", strokeWidth: 7, strokeLinecap: "round" }], ["path", { d: "M16 70 A34 34 0 0 1 84 70 Z", fill: "m" }], ["rect", { x: 8, y: 70, width: 84, height: 13, rx: 6.5, fill: "d" }]],
    det: [["path", { d: "M30 62 A20 20 0 0 1 50 44", fill: "none", stroke: "l", strokeWidth: 5, strokeLinecap: "round" }]] },
  deadline_hero: { sil: [["circle", { cx: 24, cy: 22, r: 11, fill: "d" }], ["circle", { cx: 76, cy: 22, r: 11, fill: "d" }], ["path", { d: "M28 80 L20 92 M72 80 L80 92", fill: "none", stroke: "d", strokeWidth: 7, strokeLinecap: "round" }], ["circle", { cx: 50, cy: 54, r: 37, fill: "m" }]],
    det: [["circle", { cx: 50, cy: 54, r: 27, fill: "l" }], ["path", { d: "M50 54 V36 M50 54 L62 62", fill: "none", stroke: "d", strokeWidth: 6, strokeLinecap: "round" }], ["circle", { cx: 50, cy: 54, r: 4, fill: "d" }]] },
  curious: { sil: [["path", { d: "M16 14 H84 A8 8 0 0 1 92 22 V64 A8 8 0 0 1 84 72 H42 L22 90 V72 H16 A8 8 0 0 1 8 64 V22 A8 8 0 0 1 16 14Z", fill: "m" }]],
    det: [["text", { x: 50, y: 59, t: "?", fs: 44, fill: "l" }]] },
  bookworm: { sil: [["path", { d: "M6 22 Q28 12 49 24 V86 Q28 74 6 84Z", fill: "m" }], ["path", { d: "M51 24 Q72 12 94 22 V84 Q72 74 51 86Z", fill: "m" }]],
    det: [["path", { d: "M15 38 Q28 33 40 38 M15 50 Q28 45 40 50 M15 62 Q28 57 40 62 M60 38 Q72 33 85 38 M60 50 Q72 45 85 50", fill: "none", stroke: "l", strokeWidth: 3.5, strokeLinecap: "round" }]] },
  comeback: { sil: [["polygon", { points: "34,50 16,76 34,72", fill: "d" }], ["polygon", { points: "66,50 84,76 66,72", fill: "d" }], ["path", { d: "M40 72 Q50 100 60 72Z", fill: "l" }], ["path", { d: "M50 4 C69 19 73 44 66 72 H34 C27 44 31 19 50 4Z", fill: "m" }]],
    det: [["circle", { cx: 50, cy: 36, r: 10, fill: "l" }], ["circle", { cx: 50, cy: 36, r: 5, fill: "d" }]] },
  explainer: { sil: [["path", { d: "M50 6 A29 29 0 0 1 67 59 V68 H33 V59 A29 29 0 0 1 50 6Z", fill: "m" }], ["rect", { x: 34, y: 70, width: 32, height: 9, rx: 3, fill: "d" }], ["rect", { x: 39, y: 81, width: 22, height: 10, rx: 4, fill: "d" }]],
    det: [["path", { d: "M41 46 L45.5 54 L50 46 L54.5 54 L59 46", fill: "none", stroke: "d", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" }], ["ellipse", { cx: 38, cy: 26, rx: 6, ry: 4, fill: "l", transform: "rotate(-40 38 26)" }]] },
  team_player: { sil: [["path", { d: "M12 30 H40 A11 11 0 1 1 60 30 H88 V49 A11 11 0 1 1 88 69 V88 H12 V69 A11 11 0 1 0 12 49 Z", fill: "m" }]],
    det: [["ellipse", { cx: 28, cy: 44, rx: 7, ry: 4, fill: "l", transform: "rotate(-30 28 44)" }]] },
  streak_100: { sil: [["polygon", { points: "8,30 30,52 50,14 70,52 92,30 83,78 17,78", fill: "m" }], ["rect", { x: 17, y: 78, width: 66, height: 12, rx: 4, fill: "d" }]],
    det: [["circle", { cx: 50, cy: 62, r: 7, fill: "l" }], ["circle", { cx: 30, cy: 66, r: 4.5, fill: "l" }], ["circle", { cx: 70, cy: 66, r: 4.5, fill: "l" }]] },
  focus: { sil: [["polygon", { points: "60,4 18,56 46,56 36,96 82,38 55,38", fill: "m" }]],
    det: [["polygon", { points: "56,16 32,48 44,48", fill: "l" }]] },
};
/** [main, dark, light, tilt] */
export const BADGE_STICKER: Record<string, [string, string, string, number]> = {
  pioneer: ["#2F6BFF", "#1B3FA8", "#FFC23D", -6], streak_7: ["#FF6A3D", "#C53D16", "#FFC23D", 5],
  streak_30: ["#3CC6E6", "#1A8BAA", "#C4F3FC", -4], first_positive: ["#FFC23D", "#7A4E00", "#FF8FA8", 7],
  five_above_80: ["#F2B200", "#A87600", "#FFF0B8", -5], community_helper: ["#FF5C93", "#C22E62", "#FFD0E0", 4],
  faction_guardian: ["#6B5BFF", "#3E2FC2", "#FFFFFF", -3], perfect_attendance: ["#F0453A", "#8E1A13", "#FFFFFF", 6],
  perfect: ["#8B34D6", "#5E1C9E", "#FFC23D", -7],
  early_bird: ["#FF9F1C", "#B8660A", "#FFE3A8", 4], deadline_hero: ["#18B394", "#0B6F5B", "#FFFFFF", -5],
  curious: ["#2F6BFF", "#1B3FA8", "#FFFFFF", 6], bookworm: ["#FF6A3D", "#C53D16", "#FFFFFF", -4],
  comeback: ["#E8E3F7", "#6B5BFF", "#FF6A3D", 7], explainer: ["#FFC23D", "#7A4E00", "#FFF4CC", -6],
  team_player: ["#3CC6E6", "#1A8BAA", "#C4F3FC", 5], streak_100: ["#F2B200", "#A87600", "#FF5C93", -3],
  focus: ["#8B34D6", "#5E1C9E", "#E7D2F8", 6],
};
