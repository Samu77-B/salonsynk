"use server";

import { revalidatePath } from "next/cache";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { createGymsynkTenant } from "@core/gymsynk/admin-api";
import type { GymsynkCreateTenantResult } from "@core/gymsynk/types";

async function requireAdmin() {
  const ok = await getIsSuperAdmin();
  if (!ok) throw new Error("Unauthorized");
}

export async function adminCreateGymsynkClient(input: {
  ownerName: string;
  gymName: string;
  email: string;
  password?: string;
  slug?: string;
}): Promise<{ error?: string; data?: GymsynkCreateTenantResult }> {
  await requireAdmin();

  const ownerName = input.ownerName.trim();
  const gymName = input.gymName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password?.trim();
  const slug = input.slug?.trim().toLowerCase();

  if (!ownerName) return { error: "Owner name is required." };
  if (!gymName) return { error: "Gym name is required." };
  if (!email) return { error: "Email is required." };
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Slug can only use lowercase letters, numbers, and hyphens." };
  }

  const result = await createGymsynkTenant({
    ownerName,
    gymName,
    email,
    ...(password ? { password } : {}),
    ...(slug ? { slug } : {}),
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/gymsynk");
  revalidatePath("/admin");
  revalidatePath("/smart/overview");
  return { data: result.data };
}
