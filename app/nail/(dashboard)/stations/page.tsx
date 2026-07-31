import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { hasQueueManagerAccess } from "@core/queue/platform-queue-access";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { NailStationsView } from "./nail-stations-view";

export const dynamic = "force-dynamic";

export default async function NailStationsPage() {
  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/onboarding");

  const isSuperAdmin = await getIsSuperAdmin();
  const canManage = hasQueueManagerAccess(
    isSuperAdmin,
    context.member.role ?? "",
    context.member.id
  );
  if (!canManage) redirect("/nail/queue");

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("nail_members")
    .select("id, display_name, station_number")
    .eq("salon_id", context.salon.id)
    .eq("is_active", true)
    .order("display_name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/nail/queue" className="text-sm text-muted hover:text-foreground">
          ← Live queue
        </Link>
        <h1 className="text-xl font-bold mt-1">Stations</h1>
        <p className="text-sm text-muted mt-1">
          Match each station in the salon to a technician. Customers see station numbers on the join
          page.
        </p>
      </div>

      <NailStationsView members={JSON.parse(JSON.stringify(members ?? []))} />
    </div>
  );
}
