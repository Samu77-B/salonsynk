import type { SupabaseClient } from "@supabase/supabase-js";
import { COLOUR_WAIVER_VERSION } from "@/lib/booking-policy";

export type ColourWaiverInput = {
  salonId: string;
  clientId: string;
  signerName: string;
  signerEmail?: string | null;
  signerPhone?: string | null;
  signatureData?: string | null;
  waiverText: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function signatureMethod(signatureData: string | null | undefined, signerName: string): "typed" | "drawn" | "typed_and_drawn" {
  const drawn = Boolean(signatureData?.startsWith("data:image"));
  const typed = signerName.trim().length > 0;
  if (drawn && typed) return "typed_and_drawn";
  if (drawn) return "drawn";
  return "typed";
}

export function validateColourWaiver(input: {
  agreed?: boolean;
  signerName?: string | null;
  signatureData?: string | null;
}): string | null {
  if (!input.agreed) return "Please confirm you have read and agree to the waiver.";
  const name = input.signerName?.trim() ?? "";
  if (name.length < 2) return "Please type your full legal name to sign the waiver.";
  const sig = input.signatureData ?? "";
  if (sig && sig.length > 180_000) return "Signature image is too large. Please sign again with a simpler stroke, or type your name only.";
  return null;
}

export async function saveColourPatchTestWaiver(
  db: SupabaseClient,
  input: ColourWaiverInput
): Promise<{ waiverId: string } | { error: string }> {
  const signerName = input.signerName.trim();
  const signatureData = input.signatureData?.startsWith("data:image") ? input.signatureData : null;

  const { data, error } = await db
    .from("client_waivers")
    .insert({
      salon_id: input.salonId,
      client_id: input.clientId,
      waiver_type: "colour_patch_test",
      declined_patch_test: true,
      signer_name: signerName,
      signer_email: input.signerEmail?.trim() || null,
      signer_phone: input.signerPhone?.trim() || null,
      signature_data: signatureData,
      signature_method: signatureMethod(signatureData, signerName),
      waiver_version: COLOUR_WAIVER_VERSION,
      waiver_text: input.waiverText,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("client_waivers") && (msg.includes("does not exist") || msg.includes("schema cache"))) {
      return { error: "Patch test waiver storage is not set up yet. Please contact the salon." };
    }
    return { error: error?.message ?? "Could not save waiver" };
  }

  const waiverId = data.id as string;
  const signedAt = new Date().toISOString();
  await db
    .from("clients")
    .update({ colour_waiver_signed_at: signedAt, colour_waiver_id: waiverId })
    .eq("id", input.clientId)
    .eq("salon_id", input.salonId);

  return { waiverId };
}

export async function fetchLatestColourWaiver(
  db: SupabaseClient,
  salonId: string,
  clientId: string
): Promise<{
  id: string;
  signed_at: string;
  signer_name: string;
  declined_patch_test: boolean;
  waiver_version: string;
} | null> {
  const { data, error } = await db
    .from("client_waivers")
    .select("id, signed_at, signer_name, declined_patch_test, waiver_version")
    .eq("salon_id", salonId)
    .eq("client_id", clientId)
    .eq("waiver_type", "colour_patch_test")
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as never;
}
