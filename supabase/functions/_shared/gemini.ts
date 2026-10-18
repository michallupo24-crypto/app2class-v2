// Single place for the Gemini model name. gemini-1.5-flash was retired and every
// call to it failed, which silently disabled all AI features. Override per
// environment with the GEMINI_MODEL secret instead of editing four functions.
export const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

export function geminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}
