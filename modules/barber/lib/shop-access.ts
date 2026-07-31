import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { hasQueueManagerAccess } from "@core/queue/platform-queue-access";
import { getCurrentUserShop } from "@modules/barber/lib/shop";

export async function requireBarberShopManager() {
  const context = await getCurrentUserShop();
  if (!context) return { error: "Unauthorized" as const, context: null, isManager: false };

  const isSuperAdmin = await getIsSuperAdmin();
  const isManager = hasQueueManagerAccess(
    isSuperAdmin,
    context.member.role ?? "",
    context.member.id
  );

  if (!isManager) {
    return { error: "Only shop managers can do this" as const, context: null, isManager: false };
  }

  return { error: null, context, isManager: true };
}
