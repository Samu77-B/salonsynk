import "server-only";

import { createAdminClient } from "@core/supabase/admin";

const METADATA_KEY = "pending_admin_return";
const TTL_MS = 10 * 60 * 1000;

type PendingReturn = { path: string; exp: number };

/**
 * Supabase strips query strings before matching redirect URLs against the
 * allow-list, so the post-login destination cannot ride along on the callback
 * URL. Park it on the user record instead and read it back after the session
 * is established on the product domain.
 */
export async function setPendingAdminReturn(
  userId: string,
  path: string
): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  const existing = (data?.user?.app_metadata ?? {}) as Record<string, unknown>;

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...existing,
      [METADATA_KEY]: { path, exp: Date.now() + TTL_MS } satisfies PendingReturn,
    },
  });
}

export async function consumePendingAdminReturn(
  userId: string
): Promise<string | null> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data } = await admin.auth.admin.getUserById(userId);
  const metadata = (data?.user?.app_metadata ?? {}) as Record<string, unknown>;
  const pending = metadata[METADATA_KEY] as PendingReturn | undefined;

  if (!pending?.path) return null;

  const rest = { ...metadata };
  delete rest[METADATA_KEY];
  await admin.auth.admin.updateUserById(userId, { app_metadata: rest });

  if (typeof pending.exp !== "number" || pending.exp < Date.now()) return null;
  return pending.path;
}
