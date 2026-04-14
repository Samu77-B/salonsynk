"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { revalidatePath } from "next/cache";

export type TargetType = "revenue" | "appointments" | "retail";
export type TargetPeriod = "weekly" | "monthly";

export type StaffTarget = {
  id: string;
  member_id: string;
  target_type: TargetType;
  target_value: number;
  period: TargetPeriod;
  is_active: boolean;
};

const VALID_TYPES: TargetType[] = ["revenue", "appointments", "retail"];
const VALID_PERIODS: TargetPeriod[] = ["weekly", "monthly"];

export async function upsertStaffTarget(
  salonId: string,
  memberId: string,
  targetType: TargetType,
  period: TargetPeriod,
  targetValue: number
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can set targets" };
  if (!VALID_TYPES.includes(targetType)) return { error: "Invalid target type" };
  if (!VALID_PERIODS.includes(period)) return { error: "Invalid period" };
  if (targetValue < 0) return { error: "Target must be positive" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_targets")
    .upsert(
      {
        salon_id: salonId,
        member_id: memberId,
        target_type: targetType,
        target_value: targetValue,
        period,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "salon_id,member_id,target_type,period" }
    );
  if (error) return { error: error.message };
  revalidatePath("/targets");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteStaffTarget(
  salonId: string,
  targetId: string
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (context.member.role !== "owner") return { error: "Only owners can remove targets" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_targets")
    .delete()
    .eq("id", targetId)
    .eq("salon_id", salonId);
  if (error) return { error: error.message };
  revalidatePath("/targets");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateClientIncentive(
  salonId: string,
  clientId: string,
  pointsDelta: number
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("client_incentives")
    .select("id, points, total_visits")
    .eq("salon_id", salonId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) {
    const newPoints = Math.max(0, (existing.points ?? 0) + pointsDelta);
    const newVisits = (existing.total_visits ?? 0) + (pointsDelta > 0 ? 1 : 0);
    const tier = newVisits >= 20 ? "gold" : newVisits >= 10 ? "silver" : "bronze";
    const { error } = await supabase
      .from("client_incentives")
      .update({
        points: newPoints,
        total_visits: newVisits,
        tier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const points = Math.max(0, pointsDelta);
    const visits = pointsDelta > 0 ? 1 : 0;
    const { error } = await supabase
      .from("client_incentives")
      .insert({
        salon_id: salonId,
        client_id: clientId,
        points,
        total_visits: visits,
        tier: "bronze",
      });
    if (error) return { error: error.message };
  }

  revalidatePath("/targets");
  revalidatePath("/clients");
  return { error: null };
}

export async function redeemClientReward(
  salonId: string,
  clientId: string,
  pointsCost: number
): Promise<{ error: string | null }> {
  const context = await getCurrentUserSalon();
  if (!context || context.salon.id !== salonId) return { error: "Unauthorized" };
  if (pointsCost <= 0) return { error: "Invalid points amount" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("client_incentives")
    .select("id, points")
    .eq("salon_id", salonId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!existing || (existing.points ?? 0) < pointsCost) {
    return { error: "Not enough points" };
  }

  const { error } = await supabase
    .from("client_incentives")
    .update({
      points: (existing.points ?? 0) - pointsCost,
      last_reward_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  if (error) return { error: error.message };
  revalidatePath("/targets");
  revalidatePath("/clients");
  return { error: null };
}
