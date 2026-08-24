let savedSelectionRange: Range | null = null;

/**
 * Returns the currently active contenteditable element (or the last focused one)
 */
export function getActiveEditor(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  if (active && active.getAttribute('contenteditable') === 'true') {
    return active as HTMLElement;
  }
  if (active && active.closest('[contenteditable="true"]')) {
    return active.closest('[contenteditable="true"]') as HTMLElement;
  }
  if (savedSelectionRange) {
    const container = savedSelectionRange.commonAncestorContainer;
    const parent = container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement;
    const editor = parent?.closest('[contenteditable="true"]') as HTMLElement;
    if (editor) return editor;
  }
  return document.querySelector('[contenteditable="true"]') as HTMLElement;
}

export function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const editor = getActiveEditor();
    if (editor && editor.contains(range.commonAncestorContainer)) {
      savedSelectionRange = range.cloneRange();
    }
  }
}

export function restoreSelectionAndFocus(): boolean {
  const editor = getActiveEditor();
  if (!editor) return false;

  editor.focus();

  if (savedSelectionRange) {
    const sel = window.getSelection();
    if (sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRange);
        return true;
      } catch (e) {
        console.warn('Failed to restore selection:', e);
      }
    }
  }
  return false;
}

export function restoreSelection(): boolean {
  return restoreSelectionAndFocus();
}

export function insertHtmlAtCursorOrAppend(htmlString: string): string {
  const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
  if (!editor) return '';

  editor.focus();

  // Try restoring saved selection
  if (savedSelectionRange) {
    const sel = window.getSelection();
    if (sel) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRange);
      } catch (e) {
        console.warn('Could not restore saved selection:', e);
      }
    }
  }

  const sel = window.getSelection();
  let range: Range | null = null;

  if (sel && sel.rangeCount > 0) {
    const curRange = sel.getRangeAt(0);
    if (editor.contains(curRange.commonAncestorContainer)) {
      range = curRange;
    }
  }

  // If selection is missing or outside editor, default to collapsed range at end of editor
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  let inserted = false;

  // 1. Try document.execCommand('insertHTML') first for inline elements
  const isTableOrBlock = /<table|<div|<figure|<hr|<blockquote/i.test(htmlString);
  if (!isTableOrBlock) {
    try {
      inserted = document.execCommand('insertHTML', false, htmlString);
    } catch (e) {
      inserted = false;
    }
  }

  // 2. Direct DOM insertion for tables and block elements
  if (!inserted && range) {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString.trim();

      const fragment = document.createDocumentFragment();
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }

      if (isTableOrBlock) {
        let container: Node | null = range.commonAncestorContainer;
        while (container && container.parentNode !== editor && container !== editor) {
          container = container.parentNode;
        }

        if (container && container !== editor && container.parentNode === editor) {
          if (container.nextSibling) {
            editor.insertBefore(fragment, container.nextSibling);
          } else {
            editor.appendChild(fragment);
          }
          inserted = true;
        } else {
          editor.appendChild(fragment);
          inserted = true;
        }
      } else {
        range.deleteContents();
        range.insertNode(fragment);
        inserted = true;
      }
    } catch (err) {
      console.warn('Direct DOM insertion error:', err);
    }
  }

  // 3. Fallback: Create elements and append to editor
  if (!inserted) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString.trim();
    while (tempDiv.firstChild) {
      editor.appendChild(tempDiv.firstChild);
    }
  }

  saveSelection();

  // Trigger React input event
  const event = new Event('input', { bubbles: true });
  editor.dispatchEvent(event);

  return editor.innerHTML;
}

export function formatDoc(command: string, value: string | null = null): string {
  restoreSelectionAndFocus();
  try {
    document.execCommand(command, false, value || undefined);
  } catch (err) {
    console.warn('execCommand failed:', err);
  }

  const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
  if (editor) {
    const event = new Event('input', { bubbles: true });
    editor.dispatchEvent(event);
    return editor.innerHTML;
  }
  return '';
}

export function applyStyleToSelectionOrNode(
  styleName: 'color' | 'fontSize' | 'backgroundColor' | 'fontFamily',
  value: string,
  targetElement?: HTMLElement | null
): string {
  restoreSelectionAndFocus();

  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch (e) {}

  const sel = window.getSelection();

  if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
    if (styleName === 'color') {
      document.execCommand('foreColor', false, value);
    } else if (styleName === 'backgroundColor') {
      document.execCommand('hiliteColor', false, value);
    } else if (styleName === 'fontFamily') {
      document.execCommand('fontName', false, value);
    } else if (styleName === 'fontSize') {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = value.endsWith('px') ? value : `${value}px`;
      try {
        span.appendChild(range.extractContents());
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.removeAllRanges();
        sel.addRange(newRange);
        savedSelectionRange = newRange.cloneRange();
      } catch (e) {
        document.execCommand('fontSize', false, '4');
      }
    }
  } else if (targetElement) {
    const el = targetElement.closest('h1, h2, h3, p, li, span, td, th, blockquote, div') as HTMLElement;
    if (el) {
      if (styleName === 'color') el.style.color = value;
      else if (styleName === 'fontSize') el.style.fontSize = value.endsWith('px') ? value : `${value}px`;
      else if (styleName === 'backgroundColor') el.style.backgroundColor = value;
      else if (styleName === 'fontFamily') el.style.fontFamily = value;
    }
  } else {
    if (styleName === 'color') document.execCommand('foreColor', false, value);
    else if (styleName === 'backgroundColor') document.execCommand('hiliteColor', false, value);
    else if (styleName === 'fontFamily') document.execCommand('fontName', false, value);
  }

  const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
  if (editor) {
    const event = new Event('input', { bubbles: true });
    editor.dispatchEvent(event);
    return editor.innerHTML;
  }
  return '';
}

export function getWordAndCharCount(htmlContent: string) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const text = tempDiv.innerText || tempDiv.textContent || '';
  
  const cleanText = text.trim();
  const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
  const chars = cleanText.length;
  const readingTimeMinutes = Math.ceil(words.length / 200);

  return {
    words: words.length,
    chars: chars,
    readingTimeMinutes
  };
}

export function extractHeadings(htmlContent: string): { id: string; text: string; level: number }[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  const headings: { id: string; text: string; level: number }[] = [];
  const elements = tempDiv.querySelectorAll('h1, h2, h3');
  
  elements.forEach((el, index) => {
    const text = el.textContent?.trim() || '';
    if (text) {
      const level = parseInt(el.tagName.replace('H', ''), 10);
      headings.push({
        id: `heading-${index}`,
        text,
        level
      });
    }
  });

  return headings;
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAsWordDocx(title: string, htmlContent: string, dir: 'rtl' | 'ltr' = 'rtl') {
  // Rich Word HTML format that Microsoft Word and Google Docs open perfectly as a document
  const wordContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: A4 portrait;
          margin: 20mm 20mm 20mm 20mm;
        }
        body {
          font-family: 'Rubik', 'Segoe UI', Arial, sans-serif;
          direction: ${dir};
          text-align: ${dir === 'rtl' ? 'right' : 'left'};
          font-size: 11pt;
          line-height: 1.5;
          color: #1e293b;
        }
        h1 { color: #1e3a8a; font-size: 20pt; }
        h2 { color: #2563eb; font-size: 16pt; }
        h3 { color: #0f766e; font-size: 13pt; }
        table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
        th, td { border: 1px solid #cbd5e1; padding: 6pt 8pt; }
        th { background-color: #f1f5f9; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${htmlContent}
      </div>
    </body>
    </html>
  `;

  downloadFile(`${title.replace(/[^a-zA-Z0-9א-ת_]/g, '_')}.doc`, wordContent, 'application/msword');
}

export function exportAsMarkdown(title: string, htmlContent: string) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  let md = `# ${title}\n\n`;

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(walk).join('');

    switch (tag) {
      case 'h1': return `\n# ${inner}\n\n`;
      case 'h2': return `\n## ${inner}\n\n`;
      case 'h3': return `\n### ${inner}\n\n`;
      case 'p': return `${inner}\n\n`;
      case 'strong': case 'b': return `**${inner}**`;
      case 'em': case 'i': return `*${inner}*`;
      case 'u': return `<u>${inner}</u>`;
      case 'ul': return `\n${inner}\n`;
      case 'ol': return `\n${inner}\n`;
      case 'li': return `- ${inner}\n`;
      case 'br': return `\n`;
      case 'blockquote': return `\n> ${inner}\n\n`;
      default: return inner;
    }
  }

  md += Array.from(tempDiv.childNodes).map(walk).join('');
  downloadFile(`${title.replace(/[^a-zA-Z0-9א-ת_]/g, '_')}.md`, md, 'text/markdown;charset=utf-8');
}

export function exportAsTxt(title: string, htmlContent: string) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const text = tempDiv.innerText || tempDiv.textContent || '';
  downloadFile(`${title.replace(/[^a-zA-Z0-9א-ת_]/g, '_')}.txt`, text, 'text/plain;charset=utf-8');
}

export function formatPageNumberText(pageNum: number, totalPages: number, format: string = 'standard'): string {
  switch (format) {
    case 'simple':
      return `${pageNum}`;
    case 'page_x':
      return `עמוד ${pageNum}`;
    case 'hebrew': {
      const gematria = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'יג', 'יד', 'טו', 'טז', 'יז', 'יח', 'יט', 'כ'];
      const letter = gematria[Math.min(pageNum - 1, gematria.length - 1)] || `${pageNum}`;
      return `עמוד ${letter}'`;
    }
    case 'standard':
    default:
      return `עמוד ${pageNum} מתוך ${totalPages}`;
  }
}

/**
 * Creates the authentic Word / Docs A4 multi-page gap HTML with previous page footer and next page header
 */
export function createPageBreakElementHtml(
  headerText = 'DocWord | מסמך עבודה',
  footerText = 'כותרת תחתונה',
  pageNumPrev = 1,
  pageNumNext = 2,
  totalPages = 2,
  showPageNumbers = true,
  format = 'standard'
): string {
  const badgePrev = showPageNumbers
    ? `<span class="docword-page-num-badge font-mono font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border text-[10px]">${formatPageNumberText(pageNumPrev, totalPages, format)}</span>`
    : '';
  const badgeNext = showPageNumbers
    ? `<span class="docword-page-num-badge font-mono font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border text-[10px]">${formatPageNumberText(pageNumNext, totalPages, format)}</span>`
    : '';

  return `<div class="docword-page-break" data-page-break="true" contenteditable="false">
    <div class="docword-page-footer-prev">
      <span>${footerText}</span>
      ${badgePrev}
    </div>
    <div class="docword-page-gap" title="מעבר עמוד (רווח בין עמודי A4)">
      <span class="docword-page-gap-label">
        <svg class="w-3 h-3 text-primary inline-block ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        מעבר עמוד (A4)
      </span>
    </div>
    <div class="docword-page-header-next">
      <span>${headerText}</span>
      ${badgeNext}
    </div>
  </div><p><br/></p>`;
}

/**
 * Inserts a visual and printable page break at current selection cursor or appends to document
 */
export function insertPageBreak(docOptions?: {
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
  pageNumberFormat?: string;
}): string {
  const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
  const currentBreaks = editor ? editor.querySelectorAll('.docword-page-break').length : 0;
  const totalPages = currentBreaks + 2;
  const pageNumPrev = currentBreaks + 1;
  const pageNumNext = currentBreaks + 2;

  const pageBreakHtml = createPageBreakElementHtml(
    docOptions?.headerText || 'DocWord Hybrid',
    docOptions?.footerText || 'כותרת תחתונה',
    pageNumPrev,
    pageNumNext,
    totalPages,
    docOptions?.showPageNumbers !== false,
    docOptions?.pageNumberFormat || 'standard'
  );

  return insertHtmlAtCursorOrAppend(pageBreakHtml);
}

/**
 * Appends a new page break and empty paragraph directly to the end of the document
 */
export function appendNewPageToEnd(docOptions?: {
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
  pageNumberFormat?: string;
}): string {
  const editor = getActiveEditor() || (document.querySelector('[contenteditable="true"]') as HTMLElement);
  if (!editor) return '';
  
  const currentBreaks = document.querySelectorAll('.docword-page-break').length;
  const totalPages = currentBreaks + 2;
  const pageNumPrev = currentBreaks + 1;
  const pageNumNext = currentBreaks + 2;

  const pageBreakHtml = createPageBreakElementHtml(
    docOptions?.headerText || 'DocWord Hybrid',
    docOptions?.footerText || 'כותרת תחתונה',
    pageNumPrev,
    pageNumNext,
    totalPages,
    docOptions?.showPageNumbers !== false,
    docOptions?.pageNumberFormat || 'standard'
  );

  editor.innerHTML += pageBreakHtml;
  
  // Trigger input event for React state sync
  const event = new Event('input', { bubbles: true });
  editor.dispatchEvent(event);

  // Focus at the end of the editor
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }

  return editor.innerHTML;
}

/**
 * Splits document HTML into distinct page HTML sections based on page break elements
 */
export function splitHtmlIntoPages(htmlContent: string): string[] {
  if (!htmlContent) return ['<p><br/></p>'];
  
  // Split on <div class="docword-page-break"...</div> or <div data-page-break="true"...</div>
  const pageBreakRegex = /<div[^>]*class="[^"]*docword-page-break[^"]*"[^>]*>[\s\S]*?<\/div>(?:\s*<p><br\/?><\/p>)?|<div[^>]*data-page-break="true"[^>]*>[\s\S]*?<\/div>(?:\s*<p><br\/?><\/p>)?/gi;
  
  const rawParts = htmlContent.split(pageBreakRegex);
  const pages = rawParts.map(p => {
    const trimmed = p.trim();
    return trimmed.length > 0 ? trimmed : '<p><br/></p>';
  });

  return pages.length > 0 ? pages : ['<p><br/></p>'];
}

/**
 * Joins an array of page HTML strings into a unified document HTML with page breaks
 */
export function joinPagesIntoHtml(
  pages: string[],
  docOptions?: {
    headerText?: string;
    footerText?: string;
    showPageNumbers?: boolean;
    pageNumberFormat?: string;
  }
): string {
  if (pages.length <= 1) {
    return pages[0] || '<p><br/></p>';
  }

  const total = pages.length;
  let fullHtml = pages[0] || '<p><br/></p>';

  for (let i = 1; i < total; i++) {
    const pageBreak = createPageBreakElementHtml(
      docOptions?.headerText || 'DocWord Hybrid',
      docOptions?.footerText || 'כותרת תחתונה',
      i,
      i + 1,
      total,
      docOptions?.showPageNumbers !== false,
      docOptions?.pageNumberFormat || 'standard'
    );
    fullHtml += pageBreak + (pages[i] || '<p><br/></p>');
  }

  return fullHtml;
}
