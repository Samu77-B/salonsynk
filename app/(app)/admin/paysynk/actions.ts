"use server";

import { revalidatePath } from "next/cache";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { createPaysynkSignup, patchPaysynkSignup } from "@core/paysynk/admin-api";
import type { PaysynkCreateSignupResult, PaysynkSignupStatus } from "@core/paysynk/types";

async function requireAdmin() {
  const ok = await getIsSuperAdmin();
  if (!ok) throw new Error("Unauthorized");
}

function revalidatePaysynk() {
  revalidatePath("/admin/paysynk");
  revalidatePath("/admin");
  revalidatePath("/smart/overview");
}

export async function adminCreatePaysynkClient(input: {
  fullName: string;
  storeName: string;
  email: string;
  password?: string;
  approve?: boolean;
}): Promise<{ error?: string; data?: PaysynkCreateSignupResult }> {
  await requireAdmin();

  const fullName = input.fullName.trim();
  const storeName = input.storeName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password?.trim();

  if (!fullName) return { error: "Owner name is required." };
  if (!storeName) return { error: "Store name is required." };
  if (!email) return { error: "Email is required." };

  const result = await createPaysynkSignup({
    fullName,
    storeName,
    email,
    ...(password ? { password } : {}),
    ...(input.approve ? { approve: true } : {}),
  });

  if (!result.ok) return { error: result.error };

  revalidatePaysynk();
  return { data: result.data };
}

export async function adminPatchPaysynkSignup(
  id: string,
  input: { status?: PaysynkSignupStatus; adminNotes?: string; name?: string }
): Promise<{ error?: string }> {
  await requireAdmin();

  const signupId = id.trim();
  if (!signupId) return { error: "Missing signup id." };

  const result = await patchPaysynkSignup(signupId, {
    ...(input.status ? { status: input.status } : {}),
    ...(typeof input.adminNotes === "string" ? { adminNotes: input.adminNotes } : {}),
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
  });

  if (!result.ok) return { error: result.error };

  revalidatePaysynk();
  return {};
}
