import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Gemini Vision OCR — real handwriting/photo -> text, for two real gaps:
// student "photograph my notebook" submission, and teacher OCR-assisted grading
// of scanned handwritten exams (spec: "בדיקת מבחנים - העלאת מבחן... ונתינה לבינה
// המלאכותית לנסות להחליט לפי הכתב"). Mirrors task-studio-ai's structure/model
// convention (gemini-1.5-flash — not a guessed model name).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { base64Data, mimeType, ocrMode, languageHint } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    if (!base64Data) {
      return new Response(JSON.stringify({ error: "Missing image data" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langContext = languageHint && languageHint !== "auto"
      ? ` השפה העיקרית הצפויה במסמך היא ${languageHint}.`
      : " שים לב לטקסט רב-לשוני, כולל עברית, אנגלית, מספרים וסימנים.";

    let prompt: string;
    if (ocrMode === "handwriting") {
      prompt = `בצע זיהוי כתב יד מתקדם על התמונה הזו.${langContext} התמונה מכילה טקסט כתוב ביד — פענח בזהירות צורות אותיות, חיבורים בין אותיות, וכתב יד עברי. החזר את הטקסט המתומלל בצורה נקייה, שמור על מבנה הפסקאות. אל תוסיף הסברים או הערות — רק את הטקסט המתומלל.`;
    } else if (ocrMode === "markdown") {
      prompt = `בצע OCR מקיף על התמונה והחזר את התוכן כ-Markdown נקי ומובנה.${langContext} כלול כותרות, טקסט מודגש, רשימות ומבנה היררכי כפי שמופיע במקור. אל תשמיט טקסט.`;
    } else {
      prompt = `חלץ את כל הטקסט מהתמונה הזו במדויק כפי שכתוב.${langContext} שמור על ירידות שורה ורווחי פסקאות. אל תוסיף הסברים — רק את הטקסט המחולץ, מילה במילה.`;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "אתה מנוע OCR מדויק במיוחד, מומחה בזיהוי טקסט רב-לשוני כולל עברית (RTL), אנגלית, מספרים וכתב יד." }],
          },
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } },
              { text: prompt },
            ],
          }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OCR gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "שגיאה בשירות ה-OCR" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-extract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
