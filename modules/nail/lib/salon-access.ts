import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { hasQueueManagerAccess } from "@core/queue/platform-queue-access";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";

export async function requireNailSalonManager() {
  const context = await getCurrentUserNailSalon();
  if (!context) return { error: "Unauthorized" as const, context: null, isManager: false };

  const isSuperAdmin = await getIsSuperAdmin();
  const isManager = hasQueueManagerAccess(
    isSuperAdmin,
    context.member.role ?? "",
    context.member.id
  );

  if (!isManager) {
    return { error: "Only salon managers can do this" as const, context: null, isManager: false };
  }

  return { error: null, context, isManager: true };
}
