import { supabase } from "@/integrations/supabase/client";

export type OcrMode = "text" | "handwriting" | "markdown";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip the "data:image/...;base64," prefix
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Sends an image (photo/scan) to the server-side Gemini Vision OCR edge function. */
export async function requestImageOcr(file: File, mode: OcrMode = "text"): Promise<string> {
  const base64Data = await fileToBase64(file);
  const { data, error } = await supabase.functions.invoke("ocr-extract", {
    body: { base64Data, mimeType: file.type || "image/jpeg", ocrMode: mode, languageHint: "hebrew" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.text || "";
}
