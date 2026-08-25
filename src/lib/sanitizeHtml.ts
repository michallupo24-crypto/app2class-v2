import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["h2", "h3", "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "blockquote", "a", "div"];
const ALLOWED_ATTR = ["href", "target", "rel"];

export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });

export const stripHtmlToText = (html: string): string => {
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html);
  return (div.textContent || "").trim();
};
