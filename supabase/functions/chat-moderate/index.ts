import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

// Moderation is a keyword check only - no AI reads students' messages.
// Threats and insults are blocked; distress phrases alert the counselor.
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
    conversation_id = body.conversation_id as string | undefined;

    const result = localModerate(message);
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
