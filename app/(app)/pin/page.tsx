import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyPinSessionToken } from "@/lib/passcode";
import { createClient } from "@/lib/supabase/server";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isGeneralSalonStaffRole, isManagerRole } from "@/lib/dashboard-roles";
import { enforceSalonSubscriptionIfRequired } from "@/lib/subscription-gate.server";
import PinEntryView from "./pin-entry-view";

export default async function PinPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  await enforceSalonSubscriptionIfRequired();

  const isSuperAdmin = await getIsSuperAdmin();
  const role = context.member.role ?? "";
  const isManager = isManagerRole(isSuperAdmin, role);
  if (isManager || isGeneralSalonStaffRole(role)) redirect("/dashboard");

  const supabase = await createClient();
  let hasPasscode = false;
  try {
    const { data } = await supabase
      .from("salon_members")
      .select("passcode_hash")
      .eq("id", context.member.id)
      .single();
    hasPasscode = Boolean((data as Record<string, unknown> | null)?.passcode_hash);
  } catch {
    // column may not exist yet
  }

  if (!hasPasscode) redirect("/dashboard");

  const jar = await cookies();
  const token = jar.get("pin_session")?.value;
  if (token) {
    const session = verifyPinSessionToken(token);
    if (session && session.memberId === context.member.id && session.salonId === context.salon.id) {
      redirect("/dashboard");
    }
  }

  return <PinEntryView displayName={context.member.display_name ?? context.salon.name} />;
}
