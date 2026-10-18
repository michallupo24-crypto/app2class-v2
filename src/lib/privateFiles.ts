import { supabase } from "@/integrations/supabase/client";

// Student work and medical notes live in the private 'private-files' bucket.
// The DB column keeps a reference ("private-files:<path>") rather than a URL,
// because a signed URL expires; it is signed again each time it is opened.
const BUCKET = "private-files";
const PREFIX = `${BUCKET}:`;

/** Uploads into <kind>/<userId>/... and returns the reference to store. */
export async function uploadPrivateFile(kind: string, userId: string, name: string, file: File): Promise<string> {
  const path = `${kind}/${userId}/${name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return PREFIX + path;
}

/** Turns a stored reference into a short-lived URL; legacy public URLs pass through. */
export async function resolveFileUrl(stored: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) return stored;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(stored.slice(PREFIX.length), 60 * 10);
  if (error || !data) throw error ?? new Error("Could not sign file URL");
  return data.signedUrl;
}

/** onClick handler for links to stored files: signs, then opens in a new tab. */
export async function openStoredFile(stored: string) {
  // Open the tab synchronously so popup blockers allow it, then point it at the signed URL.
  // ("noopener" would make window.open return null, so detach the opener by hand.)
  const win = window.open("", "_blank");
  if (win) win.opener = null;
  try {
    const url = await resolveFileUrl(stored);
    if (win) win.location.href = url;
    else window.location.assign(url);
  } catch {
    win?.close();
  }
}
