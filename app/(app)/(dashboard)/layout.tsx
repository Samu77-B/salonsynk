import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { verifyPinSessionToken } from "@/lib/passcode";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isManagerRole } from "@/lib/dashboard-roles";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const salonContext = await getCurrentUserSalon();
  if (!salonContext) redirect("/onboarding");

  const isSuperAdmin = await getIsSuperAdmin();
  const isManager = isManagerRole(isSuperAdmin, salonContext.member.role ?? "");

  let hasPasscode = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("salon_members")
      .select("passcode_hash")
      .eq("id", salonContext.member.id)
      .single();
    hasPasscode = Boolean((data as Record<string, unknown> | null)?.passcode_hash);
  } catch {
    // column may not exist
  }

  if (!isManager && hasPasscode) {
    const jar = await cookies();
    const token = jar.get("pin_session")?.value;
    let valid = false;
    if (token) {
      const session = verifyPinSessionToken(token);
      valid = Boolean(
        session &&
        session.memberId === salonContext.member.id &&
        session.salonId === salonContext.salon.id
      );
    }
    if (!valid) redirect("/pin");
  }

  return <>{children}</>;
}
