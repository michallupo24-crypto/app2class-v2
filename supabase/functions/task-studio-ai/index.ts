import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const {
      action, prompt, code, subject, topic, numQuestions,
      language, libraries, htmlCode, cssCode, jsCode, pythonCode, consoleLogs,
    } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    let systemPrompt = "";
    let userMessage = "";
    let asJson = false;

    switch (action) {
      case "generate-interactive-code":
        asJson = true;
        systemPrompt = `אתה מומחה ליצירת משימות לימודיות אינטראקטיביות עבור App2Class, מותאמות לתלמידים ישראלים (עברית, RTL).
עקרונות עיצוב וקוד:
1. עטוף את התוכן ב-container נקי: <div class="max-w-2xl mx-auto space-y-6 p-4">, כותרות עם גרדיאנט, כפתורים וכרטיסים מעוגלים עם צל עדין.
2. חבר כל event handler דרך document.addEventListener('DOMContentLoaded', ...) או צירוף מפורש ל-window, לא תלוי בסדר טעינה.
3. ודא שאין שגיאות תחביר, משתנים חסרים או מחרוזות שבורות.
4. כשהתלמיד "מגיש" תשובה, קרא בהכרח ל- App2Class.submitScore(score, total).
5. אם 'confetti' ברשימת הספריות, קרא ל- confetti({ particleCount: 80, spread: 60 }) בהצלחה.
החזר אך ורק JSON תקין במבנה:
{ "title": "כותרת קצרה בעברית", "description": "תיאור קצר", "language": "web", "libraries": ["tailwindcss"], "htmlCode": "...", "cssCode": "...", "jsCode": "...", "pythonCode": "" }`;
        userMessage = `מקצוע: ${subject || "כללי"}. שפה: ${language || "web"}. ספריות זמינות: ${JSON.stringify(libraries || [])}.
דרישה: ${prompt}`;
        break;

      case "debug-interactive-code":
        asJson = true;
        systemPrompt = `אתה AI Debugger למשימות לימודיות (HTML/CSS/JS או Python). קיבלת קוד ולוגים אמיתיים מה-console.
אתר את התקלה, ציין מספר שורה, הסבר בעברית פשוטה מדוע זה קורה, והצע תיקון ממוקד (לא שכתוב גורף של כל הקוד).
החזר אך ורק JSON תקין במבנה:
{ "line": 12, "explanation": "הסבר בעברית", "suggestion": "הצעת תיקון ממוקדת", "fixedCode": { "html": "...", "css": "...", "js": "...", "python": "..." } }
אם שדה מסוים לא צריך תיקון, השאר אותו כמחרוזת ריקה ב-fixedCode.`;
        userMessage = `שפה: ${language}
HTML:
${htmlCode || ""}

CSS:
${cssCode || ""}

JavaScript:
${jsCode || ""}

Python:
${pythonCode || ""}

לוגי שגיאה מה-console:
${JSON.stringify(consoleLogs || [])}`;
        break;

      case "game-design":
        systemPrompt = `אתה מעצב משחקים חינוכיים מומחה. תמיד ענה בעברית. החזר JSON בלבד עם המבנה:
{ "name": "שם המשחק", "description": "תיאור", "stages": 5, "rules": ["כלל1","כלל2"], "scoring": "תיאור ניקוד", "questions_per_stage": 3 }`;
        userMessage = prompt;
        break;

      case "optimize-code":
        systemPrompt = `אתה מומחה אופטימיזציה לקוד HTML/JS. בצע את השינויים הבאים:
1. התאם לאייפד (responsive, touch-friendly)
2. הוסף RTL support
3. הוסף מנגנון postMessage לשליחת ציונים: window.parent.postMessage({ type: 'GRADE', score: X }, '*')
4. שפר UX עם אנימציות ועיצוב נקי
החזר רק את הקוד HTML המעודכן המלא, ללא הסברים.`;
        userMessage = code;
        break;

      case "scan-file":
        systemPrompt = `אתה מומחה בחילוץ שאלות מחומרי לימוד. נתח את התוכן וחלץ שאלות ותשובות מגוונות.
החזר JSON array בלבד עם אובייקטים במבנה:
[{ "question_text": "...", "question_type": "multiple_choice", "options": ["א","ב","ג","ד"], "correct_answer": "א", "explanation": "..." }]
צור מגוון סוגי שאלות: multiple_choice, true_false, fill_blank.`;
        userMessage = `חלץ ${numQuestions || 10} שאלות מהתוכן הבא:\n${prompt}`;
        break;

      case "generate-questions":
        systemPrompt = `אתה מומחה ביצירת שאלות בגרות ישראליות. החזר JSON array בלבד.
כל שאלה במבנה: { "question_text": "...", "question_type": "multiple_choice", "options": ["א","ב","ג","ד"], "correct_answer": "א", "explanation": "..." }`;
        userMessage = `צור ${numQuestions || 5} שאלות במקצוע ${subject}${topic ? ` בנושא ${topic}` : ""}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          ...(asJson ? { generationConfig: { responseMimeType: "application/json" } } : {}),
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "שגיאה בשירות ה-AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Try to parse JSON from the response
    let parsed = content;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      // Return as plain text if not JSON
      parsed = content;
    }

    return new Response(
      JSON.stringify({ result: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("task-studio-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
