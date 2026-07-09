import type { SupabaseClient } from "@supabase/supabase-js";
import { earnPointsFromSpend } from "./calculate";
import { parseLoyaltySettings, type LoyaltySettings } from "./settings";

export type LoyaltySaleInput = {
  salonId: string;
  clientId: string;
  saleReference: string;
  servicePaidMinor: number;
  productPaidMinor: number;
  redeemServicePoints: number;
  redeemProductPoints: number;
  memberId?: string | null;
};

type IncentiveRow = {
  id: string;
  service_points: number;
  product_points: number;
  points: number;
  total_visits: number;
};

async function loadSalonLoyaltySettings(
  db: SupabaseClient,
  salonId: string
): Promise<LoyaltySettings | null> {
  const { data: salon } = await db.from("salons").select("settings").eq("id", salonId).maybeSingle();
  const settings = parseLoyaltySettings((salon?.settings as Record<string, unknown>) ?? {});
  return settings.enabled ? settings : null;
}

async function getOrCreateIncentive(
  db: SupabaseClient,
  salonId: string,
  clientId: string
): Promise<IncentiveRow | null> {
  const { data: existing } = await db
    .from("client_incentives")
    .select("id, service_points, product_points, points, total_visits")
    .eq("salon_id", salonId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) return existing as IncentiveRow;

  const { data: inserted, error } = await db
    .from("client_incentives")
    .insert({
      salon_id: salonId,
      client_id: clientId,
      service_points: 0,
      product_points: 0,
      points: 0,
      total_visits: 0,
      tier: "bronze",
    })
    .select("id, service_points, product_points, points, total_visits")
    .single();

  if (error || !inserted) return null;
  return inserted as IncentiveRow;
}

async function ledgerExists(
  db: SupabaseClient,
  salonId: string,
  saleReference: string,
  entryType: "earn" | "redeem"
): Promise<boolean> {
  const { data } = await db
    .from("client_points_ledger")
    .select("id")
    .eq("salon_id", salonId)
    .eq("sale_reference", saleReference)
    .eq("entry_type", entryType)
    .maybeSingle();
  return Boolean(data);
}

export async function applyLoyaltyForCompletedSale(
  db: SupabaseClient,
  input: LoyaltySaleInput
): Promise<{ error: string | null }> {
  const settings = await loadSalonLoyaltySettings(db, input.salonId);
  if (!settings) return { error: null };

  const { data: client } = await db
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("salon_id", input.salonId)
    .maybeSingle();
  if (!client) return { error: null };

  const incentive = await getOrCreateIncentive(db, input.salonId, input.clientId);
  if (!incentive) return { error: "Could not load loyalty balance" };

  const redeemService = Math.max(0, Math.floor(input.redeemServicePoints));
  const redeemProduct = Math.max(0, Math.floor(input.redeemProductPoints));
  const hadVisit = input.servicePaidMinor + input.productPaidMinor > 0;

  if (await ledgerExists(db, input.salonId, input.saleReference, "earn")) {
    return { error: null };
  }

  let servicePoints = incentive.service_points ?? 0;
  let productPoints = incentive.product_points ?? 0;

  if (redeemService > 0 || redeemProduct > 0) {
    if (servicePoints < redeemService || productPoints < redeemProduct) {
      return { error: "Insufficient loyalty points for this sale" };
    }
    servicePoints -= redeemService;
    productPoints -= redeemProduct;
    const { error: redeemLedgerError } = await db.from("client_points_ledger").insert({
      salon_id: input.salonId,
      client_id: input.clientId,
      entry_type: "redeem",
      service_points_delta: -redeemService,
      product_points_delta: -redeemProduct,
      sale_reference: input.saleReference,
      created_by: input.memberId ?? null,
    });
    if (redeemLedgerError) return { error: redeemLedgerError.message };
  }

  const earned = earnPointsFromSpend(settings, input.servicePaidMinor, input.productPaidMinor);

  if (earned.servicePoints > 0 || earned.productPoints > 0) {
    servicePoints += earned.servicePoints;
    productPoints += earned.productPoints;
    const { error: earnLedgerError } = await db.from("client_points_ledger").insert({
      salon_id: input.salonId,
      client_id: input.clientId,
      entry_type: "earn",
      service_points_delta: earned.servicePoints,
      product_points_delta: earned.productPoints,
      sale_reference: input.saleReference,
      created_by: input.memberId ?? null,
    });
    if (earnLedgerError) return { error: earnLedgerError.message };
  }

  const totalVisits = (incentive.total_visits ?? 0) + (hadVisit ? 1 : 0);
  const tier = totalVisits >= 20 ? "gold" : totalVisits >= 10 ? "silver" : "bronze";

  const updatePayload: Record<string, unknown> = {
    service_points: servicePoints,
    product_points: productPoints,
    points: servicePoints + productPoints,
    total_visits: totalVisits,
    tier,
    updated_at: new Date().toISOString(),
  };
  if (redeemService + redeemProduct > 0) {
    updatePayload.last_reward_at = new Date().toISOString();
  }

  const { error: updateError } = await db.from("client_incentives").update(updatePayload).eq("id", incentive.id);

  if (updateError) return { error: updateError.message };
  return { error: null };
}

export async function fetchClientLoyaltyBalance(
  db: SupabaseClient,
  salonId: string,
  clientId: string
): Promise<{ servicePoints: number; productPoints: number; enrolled: boolean } | null> {
  const settings = await loadSalonLoyaltySettings(db, salonId);
  if (!settings) return null;

  const { data: client } = await db
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("salon_id", salonId)
    .maybeSingle();
  if (!client) return null;

  const { data: inc } = await db
    .from("client_incentives")
    .select("service_points, product_points")
    .eq("salon_id", salonId)
    .eq("client_id", clientId)
    .maybeSingle();

  return {
    servicePoints: inc?.service_points ?? 0,
    productPoints: inc?.product_points ?? 0,
    enrolled: true,
  };
}
