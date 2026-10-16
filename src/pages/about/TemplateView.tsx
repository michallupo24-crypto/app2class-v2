// Renders a design-tool template (plain HTML with {{ path }} bindings,
// <sc-for list as>, <sc-if value> and sc-camel-on-* handlers) as React,
// so the About design can be used exactly as drawn. Parsed once, then
// re-rendered against fresh values every frame.
import { createElement, Fragment, type ReactNode } from "react";

type Node =
  | { kind: "text"; parts: (string | string[])[] }
  | { kind: "el"; tag: string; attrs: [string, (string | string[])[]][]; children: Node[] }
  | { kind: "for"; list: string[]; as: string; children: Node[] }
  | { kind: "if"; value: string[]; children: Node[] };

const BIND = /\{\{\s*([\w.]+)\s*\}\}/g;

/** "a {{ x.y }} b" -> ["a ", ["x","y"], " b"] */
function splitBindings(s: string): (string | string[])[] {
  const out: (string | string[])[] = [];
  let last = 0;
  for (const m of s.matchAll(BIND)) {
    if (m.index! > last) out.push(s.slice(last, m.index));
    out.push(m[1].split("."));
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

const pathOf = (attr: string | null) => (attr ? splitBindings(attr).find((p) => Array.isArray(p)) as string[] : []);

function compile(el: Element): Node[] {
  const out: Node[] = [];
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      // Collapse whitespace as HTML would; whitespace-only nodes become one space.
      const t = (n.textContent || "").replace(/\s+/g, " ");
      if (t) out.push({ kind: "text", parts: splitBindings(t) });
      return;
    }
    if (n.nodeType !== 1) return;
    const e = n as Element;
    const tag = e.tagName.toLowerCase();
    if (tag === "sc-for") { out.push({ kind: "for", list: pathOf(e.getAttribute("list")), as: e.getAttribute("as") || "item", children: compile(e) }); return; }
    if (tag === "sc-if") { out.push({ kind: "if", value: pathOf(e.getAttribute("value")), children: compile(e) }); return; }
    if (tag === "style" || tag === "script") return;
    const attrs: [string, (string | string[])[]][] = [];
    for (const a of Array.from(e.attributes)) {
      if (a.name.startsWith("hint-") || a.name === "style-hover") continue;
      attrs.push([a.name, splitBindings(a.value)]);
    }
    out.push({ kind: "el", tag: e.namespaceURI === "http://www.w3.org/2000/svg" ? e.tagName : tag, attrs, children: compile(e) });
  });
  return out;
}

const cache = new Map<string, Node[]>();
function parse(html: string): Node[] {
  let tree = cache.get(html);
  if (!tree) {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
    tree = compile(doc.body);
    cache.set(html, tree);
  }
  return tree;
}

type Scope = Record<string, any>;
const get = (scope: Scope, path: string[]) => path.reduce((v: any, k) => (v == null ? undefined : v[k]), scope);
const interp = (parts: (string | string[])[], scope: Scope) =>
  parts.length === 1 && Array.isArray(parts[0]) ? get(scope, parts[0]) : parts.map((p) => (Array.isArray(p) ? get(scope, p) ?? "" : p)).join("");

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function styleObject(css: string) {
  const o: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
    if (k) o[k.startsWith("--") ? k : camel(k)] = v;
  }
  return o;
}

function render(nodes: Node[], scope: Scope, onLink: (href: string, e: any) => void, keyBase = ""): ReactNode[] {
  return nodes.map((n, i): ReactNode => {
    const key = keyBase + i;
    if (n.kind === "text") return interp(n.parts, scope);
    if (n.kind === "if") return get(scope, n.value) ? <Fragment key={key}>{render(n.children, scope, onLink, key + ".")}</Fragment> : null;
    if (n.kind === "for") {
      const list = (get(scope, n.list) as any[]) || [];
      return <Fragment key={key}>{list.map((item, j) => <Fragment key={j}>{render(n.children, { ...scope, [n.as]: item }, onLink, `${key}.${j}.`)}</Fragment>)}</Fragment>;
    }
    const props: Record<string, any> = { key };
    for (const [name, parts] of n.attrs) {
      const v = interp(parts, scope);
      if (name === "style") props.style = styleObject(String(v));
      else if (name === "class") props.className = v;
      else if (name.startsWith("sc-camel-")) props[camel(name.slice("sc-camel-".length))] = v;
      else if (name.startsWith("aria-") || name.startsWith("data-")) props[name] = v;
      else props[name.includes("-") || name.includes(":") ? camel(name.replace(":", "-")) : name] = v;
    }
    // In-app links navigate without a page load.
    if (n.tag === "a" && typeof props.href === "string" && props.href.startsWith("/") && !props.onClick) {
      const href = props.href;
      props.onClick = (e: any) => onLink(href, e);
    }
    return createElement(n.tag, props, ...(n.children.length ? render(n.children, scope, onLink, key + ".") : []));
  });
}

export function TemplateView({ html, values, onLink }: { html: string; values: Record<string, any>; onLink: (href: string, e: any) => void }) {
  return <>{render(parse(html), values, onLink)}</>;
}
