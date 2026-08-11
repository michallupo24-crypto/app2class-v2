import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      message,        // primary field sent by task-studio callers & StudentPracticePage
      messages,        // legacy array shape, kept for backward compat
      grade,
      subject,
      action,          // "chat" | "exam_prep" | "generate_questions" | "open_answer_check"
      studentId,
      assignmentTitle,
      numQuestions,
      prompt,
      context,         // some callers pass the action name here instead of `action`
      topic,
    } = await req.json();

    // Real callers send different field combinations (`message` + `context`,
    // or `messages` + `action`) - normalize both onto one shape.
    const resolvedAction = action || context;
    const userInput: string = message || prompt || messages?.[messages.length - 1]?.content || "";

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is missing! Please configure it in Supabase secrets.");
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    async function callGemini(systemPrompt: string, userText: string, asJson = false) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userText }] }],
            ...(asJson ? { generationConfig: { responseMimeType: "application/json" } } : {}),
          }),
        },
      );
      if (!res.ok) {
        const t = await res.text();
        console.error("Gemini error:", res.status, t);
        throw Object.assign(new Error("AI gateway error"), { status: res.status });
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // ── Build student context from DB ──────────────────────────────────────
    let studentContext = "";
    if (studentId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseKey);

        const { data: profile } = await sb
          .from('profiles')
          .select('full_name, date_of_birth')
          .eq('id', studentId)
          .single();
          
        const { data: tracks } = await sb
          .from('student_tracks')
          .select('track_name, track_type, level')
          .eq('user_id', studentId);

        let ageStr = "";
        if (profile?.date_of_birth) {
           const birthYear = new Date(profile.date_of_birth).getFullYear();
           const currYear = new Date().getFullYear();
           ageStr = `בגיל ${currYear - birthYear}. `;
        }
        
        const trackNames = tracks?.map((t: any) => t.track_name).join(", ");
        const trackStr = trackNames ? `נמצא במגמות/הקבצות: ${trackNames}.` : "";

        // Get student's recent grades (last 20 graded submissions)
        const { data: subs } = await sb
          .from("submissions")
          .select("grade, assignments(title, subject, max_grade, weight_percent)")
          .eq("student_id", studentId)
          .eq("status", "graded")
          .not("grade", "is", null)
          .order("graded_at", { ascending: false })
          .limit(20);

        if (subs && subs.length > 0) {
          // Build subject averages
          const bySubject = new Map<string, number[]>();
          subs.forEach((s: any) => {
            const subj = s.assignments?.subject;
            const maxG = s.assignments?.max_grade || 100;
            if (!subj) return;
            const norm = Math.round((s.grade / maxG) * 100);
            const list = bySubject.get(subj) || [];
            list.push(norm);
            bySubject.set(subj, list);
          });

          const subjAvgs: string[] = [];
          bySubject.forEach((grades, subj) => {
            const avg = Math.round(grades.reduce((a, b) => a + b, 0) / grades.length);
            subjAvgs.push(`${subj}: ממוצע ${avg}`);
          });

          const sorted = [...bySubject.entries()]
            .map(([s, gs]) => ({ s, avg: gs.reduce((a, b) => a + b, 0) / gs.length }))
            .sort((a, b) => b.avg - a.avg);

          const strong = sorted[0]?.s;
          const weak = sorted[sorted.length - 1]?.s;

          studentContext = `
[פרופיל אישי וחינוכי]
שם התלמיד: ${profile?.full_name || 'תלמיד'} ${ageStr}
${trackStr}
ציונים לפי מקצוע: ${subjAvgs.join(", ")}
מקצוע חזק: ${strong || "לא ידוע"}
מקצוע לשיפור (דורש מיקוד וסבלנות): ${weak || "לא ידוע"}
מספר ציונים עדכניים: ${subs.length}
`;
        } else if (profile) {
           studentContext = `
[פרופיל אישי וחינוכי]
שם התלמיד: ${profile.full_name} ${ageStr}
${trackStr}
(עדיין אין ציונים כדי לחשב ממוצע)
`;
        }
      } catch (e) {
        console.error("Failed to load student context:", e);
        // Continue without context
      }
    }

    // ── ACTION: open_answer_check ─────────────────────────────────────────
    if (resolvedAction === "open_answer_check") {
      const systemPrompt = `אתה בודק תשובות של תלמידים. ענה בעברית בלבד.
תן פידבק קצר ועניני (2-3 משפטים):
1. האם התשובה נכונה / חלקית נכונה / שגויה?
2. מה חסר או מה טוב?
3. הצעה קצרה לשיפור.
אל תכתוב יותר מ-4 משפטים.`;

      let msg = "לא ניתן לבדוק כרגע";
      try {
        msg = (await callGemini(systemPrompt, userInput)) || msg;
      } catch (e) {
        console.error("open_answer_check error:", e);
      }
      return new Response(JSON.stringify({ message: msg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: generate_questions ────────────────────────────────────────
    if (resolvedAction === "generate_questions" || resolvedAction === "scan-file") {
      const effectiveInput = userInput || `צור ${numQuestions || 5} שאלות תרגול בעברית על הנושא: ${subject || topic || assignmentTitle || "כללי"}`;
      const systemPrompt = `אתה יוצר שאלות תרגול לתלמידים בישראל.
${studentContext ? 'הכר את התלמיד עבורו אתה יוצר שאלות:\n' + studentContext + '\nהתאם את השאלות (במיוחד במקצוע החלש) שיהיו מובנות ויכללו חשיבה מודרכת.' : ''}
החזר JSON בלבד (ללא markdown, ללא הסברים) בפורמט הבא:
[
  {
    "question_type": "multiple_choice",
    "question_text": "...",
    "options": ["א. ...", "ב. ...", "ג. ...", "ד. ..."],
    "correct_answer": "א. ...",
    "explanation": "..."
  }
]
צור ${numQuestions || 5} שאלות ברמת קושי עולה. שאלות מגוונות: אמריקאי, נכון/לא-נכון, פתוח.`;

      try {
        const raw = await callGemini(systemPrompt, effectiveInput, true);
        const result = JSON.parse(raw);
        return new Response(JSON.stringify({ result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("generate_questions error:", e);
        return new Response(JSON.stringify({ result: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── ACTION: exam_prep ─────────────────────────────────────────────────
    if (resolvedAction === "exam_prep") {
      const examSubject = subject || "כללי";
      const daysLeft = userInput || "7";
      const systemPrompt = `אתה יועץ לימודי. צור תוכנית לימודים למבחן ב-${examSubject} שמתקיים בעוד ${daysLeft} ימים.
${studentContext}
הנחיות:
- חלק את החומר לימים (יום 1, יום 2 וכו')
- כל יום: 30-45 דקות לימוד, משימה ספציפית קצרה
- יום אחרון: חזרה ומנוחה
- כלול הצעות לתרגול (פלאשקארדס, בוחן קצר)
- ענה בעברית, עם כותרות ברורות`;

      let msg = "לא ניתן ליצור תוכנית כרגע";
      try {
        msg = (await callGemini(systemPrompt, `צור תוכנית לימודים למבחן ב-${examSubject} בעוד ${daysLeft} ימים`)) || msg;
      } catch (e) {
        console.error("exam_prep error:", e);
      }
      return new Response(JSON.stringify({ message: msg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: parent_insight ────────────────────────────────────────────
    if (resolvedAction === "parent_insight") {
      const systemPrompt = `אתה עוזר AI שמספק להורה תובנה קצרה וממוקדת (3-4 משפטים) על מצב הילד/ה שלו/ה בבית הספר.
${studentContext}
בהתבסס על הנתונים שסופקו בלבד: ציין מגמה בציונים לעומת ממוצע הכיתה אם יש, מצב הנוכחות, ואירוע קרוב חשוב אם צוין.
תן המלצה מעשית אחת אם רלוונטית. כתוב בעברית, בטון חם, תומך ולא שיפוטי. אל תמציא נתונים שלא סופקו.`;

      let msg = "לא ניתן לטעון תובנה כרגע";
      try {
        msg = (await callGemini(systemPrompt, userInput)) || msg;
      } catch (e) {
        console.error("parent_insight error:", e);
      }
      return new Response(JSON.stringify({ message: msg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEFAULT: single-shot request (task-studio code optimization,
    // bagrut question generation, or a plain chat turn - none of the real
    // callers of this branch read a stream, so this stays non-streaming) ──
    const gradeLabel = grade || "תיכון";
    const subjectContext = subject
      ? `המקצוע הנוכחי: ${subject}.`
      : "";

    const systemPrompt = `אתה עוזר לימודי AI בשם "מנטור" במערכת App2Class.
אתה מלמד תלמידים בשכבת ${gradeLabel} בבית ספר בישראל.
${subjectContext}
${studentContext}

הנחיות:
- ענה תמיד בעברית, בשפה ברורה ומותאמת לגיל התלמיד.
- אם אתה יודע על ציוני התלמיד, התייחס לחוזקות וחולשות שלו באופן אישי.
- אם מתבקש קוד או תוכן טכני, החזר בדיוק את מה שהתבקש ללא הסברים מיותרים.
- אל תיתן תשובות מלאות למטלות לימודיות — הנח עם שאלות מנחות ורמזים.
- השתמש באימוג'ים במידה (🎯📚✨💡) בשיחה רגילה בלבד.
אתה ידידותי, סבלני ומעודד.`;

    try {
      const text = await callGemini(systemPrompt, userInput || messages?.map((m: any) => m.content).join("\n") || "");

      // Some callers (BagrutHunterMode) expect a `questions` array when the
      // reply is JSON; others (AiOptimizationMode/BlankHtmlMode) just want
      // the raw `response` text (e.g. optimized HTML). Satisfy both.
      let questions: unknown = undefined;
      const clean = text.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) questions = parsed;
      } catch { /* not JSON, that's fine */ }

      return new Response(JSON.stringify({ response: text, questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      if (e?.status === 429)
        return new Response(JSON.stringify({ error: "יותר מדי בקשות, נסה שוב בעוד רגע 🕐" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      console.error("AI gateway error:", e);
      return new Response(JSON.stringify({ error: "שגיאה בשירות ה-AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("ai-tutor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
