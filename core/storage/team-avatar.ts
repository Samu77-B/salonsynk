import { createAdminClient } from "@core/supabase/admin";

export const TEAM_AVATAR_BUCKET = "team-avatars";
export const MAX_TEAM_AVATAR_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export function resolveImageMimeType(file: {
  type?: string;
  name?: string;
}): string | null {
  const type = String(file.type || "").toLowerCase();
  if (ALLOWED_TYPES.includes(type)) return type;
  const ext = file.name?.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_MIME[ext] ?? null;
}

export async function uploadTeamAvatarImage(
  storagePath: string,
  file: Blob & { name?: string; type?: string; size?: number }
): Promise<{ error: string | null; url?: string }> {
  const size = Number(file.size) || 0;
  if (size === 0) return { error: "No file provided" };
  if (size > MAX_TEAM_AVATAR_BYTES) {
    return { error: "Image must be under 5MB" };
  }

  const contentType = resolveImageMimeType(file);
  if (!contentType) {
    return { error: "Use JPEG, PNG, GIF, or WebP" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Storage not configured";
    return { error: msg };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { error: uploadError } = await admin.storage
    .from(TEAM_AVATAR_BUCKET)
    .upload(storagePath, buffer, { upsert: true, contentType });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = admin.storage.from(TEAM_AVATAR_BUCKET).getPublicUrl(storagePath);
  const url = `${urlData.publicUrl}?v=${Date.now()}`;
  return { error: null, url };
}
