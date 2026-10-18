// Subject tiles (rounded square, white glyph) - the compact subject icon used
// across lists, timetables and chats in the design mockups.
/* eslint-disable */

export type GlyphEl = [string, Record<string, string | number>];

const LN = (d: string, w = 6): GlyphEl => ["path", { d, w }];
const TX = (t: string, fs = 32, y = 63): GlyphEl => ["text", { x: 50, y, t, fs }];
const DOT = (cx: number, cy: number, r: number): GlyphEl => ["dot", { cx, cy, r }];

export const SUBJECT_GLYPHS: Record<string, GlyphEl[]> = {
  heb: [TX("אב")], lit: [LN("M30 70 L64 30 C70 24 78 30 72 36 L38 74 L28 76 Z", 5), LN("M58 36 L66 44", 5)],
  eng: [TX("Aa")], arabic: [TX("ع", 42, 64)], french: [TX("Fr")], spanish: [TX("Es")], russian: [TX("Ру")],
  chinese: [TX("中", 38, 64)], amharic: [TX("አ", 40, 64)],
  bible: [LN("M32 30 H68 M32 70 H68", 7), LN("M36 30 V70 M64 30 V70", 5), LN("M43 42 H57 M43 51 H57 M43 60 H53", 4)],
  talmud: [LN("M50 34 C41 28 31 28 24 30 V70 C31 68 41 68 50 74 C59 68 69 68 76 70 V30 C69 28 59 28 50 34 Z M50 34 V74", 4.5)],
  jthought: [LN("M50 24 L72 62 H28 Z M50 76 L28 38 H72 Z", 4.5)],
  judaism: [LN("M50 30 V74 M30 30 V42 Q30 56 50 56 Q70 56 70 42 V30 M40 30 V42 Q40 50 50 50 Q60 50 60 42 V30 M40 74 H60", 4)],
  math: [LN("M32 30 H48 M40 22 V38"), LN("M54 30 H70"), LN("M33 55 L47 69 M47 55 L33 69"), LN("M54 58 H70 M54 66 H70")],
  phys: [["ellipse", { cx: 50, cy: 50, rx: 25, ry: 9, w: 4.5 }], ["ellipse", { cx: 50, cy: 50, rx: 25, ry: 9, w: 4.5, transform: "rotate(60 50 50)" }], ["ellipse", { cx: 50, cy: 50, rx: 25, ry: 9, w: 4.5, transform: "rotate(-60 50 50)" }], DOT(50, 50, 5)],
  chem: [LN("M43 24 H57 M46 24 V42 L30 68 Q27 76 35 76 H65 Q73 76 70 68 L54 42 V24", 5), LN("M36 60 H64", 4)],
  bio: [LN("M28 72 C28 42 46 26 74 26 C74 54 58 72 28 72 Z", 5), LN("M30 70 L60 40", 4)],
  biotech: [LN("M38 26 C38 42 62 42 62 50 C62 58 38 58 38 74 M62 26 C62 42 38 42 38 50 C38 58 62 58 62 74", 4.5), LN("M43 33 H57 M43 67 H57", 4)],
  science: [["circle", { cx: 44, cy: 44, r: 16, w: 5 }], LN("M56 56 L72 72", 7)],
  env: [LN("M50 24 C50 24 30 48 30 60 A20 20 0 0 0 70 60 C70 48 50 24 50 24 Z", 5), LN("M42 60 A8 8 0 0 0 50 68", 4)],
  agri: [LN("M50 74 V46", 5), LN("M50 52 C50 40 40 34 28 34 C28 46 38 52 50 52 Z M50 46 C50 34 60 28 72 28 C72 40 62 46 50 46 Z", 4.5)],
  astro: [["circle", { cx: 50, cy: 50, r: 14, w: 5 }], ["ellipse", { cx: 50, cy: 50, rx: 28, ry: 9, w: 4, transform: "rotate(-20 50 50)" }], DOT(72, 30, 3.5)],
  geology: [LN("M30 44 L42 28 H60 L72 44 L50 74 Z", 5), LN("M30 44 H72 M42 28 L50 44 L60 28 M50 44 V74", 3.5)],
  cs: [LN("M38 34 L24 50 L38 66 M62 34 L76 50 L62 66"), LN("M56 30 L44 70", 5)],
  software: [TX("{ }", 34, 62)],
  robot: [["rect", { x: 30, y: 40, width: 40, height: 32, rx: 8, w: 5 }], LN("M50 40 V30", 5), DOT(50, 27, 4.5), DOT(41, 54, 4), DOT(59, 54, 4), LN("M43 64 H57", 4)],
  electro: [LN("M55 22 L34 54 H50 L45 78 L66 44 H50 Z", 5)],
  scitech: [["circle", { cx: 50, cy: 50, r: 12, w: 5 }], LN("M50 24 V32 M50 68 V76 M24 50 H32 M68 50 H76 M32 32 L37 37 M63 63 L68 68 M68 32 L63 37 M37 63 L32 68", 5)],
  hist: [LN("M34 26 H66 M34 74 H66"), LN("M38 26 C38 42 62 46 62 50 C62 54 38 58 38 74 M62 26 C62 42 38 46 38 50 C38 54 62 58 62 74", 5)],
  civ: [LN("M50 26 V74 M38 74 H62 M28 36 H72"), LN("M28 36 L20 54 H36 Z M72 36 L64 54 H80 Z", 4.5)],
  geo: [["circle", { cx: 50, cy: 50, r: 24, w: 5 }], ["ellipse", { cx: 50, cy: 50, rx: 10, ry: 24, w: 4 }], LN("M26 50 H74", 4)],
  econ: [LN("M26 74 H74", 5), LN("M34 74 V58 M46 74 V48 M58 74 V40 M70 74 V28", 7)],
  fin: [["circle", { cx: 50, cy: 50, r: 23, w: 5 }], TX("₪", 26, 59)],
  psych: [LN("M40 60 C33 55 30 48 30 43 A20 20 0 0 1 70 43 C70 48 67 55 60 60 V66 H40 Z", 5), LN("M42 74 H58", 5)],
  socio: [LN("M50 32 L32 66 H68 Z", 4), DOT(50, 32, 8), DOT(32, 66, 8), DOT(68, 66, 8)],
  socsci: [["circle", { cx: 41, cy: 50, r: 16, w: 4.5 }], ["circle", { cx: 59, cy: 50, r: 16, w: 4.5 }]],
  media: [LN("M28 44 V58 H36 L62 70 V32 L36 44 Z", 5), LN("M68 43 Q75 51 68 59", 4.5)],
  law: [TX("§", 40, 66)],
  mgmt: [["rect", { x: 26, y: 38, width: 48, height: 34, rx: 6, w: 5 }], LN("M42 38 V30 H58 V38 M26 52 H74", 4.5)],
  art: [LN("M50 26 C30 26 24 42 26 54 C28 70 44 76 50 72 C54 69 50 62 57 60 C67 58 76 57 76 46 C76 34 64 26 50 26 Z", 5), DOT(40, 40, 4), DOT(55, 36, 4), DOT(37, 56, 4)],
  music: [LN("M44 66 V30 L68 25 V60", 5), DOT(38, 66, 7), DOT(62, 60, 7)],
  theater: [LN("M30 28 H70 V48 C70 63 61 74 50 74 C39 74 30 63 30 48 Z", 5), DOT(41, 44, 4), DOT(59, 44, 4), LN("M40 58 Q50 66 60 58", 4)],
  film: [["rect", { x: 26, y: 44, width: 48, height: 30, rx: 4, w: 5 }], LN("M26 44 L30 28 H74 V44 M40 28 L36 44 M54 28 L50 44 M68 28 L64 44", 4.5)],
  dance: [LN("M50 50 m-4 0 a4 4 0 1 1 8 0 a10 10 0 1 1 -18 0 a16 16 0 1 1 30 0 a21 21 0 1 1 -40 0", 4.5)],
  design: [LN("M28 72 V30 L70 72 Z", 5), LN("M36 64 V50 L50 64 Z", 4)],
  photo: [["rect", { x: 24, y: 36, width: 52, height: 36, rx: 8, w: 5 }], ["circle", { cx: 50, cy: 54, r: 10, w: 4.5 }], LN("M40 36 L44 28 H56 L60 36", 4.5)],
  home: [["circle", { cx: 39, cy: 38, r: 7, w: 5 }], ["circle", { cx: 61, cy: 38, r: 7, w: 5 }], LN("M26 70 C26 56 52 56 52 70 M48 70 C48 56 74 56 74 70", 5)],
  pe: [["circle", { cx: 50, cy: 50, r: 23, w: 5 }], LN("M27 50 H73 M50 27 V73 M34 34 C42 42 42 58 34 66 M66 34 C58 42 58 58 66 66", 4)],
  health: [LN("M42 26 H58 V42 H74 V58 H58 V74 H42 V58 H26 V42 H42 Z", 5)],
  nutrition: [LN("M38 24 V76 M32 24 V38 Q38 44 44 38 V24 M64 24 C56 30 56 48 64 50 V76", 4.5)],
  shelach: [LN("M22 70 L42 40 L52 54 L60 44 L78 70 Z", 5), DOT(66, 30, 5)],
  volunteer: [LN("M50 72 C34 62 26 53 26 43 A12 12 0 0 1 50 38 A12 12 0 0 1 74 43 C74 53 66 62 50 72 Z", 5)],
  leader: [LN("M50 24 L57 41 L75 42 L61 53 L66 71 L50 61 L34 71 L39 53 L25 42 L43 41 Z", 4.5)],
  traffic: [["rect", { x: 38, y: 22, width: 24, height: 56, rx: 10, w: 5 }], DOT(50, 35, 5), DOT(50, 50, 5), DOT(50, 65, 5)],
};

/** [key, Hebrew name, category, base color] */
export const SUBJECT_TILES: [string, string, string, string][] = [
  ["heb", "לשון", "lang", "#1FA8C9"], ["lit", "ספרות", "lang", "#23B26D"], ["eng", "אנגלית", "lang", "#EE5A8F"], ["arabic", "ערבית", "lang", "#0F9E8E"],
  ["french", "צרפתית", "lang", "#4F70C9"], ["spanish", "ספרדית", "lang", "#E5484D"], ["russian", "רוסית", "lang", "#3D5A9E"], ["chinese", "סינית", "lang", "#D93B3B"], ["amharic", "אמהרית", "lang", "#2E9D5B"],
  ["bible", "תנ״ך", "spirit", "#D08A45"], ["talmud", "תושב״ע", "spirit", "#A86B3C"], ["jthought", "מחשבת ישראל", "spirit", "#2F62C8"], ["judaism", "יהדות", "spirit", "#8C6BD6"],
  ["math", "מתמטיקה", "stem", "#3B7BF2"], ["phys", "פיזיקה", "stem", "#9257EC"], ["chem", "כימיה", "stem", "#13A3B8"], ["bio", "ביולוגיה", "stem", "#6FAE24"],
  ["biotech", "ביוטכנולוגיה", "stem", "#D946B5"], ["science", "מדעים", "stem", "#38A1F2"], ["env", "מדעי הסביבה", "stem", "#1E9E62"], ["agri", "חקלאות", "stem", "#8AA61E"],
  ["astro", "אסטרונומיה", "stem", "#4B4FC9"], ["geology", "גאולוגיה", "stem", "#A0785A"],
  ["cs", "מדעי המחשב", "tech", "#5A6B88"], ["software", "הנדסת תוכנה", "tech", "#7457E0"], ["robot", "רובוטיקה", "tech", "#FF6B3D"], ["electro", "אלקטרוניקה", "tech", "#E39A0E"], ["scitech", "מדע וטכנולוגיה", "tech", "#0E8FB5"],
  ["hist", "היסטוריה", "society", "#F0A21A"], ["civ", "אזרחות", "society", "#4F70C9"], ["geo", "גאוגרפיה", "society", "#2C93D8"], ["econ", "כלכלה", "society", "#1E9E62"],
  ["fin", "חינוך פיננסי", "society", "#C99A12"], ["psych", "פסיכולוגיה", "society", "#B05CE0"], ["socio", "סוציולוגיה", "society", "#E5484D"], ["socsci", "מדעי החברה", "society", "#C2507A"],
  ["media", "תקשורת", "society", "#FF7A45"], ["law", "משפטים", "society", "#5B4A8A"], ["mgmt", "ניהול", "society", "#6B7A90"],
  ["art", "אמנות", "arts", "#E5484D"], ["music", "מוזיקה", "arts", "#9257EC"], ["theater", "תיאטרון", "arts", "#D946B5"], ["film", "קולנוע", "arts", "#4A5568"],
  ["dance", "מחול", "arts", "#F2668B"], ["design", "עיצוב", "arts", "#F0A21A"], ["photo", "צילום", "arts", "#2F8F9D"],
  ["home", "שעת חינוך", "life", "#F2668B"], ["pe", "חינוך גופני", "life", "#FF6B3D"], ["health", "בריאות", "life", "#E04F5F"], ["nutrition", "תזונה", "life", "#7DB52A"],
  ["shelach", "של״ח", "life", "#6E9E2A"], ["volunteer", "מעורבות חברתית", "life", "#E5484D"], ["leader", "מנהיגות", "life", "#E0A11B"], ["traffic", "חינוך תעבורתי", "life", "#5A6B88"],
];
