// Avatar renderer, ported from the "Avatar Editor" design (AvatarSA).
// Layers, back to front: face (vector skin + shading image), eyes (image,
// clipped to the face), under-art (freckles, nose, brows, mouth, outfit,
// facial hair), hair (recolored SVG), over-art (accessories).
// Assets live in public/avatars/v2.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement as E, useEffect, useMemo, useReducer, useRef, type CSSProperties } from "react";

const RS = (u: string) => "/avatars/v2/" + u;

export const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v: number) => Math.max(0, Math.min(255, Math.round(v * f))));
  return "#" + c.map((v: number) => v.toString(16).padStart(2, "0")).join("");
};
const BODY = "M40 1012 C44 925 110 872 240 848 C282 840 300 830 316 818 Q405 868 494 818 C510 830 528 840 570 848 C700 872 766 925 770 1012 Z";
const BODY2 = "M40 1012 C44 925 110 872 240 848 C268 842 288 832 300 826 Q407 880 518 826 C528 832 544 842 570 848 C700 872 766 925 770 1012 Z";
const FP: { d: string | null; wait: (() => void)[] } = { d: null, wait: [] };
function facePath(cb: () => void): string | null {
  if (FP.d) return FP.d;
  FP.wait.push(cb);
  if (FP.wait.length === 1) fetch(RS("face-path.json")).then(r => r.json()).then(j => { FP.d = j.d; FP.wait.forEach((f) => f && f()); FP.wait = []; });
  return null;
}
function faceArt(d: string, skin: string, uid: string, shoulders: boolean, oc?: string) {
  const cid = uid + "fc";
  return E("svg", { viewBox: "0 0 810 1012", width: "100%", height: "100%", style: { position: "absolute", inset: 0 } },
    E("defs", null, E("clipPath", { id: cid }, E("path", { d })), E("clipPath", { id: cid + "n" }, E("path", { d: "M0 0 H810 V808 H0Z M301 800 H520 V1012 H301Z" }))),
    shoulders ? null : E("path", { d: "M244 860 C270 830 288 812 300 804 Q407 822 522 804 C534 812 552 830 578 860Z", fill: shade(oc || "#3B82F6", .5) }),
    shoulders ? null : E("path", { d: "M262 852 C282 830 296 818 304 812 Q407 830 518 812 C526 818 540 830 560 852Z", fill: "rgba(0,0,0,.18)" }),
    E("g", { clipPath: shoulders ? undefined : "url(#" + cid + "n)" },
      E("path", { d, fill: skin }),
      E("image", { href: RS("face-shade.png"), x: 0, y: 0, width: 810, height: 1012, clipPath: "url(#" + cid + ")", style: { mixBlendMode: "multiply" }, preserveAspectRatio: "none" })));
}
const ACC_FIT = { boy: [238, 403, 422], curly: [223, 406, 479], mullet: [228, 398, 366], girl_long: [207, 414, 445], bun: [232, 404, 407], curly_long: [194, 400, 493], ponytail: [212, 403, 415], short_girl: [268, 398, 388], none: [274, 408, 353] };
const HAIR_FIT = { boy: [1, 0, 0], curly: [1, 0, 0], mullet: [1, 0, 0], girl_long: [1, 0, 0], bun: [1, 0, 0], curly_long: [1, 0, 0], ponytail: [1, 0, 0], short_girl: [1, 0, 0] };
const EY: { done: Record<string, string>; wait: Record<string, (() => void)[]> } = { done: {}, wait: {} };
function eyesLayer(key: string, cb: () => void): string | null {
  if (EY.done[key]) return EY.done[key];
  if (EY.wait[key]) { EY.wait[key].push(cb); return null; }
  EY.wait[key] = [cb];
  const img = new Image(), face = new Image();
  let n = 0;
  const go = () => {
    if (++n < 2) return;
    const W = 810, H = 1012, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.drawImage(face, 0, 0, W, H);
    const fa = x.getImageData(0, 0, W, H).data;
    x.clearRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H), p = d.data, base = 0.2126 * 245 + 0.7152 * 197 + 0.0722 * 163;
    for (let i = 0; i < p.length; i += 4) {
      if (fa[i + 3] < 250) { p[i + 3] = 0; continue; }
      if (!p[i + 3]) continue;
      const r = p[i], g = p[i + 1], b = p[i + 2];
      if (r > 140 && r > g && g > b && r - b > 35) {
        const v = Math.min(255, Math.round(255 * (0.2126 * r + 0.7152 * g + 0.0722 * b) / base));
        p[i] = p[i + 1] = p[i + 2] = v;
      }
    }
    x.putImageData(d, 0, 0);
    EY.done[key] = c.toDataURL();
    EY.wait[key].forEach((f) => f && f()); delete EY.wait[key];
  };
  img.onload = go; face.onload = go;
  img.src = RS("eyes-" + key + ".png"); face.src = RS("face.png");
  return null;
}
const HS: { txt: Record<string, string>; wait: Record<string, (() => void)[]> } = { txt: {}, wait: {} };
function lum(h: string) { const n = parseInt(h.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); }
function recolor(text: string, color: string) {
  const counts: Record<string, number> = {};
  (text.match(/#[0-9A-Fa-f]{6}\b/g) || []).forEach((h: string) => { h = h.toUpperCase(); counts[h] = (counts[h] || 0) + 1; });
  const hexes = Object.keys(counts).filter((h: string) => {
    const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return !(r > 240 && g > 240 && b > 240) && !(r > 200 && g > 160 && b > 120 && r > g && g > b);
  });
  if (!hexes.length) return text;
  const main = hexes.sort((a, b) => counts[b] - counts[a])[0], ml = lum(main);
  let out = text;
  for (const h of hexes) {
    const d = (lum(h) - ml) / 255;
    out = out.replace(new RegExp(h, "gi"), h === main ? color : shade(color, d < 0 ? Math.max(.45, 1 + d * 1.6) : 1 + d * 1.4));
  }
  return out.replace(/<svg/, '<svg style="position:absolute;inset:0;width:100%;height:100%"');
}
function hairSvg(key: string, cb: () => void): string | null {
  if (HS.txt[key] !== undefined) return HS.txt[key];
  if (!HS.wait[key]) {
    HS.wait[key] = [];
    fetch(RS("hair/" + key + ".svg")).then(r => r.text()).then(t => { HS.txt[key] = t; HS.wait[key].forEach((f) => f()); }).catch(() => { HS.txt[key] = ""; });
  }
  HS.wait[key].push(cb);
  return null;
}

function grad(E: any, id: string, c: string) {
  return E("linearGradient", { id, x1: 0, x2: 1, y1: 0, y2: 0 },
    E("stop", { offset: "0", stopColor: shade(c, .72) }), E("stop", { offset: ".3", stopColor: c }),
    E("stop", { offset: ".7", stopColor: c }), E("stop", { offset: "1", stopColor: shade(c, .72) }));
}
function vgrad(E: any, id: string, a: string, b: string) {
  return E("linearGradient", { id, x1: 0, x2: 0, y1: 0, y2: 1 }, E("stop", { offset: "0", stopColor: a }), E("stop", { offset: "1", stopColor: b }));
}
const mir = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_m: string, x: string, y: string) => (810 - +x) + " " + y);
function pair(E: any, key: string, d: string, props: Record<string, any>) { return [E("path", { key: key + "a", d, ...props }), E("path", { key: key + "b", d: mir(d), ...props })]; }

function underArt(c: ArtConfig, uid: string) {
  const k: any[] = [];
  const oc = c.outfitColor || "#3B82F6", od = shade(oc, .74), odd = shade(oc, .55), ol = shade(oc, 1.22);
  const gid = uid + "g", vid = uid + "v", cid = uid + "c";
  k.push(E("defs", { key: "df" }, grad(E, gid, oc),
    vgrad(E, vid, "rgba(0,0,0,0)", "rgba(0,0,0,.22)"),
    E("clipPath", { id: cid }, E("path", { d: "M0 790 H810 V1012 H0Z" })),
    E("clipPath", { id: cid + "d" }, E("path", { d: "M226 852 L272 846 L282 912 Q340 898 405 936 Q470 898 528 912 L538 846 L584 852 L592 912 C690 930 762 960 770 1012 H40 C48 960 120 930 218 912Z" }))));
  const ex = c.expression || "happy";
  const M = (key: string, d: string, fill: string, op?: number) => E("path", { key, d, fill, opacity: op });
  if (c.freckles && c.freckles !== "none") {
    const many = c.freckles === "many", n = many ? 40 : 18;
    let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const fr: any[] = [];
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, t = rnd(), u = rnd();
      const cx = 405 + side * (34 + t * (many ? 120 : 92)), cy = 562 + u * (many ? 46 : 36) + t * t * 14;
      const r = 1.3 + rnd() * (many ? 1.6 : 1.3);
      fr.push(E("circle", { key: "f" + i, cx: cx.toFixed(1), cy: cy.toFixed(1), r: r.toFixed(1), opacity: (.28 + rnd() * .3).toFixed(2) }));
    }
    for (let i = 0; i < (many ? 7 : 3); i++) fr.push(E("circle", { key: "nb" + i, cx: (394 + rnd() * 22).toFixed(1), cy: (552 + rnd() * 20).toFixed(1), r: (1.2 + rnd()).toFixed(1), opacity: (.3 + rnd() * .25).toFixed(2) }));
    k.push(E("g", { key: "frk", fill: shade(c.skin || "#F5C5A3", .58), style: { mixBlendMode: "multiply" } }, fr));
  }
  k.push(E("g", { key: "fc", style: { mixBlendMode: "multiply" } },
    M("n1", "M416 546 C420 566 424 578 420 588 C416 584 412 570 416 546Z", "#B0644E", .22),
    E("path", { key: "n2", d: "M388 590 Q396 600 405 598 Q414 600 422 590", fill: "none", stroke: "#A2584A", strokeWidth: 5, strokeLinecap: "round", opacity: .45 }),
    E("g", { key: "bl", opacity: ex === "excited" ? .2 : .12 }, E("ellipse", { cx: 296, cy: 598, rx: 42, ry: 22, fill: "#F0606A" }), E("ellipse", { cx: 514, cy: 598, rx: 42, ry: 22, fill: "#F0606A" }))));
  const bc = c.hair === "none" ? shade(c.skin || "#F5C5A3", .55) : shade(c.hairColor || "#2C1A0E", .9);
  const by = ex === "excited" ? -14 : ex === "focused" ? 6 : 0;
  const browL = ex === "focused" ? "M262 432 Q316 424 372 448 Q372 458 364 458 Q316 440 266 446Z" : "M258 444 Q308 410 370 428 Q376 438 368 442 Q310 428 264 456Z";
  k.push(E("g", { key: "brow", transform: "translate(0 " + by + ")" }, ...pair(E, "bw", browL, { fill: bc })));
  if (ex === "cool") k[k.length - 1] = E("g", { key: "brow" }, E("path", { d: browL, fill: bc }), E("path", { d: mir(browL), fill: bc, transform: "translate(0 -14)" }));
  const lipD = "#9B3F3A", lipL = "rgba(190,90,90,.38)";
  const T = "#F6F0EB", O = "#6A2725", TG = "#D46A66";
  const mouths: Record<string, any[]> = {
    smile: [M("u", "M368 632 Q386 646 405 647 Q424 646 442 632 Q426 655 405 656 Q384 655 368 632Z", lipD), M("l", "M384 660 Q405 671 426 660 Q405 666 384 660Z", lipL)],
    soft: [M("u", "M380 641 Q405 650 430 641 Q405 657 380 641Z", lipD), M("l", "M390 662 Q405 669 420 662 Q405 666 390 662Z", lipL)],
    neutral: [M("u", "M382 646 Q405 642 428 646 Q405 653 382 646Z", lipD), M("l", "M390 663 Q405 668 420 663 Q405 666 390 663Z", lipL)],
    smirk: [M("u", "M378 648 Q410 654 438 632 Q416 664 378 648Z", lipD), M("l", "M392 666 Q408 672 422 664 Q408 669 392 666Z", lipL)],
    grin: [M("o", "M364 628 Q405 642 446 628 Q442 678 405 683 Q368 678 364 628Z", O), M("t", "M371 632 Q405 644 439 632 L437 646 Q405 654 373 646Z", T), M("tg", "M382 670 Q405 652 428 670 Q405 684 382 670Z", TG), M("ll", "M384 688 Q405 696 426 688 Q405 692 384 688Z", lipL)],
    toothy: [M("o", "M362 630 Q405 652 448 630 Q440 666 405 668 Q370 666 362 630Z", O), M("t", "M366 632 Q405 652 444 632 L441 644 Q405 662 369 644Z", T), M("tl", "M392 646 V658 M418 646 V658", "none"), M("ll", "M386 674 Q405 682 424 674 Q405 678 386 674Z", lipL)],
    laugh: [M("o", "M354 622 Q405 640 456 622 Q450 694 405 700 Q360 694 354 622Z", O), M("t", "M362 626 Q405 642 448 626 L446 640 Q405 654 364 640Z", T), M("tg", "M378 684 Q405 660 432 684 Q405 700 378 684Z", TG), M("ll", "M382 706 Q405 714 428 706 Q405 710 382 706Z", lipL)],
    oh: [M("o", "M405 632 C420 632 424 646 424 654 C424 666 416 674 405 674 C394 674 386 666 386 654 C386 646 390 632 405 632Z", O), M("tg", "M392 664 Q405 656 418 664 Q405 674 392 664Z", TG), M("ll", "M392 682 Q405 688 418 682 Q405 685 392 682Z", lipL)],
    tongue: [M("u", "M370 634 Q405 654 440 634 Q424 656 405 657 Q386 656 370 634Z", lipD), M("tg", "M388 652 Q390 684 405 686 Q420 684 422 652 Q405 660 388 652Z", TG), M("tc", "M405 662 V678", "none"), E("path", { key: "tcs", d: "M405 664 V678", stroke: "#B5524E", strokeWidth: 3, strokeLinecap: "round", fill: "none" })],
    braces: [M("o", "M364 630 Q405 650 446 630 Q440 666 405 668 Q370 666 364 630Z", O), M("t", "M368 632 Q405 650 442 632 L440 646 Q405 662 370 646Z", T),
      E("path", { key: "br", d: "M372 640 Q405 655 438 640", stroke: "#9AA3B2", strokeWidth: 3.5, fill: "none" }),
      ...[382, 394, 405, 416, 428].map((x: number, i: number) => E("rect", { key: "bk" + i, x: x - 3.5, y: 641 + (Math.abs(x - 405) < 12 ? 5 : 2), width: 7, height: 6, rx: 1.5, fill: "#B8C0CC" })),
      M("ll", "M386 674 Q405 682 424 674 Q405 678 386 674Z", lipL)],
    pout: [M("u", "M386 642 Q396 634 405 639 Q414 634 424 642 Q405 650 386 642Z", "#A84B45"), M("l", "M390 648 Q405 664 420 648 Q405 654 390 648Z", "#C2645D"), M("lh", "M398 652 Q405 656 412 652", "none")],
    side: [M("u", "M384 648 Q416 652 438 628 Q420 662 384 648Z", lipD), M("dp", "M444 624 Q448 632 444 638", "none"), E("path", { key: "dps", d: "M444 622 Q449 630 445 638", stroke: "rgba(140,70,50,.35)", strokeWidth: 3.5, fill: "none", strokeLinecap: "round" })],
  };
  const EXM: Record<string, string> = { happy: "smile", excited: "grin", calm: "soft", focused: "neutral", cool: "smirk" };
  const mk = c.mouth || EXM[ex] || "smile";
  if (mk === "toothy") mouths.toothy.push(E("path", { key: "tls", d: "M392 648 V658 M418 648 V658", stroke: "rgba(0,0,0,.08)", strokeWidth: 2 }));
  k.push(E("g", { key: "mo", style: { mixBlendMode: "multiply" } }, mouths[mk] || mouths.smile));

  const fill = "url(#" + gid + ")", o = c.outfit || "hoodie";
  const parts: any[] = [E("path", { key: "base", d: BODY2, fill }), E("path", { key: "vs", d: BODY2, fill: "url(#" + vid + ")" })];
  const hiS = pair(E, "hs", "M96 930 C140 884 204 862 252 858 C214 876 158 900 112 950Z", { fill: "#fff", opacity: .16 });
  const fold = pair(E, "fd", "M146 952 C168 972 178 994 176 1012 L162 1012 C164 994 158 974 146 952Z", { fill: odd, opacity: .45 });
  const setIn = pair(E, "si", "M236 856 C216 900 208 952 212 1012", { fill: "none", stroke: odd, strokeWidth: 4, opacity: .45 });
  const raglan = pair(E, "rg", "M306 846 C270 890 232 944 206 1012", { fill: "none", stroke: odd, strokeWidth: 4, opacity: .45 });
  const NL = "M300 826 Q407 880 518 826", rib = (k2: string, col: string, w: number) => E("path", { key: k2, d: NL + " L" + (510 + w) + " " + (840 + w * .3) + " Q405 " + (880 + w * 1.6) + " " + (300 - w) + " " + (840 + w * .3) + "Z", fill: col });
  if (o === "hoodie") parts.push(...hiS, ...fold, ...raglan,
    E("path", { key: "hood", d: "M258 868 C244 820 276 800 300 832 Q405 880 510 826 C534 800 566 820 552 868 Q405 990 258 868Z", fill: od }),
    ...pair(E, "hh", "M268 860 C262 828 280 814 296 830 C284 834 278 846 280 866Z", { fill: ol, opacity: .5 }),
    E("path", { key: "nh", d: NL + " Q480 870 405 896 Q330 870 300 832Z", fill: odd, opacity: .0 }),
    E("path", { key: "ds1", d: "M372 900 C368 926 368 950 372 976 L380 976 C376 950 376 926 380 902Z", fill: "#EEF0F3" }),
    E("path", { key: "ds2", d: "M438 900 C442 926 442 950 438 976 L430 976 C434 950 434 926 430 902Z", fill: "#EEF0F3" }),
    E("path", { key: "pk", d: "M280 1012 C290 992 306 984 324 982 H486 C504 984 520 992 530 1012", fill: "none", stroke: odd, strokeWidth: 5 }));
  else if (o === "tshirt") parts.push(...hiS, ...fold, ...setIn, rib("rib", od, 14),
    E("path", { key: "rib2", d: "M294 836 Q405 892 516 836", fill: "none", stroke: ol, strokeWidth: 2.5, opacity: .6 }));
  else if (o === "formal") parts.push(...hiS, ...fold, ...setIn,
    E("rect", { key: "pl", x: 391, y: 896, width: 28, height: 118, fill: shade(oc, 1.06) }),
    E("path", { key: "pl2", d: "M391 896 V1012 M419 896 V1012", stroke: od, strokeWidth: 3 }),
    ...[944, 990].map((y: number, i: number) => E("circle", { key: "bt" + i, cx: 405, cy: y, r: 7, fill: "#F4F4F2", stroke: shade(oc, .6), strokeWidth: 2 })),
    ...pair(E, "cl", "M298 828 L405 900 L362 950 L278 848Z", { fill: ol, stroke: od, strokeWidth: 3, strokeLinejoin: "round" }));
  else if (o === "polo") parts.push(...hiS, ...fold, ...setIn,
    E("rect", { key: "pl", x: 389, y: 878, width: 32, height: 70, rx: 4, fill: shade(oc, 1.06), stroke: od, strokeWidth: 3 }),
    ...[902, 930].map((y: number, i: number) => E("circle", { key: "bt" + i, cx: 405, cy: y, r: 6, fill: "#F4F4F2", stroke: shade(oc, .6), strokeWidth: 2 })),
    ...pair(E, "cl", "M298 828 Q336 832 389 880 L374 914 Q324 900 282 848Z", { fill: ol, stroke: od, strokeWidth: 3, strokeLinejoin: "round" }),
    E("path", { key: "lg", d: "M508 930 H548 V954 Q528 972 508 954Z", fill: "#fff", opacity: .9 }));
  else if (o === "jacket") parts.push(...hiS, ...fold,
    E("path", { key: "tee", d: NL + " L496 1012 H314Z", fill: "#F1F2F4" }),
    E("path", { key: "teen", d: NL + " L516 836 Q405 894 294 836Z", fill: "#D9DCE1" }),
    ...pair(E, "fr", "M294 842 L322 1012 L304 1012 L278 848Z", { fill: od }),
    ...pair(E, "cst", "M276 852 C270 820 286 808 300 830 L306 862 L282 868Z", { fill: ol, stroke: od, strokeWidth: 3, strokeLinejoin: "round" }),
    ...pair(E, "pk", "M226 966 L286 956", { fill: "none", stroke: odd, strokeWidth: 5, strokeLinecap: "round" }));
  else if (o === "sweater") parts.push(...hiS, ...raglan, rib("rib", od, 20),
    E("path", { key: "rib2", d: "M292 838 Q405 898 518 838", fill: "none", stroke: ol, strokeWidth: 2, strokeDasharray: "3 5", opacity: .7 }),
    E("path", { key: "bn", d: "M60 956 H750 L760 986 H50Z", fill: ol, opacity: .9 }),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i: number) => E("path", { key: "dm" + i, d: "M" + (90 + i * 70) + " 971 l10 -7 l10 7 l-10 7Z", fill: odd })));
  else if (o === "sport") parts.push(...hiS, ...raglan,
    ...pair(E, "sp", "M306 846 C270 890 232 944 206 1012 L232 1012 C256 950 290 896 322 856Z", { fill: "#fff", opacity: .9 }),
    E("path", { key: "vfill", d: "M332 852 L405 926 L478 852 Q405 900 332 852Z", fill: c.skin || "#F5C5A3" }),
    E("path", { key: "vn", d: "M300 832 L405 930 L510 832 L522 842 L405 952 L288 842Z", fill: "#fff" }),
    E("text", { key: "num", x: 540, y: 996, fontSize: 60, fontWeight: 900, fontFamily: "Rubik, sans-serif", fill: "#fff", textAnchor: "middle" }, "7"));
  else if (o === "plaid") parts.push(
    E("defs", { key: "pd" }, E("pattern", { id: uid + "pl", width: 72, height: 72, patternUnits: "userSpaceOnUse" },
      E("rect", { width: 72, height: 72, fill: oc }),
      E("rect", { x: 0, y: 24, width: 72, height: 18, fill: odd, opacity: .55 }), E("rect", { x: 24, y: 0, width: 18, height: 72, fill: odd, opacity: .55 }),
      E("rect", { x: 0, y: 58, width: 72, height: 4, fill: "#fff", opacity: .45 }), E("rect", { x: 58, y: 0, width: 4, height: 72, fill: "#fff", opacity: .45 }))),
    E("path", { key: "pt", d: BODY2, fill: "url(#" + uid + "pl)" }), E("path", { key: "vs2", d: BODY2, fill: "url(#" + vid + ")" }), ...setIn,
    E("rect", { key: "pl", x: 391, y: 896, width: 28, height: 118, fill: oc, stroke: odd, strokeWidth: 3 }),
    ...[944, 990].map((y: number, i: number) => E("circle", { key: "bt" + i, cx: 405, cy: y, r: 7, fill: "#F4F4F2", stroke: odd, strokeWidth: 2 })),
    ...pair(E, "cl", "M298 828 L405 900 L362 950 L278 848Z", { fill: oc, stroke: odd, strokeWidth: 3, strokeLinejoin: "round" }));
  else if (o === "dress") {
    parts.length = 0;
    const DR = "M226 852 L272 846 L282 912 Q340 898 405 936 Q470 898 528 912 L538 846 L584 852 L592 912 C690 930 762 960 770 1012 H40 C48 960 120 930 218 912Z";
    parts.push(E("path", { key: "base", d: DR, fill }), E("rect", { key: "vs", x: 0, y: 900, width: 810, height: 112, fill: "url(#" + vid + ")" }),
      E("path", { key: "nl", d: "M282 912 Q340 898 405 936 Q470 898 528 912 Q470 912 405 948 Q340 912 282 912Z", fill: od }),
      E("path", { key: "nl2", d: "M282 912 Q340 898 405 936 Q470 898 528 912", fill: "none", stroke: ol, strokeWidth: 3, opacity: .7 }),
      ...pair(E, "st", "M228 854 L270 848 L276 892 L234 896Z", { fill: ol, opacity: .35 }),
      ...pair(E, "bk", "M232 896 H278 V912 H232Z", { fill: "#D6B25E", stroke: "#9C7A2A", strokeWidth: 2 }),
      ...pair(E, "df", "M300 960 C320 980 326 996 324 1012 L314 1012 C316 996 310 980 300 960Z", { fill: odd, opacity: .4 }),
      ...pair(E, "dh", "M110 960 C150 934 196 920 230 916 C196 930 152 950 124 976Z", { fill: "#fff", opacity: .14 }));
  }
  k.push(E("g", { key: "of", clipPath: "url(#" + cid + (o === "dress" ? "d" : "") + ")" }, parts));

  const fh = c.facialHair || "none", hc = c.hairColor || "#2C1A0E", hd = shade(hc, .62), hl = shade(hc, 1.5);
  if (fh === "beard") k.push(E("g", { key: "be" },
    E("path", { d: "M246 586 C254 708 322 790 405 794 C488 790 556 708 564 586 C548 650 512 680 466 684 Q405 704 344 684 C298 680 262 650 246 586Z", fill: hc }),
    ...pair(E, "bs", "M262 640 C272 700 300 742 336 768 C306 738 282 700 270 640Z", { fill: hd, opacity: .7 }),
    ...pair(E, "bh", "M286 688 C306 722 330 746 358 760 C330 736 310 716 296 690Z", { fill: hl, opacity: .45 }),
    E("path", { d: "M380 728 C390 752 398 770 405 786 C412 770 420 752 430 728 C420 748 412 760 405 768 C398 760 390 748 380 728Z", fill: hd, opacity: .6 })));
  if (fh === "mustache" || fh === "beard") k.push(E("g", { key: "mu" },
    E("path", { d: "M360 626 C374 606 396 606 405 616 C414 606 436 606 450 626 C432 622 418 626 405 630 C392 626 378 622 360 626Z", fill: hc }),
    E("path", { d: "M372 616 C384 610 396 612 402 618 C392 616 382 616 372 620Z", fill: hl, opacity: .5 }),
    E("path", { d: "M408 618 C414 612 426 610 438 616 L438 620 C428 616 418 616 408 618Z", fill: hl, opacity: .5 })));
  if (fh === "goatee") k.push(E("g", { key: "go" },
    E("path", { d: "M376 688 Q405 748 434 688 Q405 702 376 688Z", fill: hc }),
    E("path", { d: "M396 700 Q405 730 414 700 Q405 712 396 700Z", fill: hd, opacity: .6 })));
  return E("svg", { viewBox: "0 0 810 1012.5", width: "100%", height: "100%", style: { position: "absolute", inset: 0 } }, k);
}

function overArt(c: ArtConfig, uid: string) {
  const k: any[] = [], a = c.accessory || "none";
  const oc = c.outfitColor || "#3B82F6", od = shade(oc, .72), odd = shade(oc, .55), ol = shade(oc, 1.22);
  k.push(E("defs", { key: "gd" }, grad(E, uid + "g", oc), vgrad(E, uid + "cv", ol, od),
    vgrad(E, uid + "ln", "rgba(255,255,255,.28)", "rgba(255,255,255,.04)"), vgrad(E, uid + "sn", "#465573", "#0E1422"),
    vgrad(E, uid + "au", "#FFE07A", "#E0A11B")));
  if (a === "glasses" || a === "sunglasses") {
    const sun = a === "sunglasses";
    const lens = (x: number, kk: string) => [
      E("rect", { key: kk + "sh", x, y: 450, width: 126, height: 86, rx: 38, fill: "none", stroke: "rgba(60,30,20,.16)", strokeWidth: 10 }),
      E("rect", { key: kk + "l", x, y: 440, width: 126, height: 86, rx: 38, fill: sun ? "url(#" + uid + "sn)" : "url(#" + uid + "ln)", stroke: "#262B36", strokeWidth: 9 }),
      E("path", { key: kk + "hl", d: "M" + (x + 30) + " 446 Q" + (x + 63) + " 440 " + (x + 96) + " 446", fill: "none", stroke: "#6B7487", strokeWidth: 3, strokeLinecap: "round" }),
      E("path", { key: kk + "rf", d: "M" + (x + 18) + " 512 L" + (x + 58) + " 452 L" + (x + 74) + " 452 L" + (x + 34) + " 516Z", fill: "#fff", opacity: sun ? .16 : .22 }),
    ];
    k.push(E("g", { key: "gl" },
      E("path", { d: "M258 470 L228 460 M552 470 L582 460", stroke: "#262B36", strokeWidth: 8, strokeLinecap: "round" }),
      ...lens(258, "L"), ...lens(426, "R"),
      E("path", { d: "M384 474 Q405 460 426 474", fill: "none", stroke: "#262B36", strokeWidth: 8, strokeLinecap: "round" })));
  }
  if (a === "cap") k.push(E("g", { key: "cap" },
    E("path", { d: "M226 440 Q405 410 584 440 Q405 474 226 440Z", fill: "rgba(40,20,10,.2)" }),
    E("path", { d: "M214 400 C206 254 300 214 405 214 C510 214 604 254 596 400 Q405 374 214 400Z", fill: "url(#" + uid + "cv)" }),
    E("path", { d: "M214 400 C206 254 300 214 405 214 C330 230 270 290 262 396Z", fill: odd, opacity: .3 }),
    E("path", { d: "M405 216 V386 M300 236 Q330 300 332 390 M510 236 Q480 300 478 390", fill: "none", stroke: od, strokeWidth: 3.5 }),
    E("path", { d: "M412 222 V384 M308 246 Q336 304 339 388 M502 246 Q474 304 471 388", fill: "none", stroke: ol, strokeWidth: 2, strokeDasharray: "6 6", opacity: .6 }),
    E("path", { d: "M440 240 C500 246 548 280 566 330 C530 290 490 262 440 252Z", fill: "#fff", opacity: .18 }),
    E("circle", { cx: 405, cy: 218, r: 12, fill: od }), E("circle", { cx: 402, cy: 215, r: 4, fill: ol }),
    E("path", { d: "M198 404 Q405 366 612 404 Q624 424 614 446 Q405 410 196 446 Q186 424 198 404Z", fill: od }),
    E("path", { d: "M204 410 Q405 376 606 410 Q405 392 204 410Z", fill: ol, opacity: .5 }),
    E("path", { d: "M196 446 Q405 410 614 446 Q405 420 196 446Z", fill: odd })));
  if (a === "kippah") k.push(E("g", { key: "kp" },
    E("path", { d: "M318 268 Q405 190 492 268 Q405 290 318 268Z", fill: "#22304F" }),
    E("path", { d: "M336 258 Q405 236 474 258", fill: "none", stroke: "#E0B640", strokeWidth: 6, strokeDasharray: "8 4" }),
    E("path", { d: "M356 240 Q405 222 454 240", fill: "none", stroke: "#F3F0E6", strokeWidth: 4, strokeDasharray: "6 4" }),
    E("path", { d: "M326 270 Q405 286 484 270", fill: "none", stroke: "#141D33", strokeWidth: 4 })));
  if (a === "hijab") k.push(E("g", { key: "hj" },
    E("path", { fillRule: "evenodd", fill: "url(#" + uid + "g)", d: "M405 200 C628 200 668 400 656 560 C646 700 700 830 770 1012 H40 C110 830 164 700 154 560 C142 400 182 200 405 200Z M405 330 C515 330 572 420 572 520 C572 660 496 772 405 772 C314 772 238 660 238 520 C238 420 295 330 405 330Z" }),
    E("path", { d: "M244 520 C244 424 298 338 405 338 C512 338 566 424 566 520 C566 654 494 764 405 764 C316 764 244 654 244 520Z", fill: "none", stroke: "rgba(60,30,20,.16)", strokeWidth: 14 }),
    E("path", { d: "M238 520 C238 420 295 330 405 330 C515 330 572 420 572 520 C572 660 496 772 405 772 C314 772 238 660 238 520Z", fill: "none", stroke: od, strokeWidth: 8 }),
    ...pair(E, "hf", "M196 540 C204 680 248 790 336 868 C262 806 214 704 202 560Z", { fill: odd, opacity: .55 }),
    ...pair(E, "hf2", "M168 700 C176 820 120 920 90 1012 L110 1012 C140 920 188 820 180 700Z", { fill: odd, opacity: .4 }),
    E("path", { d: "M300 246 C360 216 450 216 510 246 C450 232 360 232 300 246Z", fill: "#fff", opacity: .22 }),
    E("path", { d: "M220 820 Q320 900 405 892 Q500 900 600 820 Q500 880 405 876 Q320 880 220 820Z", fill: odd, opacity: .45 })));
  if (a === "headscarf") k.push(E("g", { key: "hs" },
    E("defs", null, E("filter", { id: uid + "hsb", x: "-20%", y: "-50%", width: "140%", height: "200%" }, E("feGaussianBlur", { stdDeviation: 7 }))),
    E("path", { d: "M228 424 C270 382 340 358 405 358 C470 358 540 382 582 424 C540 404 470 390 405 390 C340 390 270 404 228 424Z", fill: "rgba(60,25,10,.32)", filter: "url(#" + uid + "hsb)" }),
    E("path", { d: "M236 418 C276 382 342 362 405 362 C468 362 534 382 574 418 C534 398 468 380 405 380 C342 380 276 398 236 418Z", fill: "rgba(60,25,10,.18)" }),
    E("path", { d: "M204 436 C186 262 300 204 405 204 C510 204 624 262 606 436 C560 384 476 356 405 356 C334 356 250 384 204 436Z", fill: "url(#" + uid + "g)" }),
    E("path", { d: "M232 334 C300 290 360 276 420 280 C350 290 290 310 240 350Z", fill: odd, opacity: .45 }),
    E("path", { d: "M220 396 C300 330 380 314 460 320 C380 330 300 356 228 410Z", fill: odd, opacity: .4 }),
    E("path", { d: "M320 232 C380 214 450 216 500 236 C450 228 380 228 320 240Z", fill: "#fff", opacity: .25 }),
    E("g", { transform: "translate(-16 40)" },
      E("path", { d: "M590 300 C632 296 650 330 640 368 C626 344 608 330 588 320Z", fill: od }),
      E("path", { d: "M598 318 C618 344 620 380 606 410 C602 380 596 352 586 328Z", fill: odd }),
      E("ellipse", { cx: 592, cy: 312, rx: 26, ry: 20, fill: "rgba(40,20,10,.22)" }),
      E("ellipse", { cx: 592, cy: 306, rx: 24, ry: 19, fill: oc }), E("path", { d: "M578 300 Q592 292 606 300", fill: "none", stroke: ol, strokeWidth: 4, strokeLinecap: "round" }))));
  if (a === "star") k.push(E("g", { key: "st" },
    E("polygon", { points: starPts(558, 330, 34, 15, 5), fill: "rgba(40,20,10,.25)" }),
    E("polygon", { points: starPts(556, 326, 34, 15, 5), fill: "url(#" + uid + "au)", stroke: "#B07A10", strokeWidth: 3, strokeLinejoin: "round" }),
    E("polygon", { points: starPts(552, 320, 12, 5, 5), fill: "#fff", opacity: .6 })));
  if (a === "hearing_aid") k.push(E("g", { key: "ha" },
    E("path", { d: "M604 500 C636 504 642 562 620 600", fill: "none", stroke: "#BFB3A2", strokeWidth: 22, strokeLinecap: "round" }),
    E("path", { d: "M604 500 C636 504 642 562 620 600", fill: "none", stroke: "#E9DFD0", strokeWidth: 16, strokeLinecap: "round" }),
    E("path", { d: "M612 506 C630 514 634 540 630 560", fill: "none", stroke: "#fff", strokeWidth: 4, strokeLinecap: "round", opacity: .7 }),
    E("circle", { cx: 622, cy: 556, r: 4, fill: "#1268E8" })));
  const [crown, cx, w] = (ACC_FIT as any)[c.hair || "boy"] || ACC_FIT.boy;
  const sx = Math.max(1, w / 400), sy = Math.max(1, (420 - crown) / 206), dx = cx - 405;
  const tf: Record<string, string> = {
    cap: "translate(" + (405 + dx) + " 420) scale(" + sx + " " + sy + ") translate(-405 -420)",
    hs: "translate(" + (405 + dx) + " 420) scale(" + sx + " " + sy + ") translate(-405 -420)",
    kp: "translate(" + dx + " " + (crown + 52 - 280) + ")",
    st: "translate(" + (cx + w * 0.36 - 556) + " " + (crown + 110 - 326) + ")",
  };
  const placed = k.map((el: any) => el && tf[el.key] ? E("g", { key: el.key + "-fit", transform: tf[el.key] }, el) : el);
  return E("svg", { viewBox: "0 0 810 1012.5", width: "100%", height: "100%", style: { position: "absolute", inset: 0, overflow: "visible" } }, placed);
}
function starPts(cx: number, cy: number, R: number, r: number, n: number) {
  return Array.from({ length: n * 2 }, (_, i) => { const a = (-90 + i * 180 / n) * Math.PI / 180, d = i % 2 ? r : R; return (cx + d * Math.cos(a)).toFixed(1) + "," + (cy + d * Math.sin(a)).toFixed(1); }).join(" ");
}


export interface ArtConfig {
  skin?: string;
  eyes?: string;
  hair?: string;
  hairColor?: string;
  expression?: string;
  mouth?: string;
  outfit?: string;
  outfitColor?: string;
  accessory?: string;
  facialHair?: string;
  freckles?: string;
  background?: string;
}

export type ArtMode = "full" | "head" | "face";
const FRAMES: Record<ArtMode, [string, string, string]> = {
  full: ["6%", "-10%", "88%"],
  head: ["-14%", "-22%", "128%"],
  face: ["-28%", "-44%", "156%"],
};

/** Draws an avatar into a square box that fills its parent's width. */
export function AvatarArt({ cfg, mode = "full", sticker = true }: { cfg: ArtConfig; mode?: ArtMode; sticker?: boolean }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const refresh = () => { if (alive.current) rerender(); };
  const uid = useMemo(() => "av" + Math.random().toString(36).slice(2, 8), []);

  const [L, T, W] = FRAMES[mode] || FRAMES.full;
  const a = cfg.accessory || "none";
  const d = facePath(refresh);
  const eyes = eyesLayer(cfg.eyes || "brown", refresh);
  const hairKey = cfg.hair || "boy";
  const hairText = hairKey === "none" || a === "hijab" ? null : hairSvg(hairKey, refresh);
  const [sc, dx, dy] = (HAIR_FIT as any)[hairKey] || [1, 0, 0];
  const outline = sticker
    ? "drop-shadow(0.7cqw 0 0 #fff) drop-shadow(-0.7cqw 0 0 #fff) drop-shadow(0 0.7cqw 0 #fff) drop-shadow(0 -0.7cqw 0 #fff) drop-shadow(0 1.2cqw 1.4cqw rgba(27,35,51,.22))"
    : "none";
  const box = { position: "relative", width: "100%", aspectRatio: "1", overflow: "hidden", background: cfg.background || "#E0F2FE", containerType: "inline-size" } as CSSProperties;

  return (
    <div style={box}>
      <div style={{ position: "absolute", left: L, top: T, width: W, aspectRatio: "810/1012", filter: outline }}>
        <div style={{ position: "absolute", inset: 0 }}>{d ? faceArt(d, cfg.skin || "#F5C5A3", uid, cfg.outfit === "dress", cfg.outfitColor) : null}</div>
        {eyes && <img src={eyes} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "multiply" }} />}
        <div style={{ position: "absolute", inset: 0 }}>{underArt(cfg, uid)}</div>
        {hairText && (
          <div style={{ position: "absolute", inset: 0 }}>
            <div
              style={{ position: "absolute", inset: 0, transform: `translate(${dx}%,${dy}%) scale(${sc})`, transformOrigin: "50% 45%" }}
              dangerouslySetInnerHTML={{ __html: recolor(hairText, cfg.hairColor || "#2C1A0E") }}
            />
          </div>
        )}
        <div style={{ position: "absolute", inset: 0 }}>{overArt(cfg, uid)}</div>
      </div>
    </div>
  );
}
