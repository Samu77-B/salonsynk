import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { hasQueueManagerAccess } from "@core/queue/platform-queue-access";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { BarberChairsView } from "./barber-chairs-view";

export const dynamic = "force-dynamic";

export default async function BarberChairsPage() {
  const context = await getCurrentUserShop();
  if (!context) redirect("/barber/access");

  const isSuperAdmin = await getIsSuperAdmin();
  const canManage = hasQueueManagerAccess(
    isSuperAdmin,
    context.member.role ?? "",
    context.member.id
  );
  if (!canManage) redirect("/barber/dashboard");

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("barber_members")
    .select("id, display_name, chair_number")
    .eq("shop_id", context.shop.id)
    .eq("is_active", true)
    .order("display_name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/barber/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Live queue
        </Link>
        <h1 className="text-xl font-bold mt-1">Chairs</h1>
        <p className="text-sm text-muted mt-1">
          Match each chair in the shop to a barber. Customers see chair numbers on the join page.
        </p>
      </div>

      <BarberChairsView members={JSON.parse(JSON.stringify(members ?? []))} />
    </div>
  );
}
