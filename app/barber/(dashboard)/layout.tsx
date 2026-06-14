import Link from "next/link";
import { createClient } from "@core/supabase/server";
import { redirect } from "next/navigation";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { isManagerRole } from "@core/auth/dashboard-roles";

export default async function BarberDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isSuperAdmin = await getIsSuperAdmin();
  const shopContext = await getCurrentUserShop();
  if (!shopContext) redirect("/onboarding");

  const memberRole = shopContext.member.role ?? null;
  const isManager = isManagerRole(isSuperAdmin, memberRole ?? "");
  const isOwner = memberRole === "owner" || shopContext.member.id === "admin";

  return (
    <div className="app-shell-dark min-h-screen flex flex-col overflow-x-hidden bg-canvas text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">Barber Synk</span>
          <span className="text-xs text-muted ml-2 hidden sm:inline">{shopContext.shop.name}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm ml-4">
          <Link href="/barber/dashboard" className="text-muted hover:text-foreground">
            Queue
          </Link>
          <Link href="/barber/appointments" className="text-muted hover:text-foreground">
            Bookings
          </Link>
          {isOwner && (
            <>
              <Link href="/barber/services" className="text-muted hover:text-foreground">
                Services
              </Link>
              <Link href="/barber/team" className="text-muted hover:text-foreground">
                Team
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-muted">
          {isManager && <span className="text-xs opacity-60">Manager</span>}
          <span className="text-xs">{user.email}</span>
        </div>
      </header>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col text-foreground">
        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
