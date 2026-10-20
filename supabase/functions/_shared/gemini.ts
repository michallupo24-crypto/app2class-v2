// Single place for the Gemini model name. gemini-1.5-flash was retired and every
// call to it failed, which silently disabled all AI features. Override per
// environment with the GEMINI_MODEL secret instead of editing four functions.
export const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

export function geminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

// Gemini sometimes hangs or answers 503 ("high demand"). With no timeout a hung
// call ran into the 150s edge-function limit and the student waited for nothing.
// Cap each attempt and retry once on 5xx/timeout; both attempts fit well under
// the platform limit. A final timeout surfaces as a 504 Response.
export async function fetchGemini(
  apiKey: string,
  body: unknown,
  { timeoutMs = 45_000, retries = 1 } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(geminiUrl(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (!ctrl.signal.aborted) throw e;
      console.warn(`Gemini timed out after ${timeoutMs}ms (attempt ${attempt + 1})`);
      res = new Response(JSON.stringify({ error: { code: 504, message: "Gemini timed out" } }), { status: 504 });
    } finally {
      clearTimeout(timer);
    }
    if (res.status < 500 || attempt >= retries) return res;
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 1000));
  }
}
