import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { geminiUrl } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ModResult = {
  blocked: boolean;
  block_reason: string | null;
  flag: boolean;
  flag_reason: string | null;
  distress: boolean;
  distress_category: string | null;
};

function safeParseMod(text: string): Partial<ModResult> | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Partial<ModResult>;
  } catch {
    return null;
  }
}

// Used whenever the AI can't answer (no key, provider error, bad response).
// Returning "allow" there meant a provider outage silently turned moderation
// off for every student chat, so this keyword pass is the floor, not the AI.
const THREAT = /(ארביץ|מרביץ|ארצח|אהרוג|הורג אותך|אשבור לך|אדקור|אפוצץ|יש לי סכין|אחכה לך אחרי)/;
const INSULT = /(מטומטמ|אידיוט|דביל|מפגר|זונה|שרמוטה|בן זונה|כוסאמ|כוס אמ|יא חרא|מזדיי|לך תזדיין|הומו מסריח|קוקסינל|ערבי מסריח|כושי)/;
const DISTRESS = /(להתאבד|לא רוצה לחיות|רוצה למות|לפגוע בעצמי|חותכ.? את עצמי|אין לי בשביל מה לחיות|כולם יהיו יותר טוב בלעדיי)/;

function localModerate(message: string): ModResult {
  const text = message.toLowerCase();
  const distress = DISTRESS.test(text);
  if (THREAT.test(text)) {
    return { blocked: true, block_reason: "ההודעה נחסמה כי היא כוללת איום. אם משהו מטריד אותך, אפשר לפנות ליועצת.", flag: false, flag_reason: null, distress, distress_category: distress ? "self_harm" : null };
  }
  if (INSULT.test(text)) {
    return { blocked: true, block_reason: "ההודעה נחסמה כי היא כוללת ביטוי פוגעני.", flag: false, flag_reason: null, distress, distress_category: distress ? "self_harm" : null };
  }
  return { blocked: false, block_reason: null, flag: false, flag_reason: null, distress, distress_category: distress ? "self_harm" : null };
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // The sender is whoever is signed in - never an id from the request body,
  // which let anyone file distress alerts in another student's name.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: authData } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const sender_id = authData?.user?.id;
  if (!sender_id) return json({ error: "Unauthorized" }, 401);

  let message = "";
  let conversation_id: string | undefined;

  // The database only accepts a message whose verdict carries this
  // signature (enforce_chat_moderation), so skipping this function, or
  // dropping a flag, makes the insert fail.
  const signed = async (result: ModResult) => {
    const flag = !result.blocked && result.flag;
    let token: string | null = null;
    if (!result.blocked && conversation_id) {
      const { data, error } = await admin.rpc("chat_moderation_token", {
        p_sender: sender_id, p_conversation: conversation_id, p_content: message, p_flagged: flag,
      });
      if (error) console.error("sign error:", error.message);
      token = (data as string) ?? null;
    }
    return { ...result, flag, token };
  };

  try {
    const body = await req.json();
    message = String(body.message ?? "");
    const sender_name = String(body.sender_name ?? "");
    conversation_id = body.conversation_id as string | undefined;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    let result: ModResult | null = null;

    if (GEMINI_API_KEY) {
      const response = await fetch(
        geminiUrl(GEMINI_API_KEY),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: `You moderate a Hebrew school chat (ages 12–18). Reply with ONE JSON object only, no markdown.

Fields:
- "blocked" (boolean): true if the message is bullying, harassment, hate, sexual content, threats, severe insults, or clear netiquette violations that must NOT be posted.
- "block_reason" (string|null): short explanation in Hebrew for the student if blocked; null if not blocked.
- "flag" (boolean): true if the message is borderline or needs staff review but can still be posted (e.g. mild conflict).
- "flag_reason" (string|null): brief Hebrew reason if flag is true.
- "distress" (boolean): true if the writer may be in crisis (self-harm, suicide ideation, severe bullying victim, eating disorder crisis, explicit plea for help in distress). Do NOT set distress for normal sadness or homework stress.
- "distress_category" (string|null): short internal label in English if distress is true, e.g. "self_harm", "suicide_ideation", "severe_bullying_victim".

Rules:
- If blocked=true, the message must not appear in chat; still set distress=true if applicable.
- If distress=true but message is a cry for help without toxic content, blocked should usually be false so staff can respond.
- Never block solely for asking legitimate questions about grades or teachers (polite tone).`,
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: `From ${sender_name}: "${message}"` }],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        },
      );

      if (!response.ok) {
        console.error("AI gateway error:", response.status);
      } else {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = safeParseMod(text);

        if (parsed) {
          result = { blocked: false, block_reason: null, flag: false, flag_reason: null, distress: false, distress_category: null };
          if (typeof parsed.blocked === "boolean") result.blocked = parsed.blocked;
          if (parsed.block_reason != null) result.block_reason = String(parsed.block_reason);
          if (typeof parsed.flag === "boolean") result.flag = parsed.flag;
          if (parsed.flag_reason != null) result.flag_reason = String(parsed.flag_reason);
          if (typeof parsed.distress === "boolean") result.distress = parsed.distress;
          if (parsed.distress_category != null) {
            result.distress_category = String(parsed.distress_category);
          }
        }

        // Legacy shape from older clients / prompts: { safe: boolean, reason?: string }
        if (parsed && "safe" in parsed && typeof (parsed as { safe?: boolean }).safe === "boolean") {
          const legacy = parsed as { safe: boolean; reason?: string };
          if (legacy.safe === false) {
            result!.blocked = true;
            result!.block_reason = legacy.reason || "התוכן אינו מתאים לשיח הקהילה";
          }
        }
      }
    }

    if (!result) result = localModerate(message);
    if (result.blocked) result.flag = false;

    if (result.distress) {
      const { data: prof, error: profErr } = await admin
        .from("profiles")
        .select("school_id")
        .eq("id", sender_id)
        .maybeSingle();

      if (!profErr && prof?.school_id) {
        const excerpt = message.length > 400 ? message.slice(0, 400) + "…" : message;
        await admin.from("chat_safety_events").insert({
          school_id: prof.school_id,
          user_id: sender_id,
          conversation_id: conversation_id ?? null,
          message_excerpt: excerpt,
          category: result.distress_category || "distress_signal",
          severity: "high",
        });
      }
    }

    return json(await signed(result));
  } catch (e) {
    console.error("moderation error:", e);
    return json(await signed(localModerate(message)));
  }
});
