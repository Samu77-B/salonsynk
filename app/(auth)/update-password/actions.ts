"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveAuthNextPath, type ProductHost } from "@/lib/platform-host";

function friendlyPasswordError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("session") || lower.includes("not authenticated")) {
    return "Your setup link has expired. Open the latest email we sent and try again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Could not save your password. Please try again.";
  }
  return message;
}

export async function setPasswordAndContinue(
  password: string,
  confirmPassword: string,
  nextPath: string,
  product: ProductHost
): Promise<{ error?: string; next?: string }> {
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Your setup link has expired. Open the latest email we sent and try again.",
    };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: friendlyPasswordError(error.message) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save your password. Please try again.";
    return { error: friendlyPasswordError(message) };
  }

  return { next: resolveAuthNextPath(product, nextPath) };
}
