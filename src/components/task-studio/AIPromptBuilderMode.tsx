import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wand2, Copy, Check, ClipboardPaste, Eye, ArrowLeftRight } from "lucide-react";
import StudioModeWrapper from "./StudioModeWrapper";
import { LivePreviewPanel } from "./ide/LivePreviewPanel";
import { buildSandboxHtml } from "./ide/sandboxBuilder";
import type { UserProfile } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  profile: UserProfile;
  assignmentId: string | null;
  onBack: () => void;
  onSendToEditor: (code: { title?: string; description?: string; htmlCode?: string; cssCode?: string; jsCode?: string }) => void;
}

const SUBJECTS = ["מתמטיקה", "מדעי המחשב", "פיזיקה", "ביולוגיה", "היסטוריה/אזרחות", "אנגלית", "לשון", "כללי"];

const DESIGN_STYLES: Record<string, { label: string; prompt: string }> = {
  playful: {
    label: "משחקי וצבעוני",
    prompt: "עיצוב משחקי וצבעוני: פונטים גדולים ועגולים, אנימציות קפיציות ורכות, פלטת צבעים חיה ושמחה, ואפקט חגיגה (למשל קונפטי) בסיום מוצלח.",
  },
  minimal: {
    label: "מינימליסטי ונקי",
    prompt: "עיצוב מינימליסטי ונקי: הרבה רווח לבן, פלטת צבעים מאופקת (2-3 צבעים בלבד), טיפוגרפיה פשוטה וברורה, ללא עומס ויזואלי או אפקטים מיותרים.",
  },
  dark: {
    label: "כהה (Dark mode)",
    prompt: "מצב כהה (dark mode): רקע כהה (למשל #0f172a), טקסט בהיר, מבטאים בצבע ניגודי בולט (טורקיז/סגול/ירוק ניאון), מתאים לנושא טכנולוגי.",
  },
  academic: {
    label: "רציני ואקדמי",
    prompt: "עיצוב רציני ואקדמי, דומה לדף מבחן דיגיטלי מסודר: גופן ברור וקריא, שאלות ממוספרות ומסודרות, מינימום אפקטים ויזואליים, דגש על קריאות.",
  },
};

// Some external AIs ignore the fenced-block instruction and just dump three
// unlabeled blocks back to back (HTML, then raw CSS, then raw JS). The two
// helpers below find the CSS-start and CSS-end boundaries so that content can
// still be split correctly even without markdown fences.
//
// Does the text starting here look like the start of a CSS rule (selector...{
// or an @-rule)? Real JS has far too many possible opening shapes (IIFE,
// arrow fn, class, bare statement...) to whitelist reliably, so this instead
// narrowly recognizes CSS's shape and explicitly excludes the handful of
// tokens that are syntactically identical to a CSS descendant selector but
// are actually JS (e.g. "class Foo {", "(function () {").
function looksLikeCssRuleStart(text: string): boolean {
  const trimmed = text.replace(/^\s+/, "");
  if (!trimmed) return false;
  if (/^@/.test(trimmed)) return true; // @media, @keyframes, @font-face...
  const braceIdx = trimmed.indexOf("{");
  if (braceIdx === -1) return false;
  const beforeBrace = trimmed.slice(0, braceIdx);
  if (/^\(|=>|\bfunction\b|\bclass\b|\bconst\b|\blet\b|\bvar\b|\breturn\b|\bif\b|\bfor\b|\bwhile\b|\btry\b|window\.|document\.|['"]use strict['"]/.test(beforeBrace)) {
    return false;
  }
  return /^[.#*[\]a-zA-Z0-9_\-:,()"'=+~%\s]*$/.test(beforeBrace);
}

function findCssStart(text: string): number {
  // Scan for the first '{' whose preceding "selector" (back to the nearest
  // newline OR '>' - handles the common case where the AI joins the HTML and
  // CSS blocks on the same line, e.g. "</div> * {") looks like a real CSS
  // rule start and not, say, the start of a JS function.
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let start = i;
    while (start > 0 && text[start - 1] !== "\n" && text[start - 1] !== ">") start--;
    if (text.slice(start, i).trim().length > 0 && looksLikeCssRuleStart(text.slice(start))) return start;
  }
  return -1;
}

function splitUnfencedCode(text: string): { html: string; css: string; js: string } {
  const cssStart = findCssStart(text);
  if (cssStart === -1) {
    return { html: text.trim(), css: "", js: "" };
  }
  const html = text.slice(0, cssStart).trim();
  const rest = text.slice(cssStart);

  let depth = 0;
  let cssEnd = -1;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth <= 0) {
        depth = 0;
        const remainder = rest.slice(i + 1);
        if (!remainder.trim() || !looksLikeCssRuleStart(remainder)) { cssEnd = i + 1; break; }
        // otherwise this is another top-level CSS rule - keep scanning
      }
    }
  }
  if (cssEnd === -1) cssEnd = rest.length;

  return { html, css: rest.slice(0, cssEnd).trim(), js: rest.slice(cssEnd).trim() };
}

function parseAIResponse(text: string): { html: string; css: string; js: string } {
  const extract = (pattern: RegExp) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : "";
  };
  const html = extract(/```html\s*\n([\s\S]*?)```/i);
  const css = extract(/```css\s*\n([\s\S]*?)```/i);
  const js = extract(/```(?:javascript|js)\s*\n([\s\S]*?)```/i);
  if (html || css || js) {
    // At least one proper fenced block was found - trust it, filling any
    // missing piece from the unfenced heuristic as a best-effort backstop.
    if (html && css && js) return { html, css, js };
  }
  // No (or incomplete) fenced blocks - the AI likely ignored the fencing
  // instruction and dumped three unlabeled blocks in order instead.
  const heuristic = splitUnfencedCode(text);
  return {
    html: html || heuristic.html,
    css: css || heuristic.css,
    js: js || heuristic.js,
  };
}

const AIPromptBuilderMode = ({ profile, assignmentId, onBack, onSendToEditor }: Props) => {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("מתמטיקה");
  const [designStyle, setDesignStyle] = useState<keyof typeof DESIGN_STYLES>("playful");
  const [scoringNotes, setScoringNotes] = useState("");
  const [copied, setCopied] = useState(false);

  // Most AI chat UIs (ChatGPT, Claude.ai) render each ``` fenced block as its
  // own visual "box" with its own copy button - so in practice teachers copy
  // each block separately, not the whole message as one blob. Three separate
  // paste fields is the reliable default; the single combined textarea (with
  // the fence/heuristic parser) is a fallback for teachers who do copy the
  // whole message at once.
  const [pasteMode, setPasteMode] = useState<"separate" | "combined">("separate");
  const [pastedHtml, setPastedHtml] = useState("");
  const [pastedCss, setPastedCss] = useState("");
  const [pastedJs, setPastedJs] = useState("");
  const [pastedResponse, setPastedResponse] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const generatedPrompt = useMemo(() => {
    const styleText = DESIGN_STYLES[designStyle].prompt;
    return `אתה מפתח משימות לימודיות אינטראקטיביות עבור פלטפורמת בית ספר. המטרה: לבנות דף אינטראקטיבי ${"(HTML+CSS+JavaScript בלבד, ללא React/Vue/npm, ללא frameworks חיצוניים)"} שתלמידים ישחקו או יפתרו בתוך iframe מבודד בתוך המערכת.

## המשימה שיש לבנות
נושא/תוכן: ${topic.trim() || "(השלם/י כאן מה בדיוק המשימה)"}
מקצוע: ${subject}
${scoringNotes.trim() ? `אופן ניקוד: ${scoringNotes.trim()}` : "אופן ניקוד: לפי שיקול דעתך, ציון מ-0 עד 100"}

## סגנון עיצוב נדרש
${styleText}

## מבנה/היררכיה נדרשים (חובה, לא אופציונלי)
1. אזור כותרת עליון וברור עם שם המשימה והוראות קצרות לתלמיד.
2. אזור תוכן מרכזי אחד — האינטראקציה/המשחק/השאלות עצמן.
3. אזור משוב מיידי (נכון/לא נכון, ניקוד חלקי וכו') שמופיע ליד או מתחת לפעולת התלמיד, לא רק בסוף.
4. פעולת סיום ברורה (כפתור "סיימתי" / "שלח") שמפעילה שליחת ציון (ראה SDK למטה).
בנה DOM נקי בהיררכיה סמנטית (header/main/footer או section מסודרות) — לא ערימת divים שטוחה.

## חובה טכנית — אינטגרציה עם המערכת (App2Class SDK)
הדף שלך ירוץ בתוך iframe שכבר מזריק אובייקט גלובלי בשם window.App2Class. אתה חייב לקרוא לפונקציות האלה כדי שהמערכת תוכל לייצא ציון ולשמור את תשובות התלמיד:

\`\`\`javascript
// כשהתלמיד מסיים את המשימה (בלחיצה על כפתור סיום, או אוטומטית בסוף):
window.App2Class.submitScore(score, total);
// score = מספר הנקודות שהתלמיד קיבל, total = הניקוד המקסימלי (למשל 100)
// דוגמה: window.App2Class.submitScore(7, 10);

// (מומלץ מאוד) שמירת מצב/תשובות התלמיד כדי שהמורה יוכל לבדוק כל תשובה בנפרד:
window.App2Class.saveState({ answers: [/* ... */], currentStage: 3 });
// אפשר לקרוא לזה בכל שינוי משמעותי, לא רק בסוף

// (אופציונלי) טעינת מצב שמור אם התלמיד חוזר לאמצע משימה:
window.App2Class.onLoadState(function (savedState) {
  if (savedState) { /* שחזר את המצב */ }
});
\`\`\`

חשוב: אל תשתמש ב-localStorage / fetch / XMLHttpRequest לשמירת נתונים — ה-sandbox חוסם רשת חיצונית, וה-SDK למעלה הוא הערוץ היחיד שהמערכת קולטת.

## ספריות זמינות (רק אם רלוונטי לנושא, ציין בתשובה אם השתמשת כדי שאדע לסמן אותן בעורך — אין צורך ב-<script> משלך)
p5.js (גרפיקה/אנימציה), Chart.js (גרפים), Three.js (תלת-ממד), Tailwind CSS (עיצוב, כבר טעון כברירת מחדל), KaTeX (נוסחאות מתמטיות), Tone.js (סאונד), Phaser 3 (מנוע משחקים 2D), Canvas Confetti (אפקט חגיגה).

## פורמט הפלט הנדרש — קריטי, לא אופציונלי
זה מועתק אוטומטית למערכת שמפרקת את התשובה שלך לפי גדרות Markdown (three backticks). אם לא תשתמש בגדרות בדיוק כמו למטה — הפירוק ייכשל והמשימה לא תעבוד. אל תחזיר שום דבר אחר חוץ משלושת הבלוקים האלה (בלי הסברים לפני/אחרי/בין):

\`\`\`html
<!-- רק תוכן ה-body. בלי <html>, <head>, <script>, בלי ‎<!DOCTYPE>‎ -->
\`\`\`

\`\`\`css
/* כל ה-CSS כאן, ורק כאן — לא בתוך בלוק ה-html */
\`\`\`

\`\`\`javascript
// כל ה-JS כאן, ורק כאן — כולל הקריאות ל-window.App2Class
\`\`\`

חובה: כל אחד משלושת הבלוקים חייב להיפתח בשורה נפרדת עם שלוש גרשיים הפוכות ושם השפה (\`\`\`html / \`\`\`css / \`\`\`javascript) ולהיסגר בשלוש גרשיים הפוכות בשורה נפרדת. אל תדלג על הגדרות גם אם זה נראה מיותר.

עיצוב חייב להיות RTL (עברית), רספונסיבי (נייד ומחשב), ונגיש (ניגודיות טובה, כפתורים גדולים מספיק ללחיצה).`;
  }, [topic, subject, designStyle, scoringNotes]);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    toast({ title: "הפרומפט הועתק! הדביקו אותו בכלי AI חיצוני (למשל Claude או ChatGPT)" });
    setTimeout(() => setCopied(false), 2000);
  };

  // Even in "separate boxes" mode, don't blindly trust which box the teacher
  // put things in - some AI chat UIs only render ONE copyable box (not three)
  // despite the prompt asking for three fenced blocks, so a teacher following
  // "copy each box" ends up pasting everything into just the html field. So:
  // run the full extractor on the html field (it self-heals if that field
  // actually contains everything glued together), but trust the css/js
  // fields directly as their own language - don't reinterpret a clean,
  // single-language field through the "assume it's all mixed" fallback,
  // which would otherwise misfire on e.g. a pure JS snippet with no CSS in it.
  const extractFenced = (text: string, pattern: RegExp) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : "";
  };
  const parsed = useMemo(() => {
    if (pasteMode === "combined") return parseAIResponse(pastedResponse);
    const fromHtml = pastedHtml.trim() ? parseAIResponse(pastedHtml) : { html: "", css: "", js: "" };
    const cssFromField = pastedCss.trim() ? (extractFenced(pastedCss, /```css\s*\n([\s\S]*?)```/i) || pastedCss.trim()) : "";
    const jsFromField = pastedJs.trim() ? (extractFenced(pastedJs, /```(?:javascript|js)\s*\n([\s\S]*?)```/i) || pastedJs.trim()) : "";
    return {
      html: fromHtml.html || pastedHtml.trim(),
      css: cssFromField || fromHtml.css,
      js: jsFromField || fromHtml.js,
    };
  }, [pasteMode, pastedHtml, pastedCss, pastedJs, pastedResponse]);
  const hasAnyPaste = pasteMode === "separate" ? !!(pastedHtml.trim() || pastedCss.trim() || pastedJs.trim()) : !!pastedResponse.trim();
  const srcDoc = useMemo(
    () => (showPreview ? buildSandboxHtml({ language: "web", htmlCode: parsed.html, cssCode: parsed.css, jsCode: parsed.js, pythonCode: "", libraries: ["tailwindcss"] }) : ""),
    [showPreview, parsed]
  );

  const handleSendToEditor = () => {
    if (!assignmentId) {
      toast({ title: "בחר משימה פעילה מהתפריט העליון קודם", variant: "destructive" });
      return;
    }
    onSendToEditor({
      title: topic.trim() ? topic.trim().slice(0, 60) : undefined,
      description: topic.trim() || undefined,
      htmlCode: parsed.html,
      cssCode: parsed.css,
      jsCode: parsed.js,
    });
    toast({ title: "הקוד הועבר לעורך — אפשר לבדוק, לערוך ולשגר לכיתה" });
  };

  return (
    <StudioModeWrapper
      title="בונה פרומפט ל-AI חיצוני"
      description="תארו את המשימה, קבלו פרומפט מדויק להעתקה ל-ChatGPT/Claude, והדביקו בחזרה את הקוד שהתקבל"
      icon={<Wand2 className="h-6 w-6 text-accent" />}
      badge="AI"
      onBack={onBack}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: the form + generated prompt */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-heading">מה המשימה? (נושא/תוכן)</Label>
                <Textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder='למשל: "תרגול חיבור וחיסור שברים, 8 שאלות עולות בקושי, עם דמות שמטפסת הר בכל תשובה נכונה"'
                  rows={4}
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-heading">מקצוע</Label>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-muted rounded-lg px-2 py-2 text-xs outline-none">
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-heading">סגנון עיצוב</Label>
                  <select value={designStyle} onChange={(e) => setDesignStyle(e.target.value as keyof typeof DESIGN_STYLES)} className="w-full bg-muted rounded-lg px-2 py-2 text-xs outline-none">
                    {Object.entries(DESIGN_STYLES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-heading">אופן ניקוד (אופציונלי)</Label>
                <Textarea
                  value={scoringNotes}
                  onChange={(e) => setScoringNotes(e.target.value)}
                  placeholder='למשל: "כל שאלה שווה 12.5 נקודות, ניקוד חלקי על ניסיון שני"'
                  rows={2}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/30">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-heading font-bold flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5 text-accent" /> הפרומפט המוכן</p>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={copyPrompt}>
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "הועתק!" : "העתק"}
                </Button>
              </div>
              <pre className="bg-muted/40 rounded-lg p-3 text-[11px] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono" dir="rtl">
                {generatedPrompt}
              </pre>
              <p className="text-[11px] text-muted-foreground font-body">
                העתיקו את הפרומפט והדביקו אותו בשיחה חדשה בכלי AI (Claude, ChatGPT וכו'). ברוב הכלים כל בלוק קוד בתשובה יופיע בתיבה נפרדת עם כפתור העתקה משלה — העתיקו כל תיבה בנפרד לשדה המתאים מימין.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: paste AI output + preview + send to editor */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-heading flex items-center gap-1.5"><ClipboardPaste className="h-3.5 w-3.5" /> הדביקו את הקוד שקיבלתם</Label>
                <div className="flex rounded-lg border overflow-hidden text-[11px]">
                  <button
                    type="button"
                    className={`px-2.5 py-1 font-heading ${pasteMode === "separate" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => setPasteMode("separate")}
                  >
                    תיבה לכל שפה
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 font-heading ${pasteMode === "combined" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => setPasteMode("combined")}
                  >
                    הדבקה משולבת אחת
                  </button>
                </div>
              </div>

              {pasteMode === "separate" ? (
                <>
                  <p className="text-[11px] text-muted-foreground font-body">
                    ברוב כלי ה-AI כל בלוק קוד מוצג בתיבה נפרדת עם כפתור העתקה — לחצו על כפתור ההעתקה של כל תיבה בתשובת ה-AI, והדביקו אותה כאן:
                  </p>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono text-muted-foreground">html</Label>
                    <Textarea value={pastedHtml} onChange={(e) => setPastedHtml(e.target.value)} placeholder="הדביקו כאן את בלוק ה-html שהתקבל" rows={4} className="text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono text-muted-foreground">css</Label>
                    <Textarea value={pastedCss} onChange={(e) => setPastedCss(e.target.value)} placeholder="הדביקו כאן את בלוק ה-css שהתקבל" rows={4} className="text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-mono text-muted-foreground">javascript</Label>
                    <Textarea value={pastedJs} onChange={(e) => setPastedJs(e.target.value)} placeholder="הדביקו כאן את בלוק ה-javascript שהתקבל" rows={4} className="text-xs font-mono" />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground font-body">
                    לשימוש אם העתקתם את כל ההודעה כטקסט אחד (למשל בעזרת "העתק תשובה"). המערכת תנסה לזהות את שלושת הבלוקים אוטומטית, כולל כשה-AI לא שמר על גדרות ```.
                  </p>
                  <Textarea
                    value={pastedResponse}
                    onChange={(e) => setPastedResponse(e.target.value)}
                    placeholder="הדביקו כאן את כל התשובה שקיבלתם"
                    rows={10}
                    className="text-xs font-mono"
                  />
                </>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={!hasAnyPaste} onClick={() => setShowPreview(true)}>
                  <Eye className="h-3.5 w-3.5" /> תצוגה מקדימה
                </Button>
                <Button size="sm" className="gap-1.5 text-xs" disabled={!hasAnyPaste} onClick={handleSendToEditor}>
                  <ArrowLeftRight className="h-3.5 w-3.5" /> העבר לעורך הקוד
                </Button>
                {hasAnyPaste && (
                  <>
                    <Badge variant={parsed.html.length > 0 ? "secondary" : "destructive"} className="text-[10px]">HTML: {parsed.html.length} תווים</Badge>
                    <Badge variant={parsed.css.length > 0 ? "secondary" : "destructive"} className="text-[10px]">CSS: {parsed.css.length} תווים</Badge>
                    <Badge variant={parsed.js.length > 0 ? "secondary" : "destructive"} className="text-[10px]">JS: {parsed.js.length} תווים</Badge>
                  </>
                )}
              </div>
              {pasteMode === "combined" && hasAnyPaste && (!parsed.css || !parsed.js) && (
                <p className="text-[11px] text-destructive font-heading">
                  ⚠️ אחד הבלוקים ריק — נסו את מצב "תיבה לכל שפה" במקום זה, זה אמין יותר.
                </p>
              )}
              {!assignmentId && (
                <p className="text-[11px] text-warning font-heading">⚠️ בחר/י משימה פעילה מהתפריט העליון לפני שליחה לעורך</p>
              )}
            </CardContent>
          </Card>

          {showPreview && (
            <div className="h-[420px]">
              <LivePreviewPanel srcDoc={srcDoc} consoleLogs={[]} onClearLogs={() => {}} />
            </div>
          )}
        </div>
      </div>
    </StudioModeWrapper>
  );
};

export default AIPromptBuilderMode;
