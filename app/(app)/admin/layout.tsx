import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { isSmartSynkHost } from "@core/config/smart-site";
import { SmartDashboardShell } from "@/components/smart/dashboard/smart-dashboard-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) redirect("/dashboard");

  const host = (await headers()).get("host") ?? "";
  const onSmart = isSmartSynkHost(host);

  if (onSmart) {
    return (
      <SmartDashboardShell>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </SmartDashboardShell>
    );
  }

  const backHref = "/dashboard";

  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <header className="flex flex-col gap-3 border-b border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/admin" className="shrink-0 font-semibold text-accent">
            Master Admin
          </Link>
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted sm:text-sm">
            <Link href="/admin" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/admin/signups" className="hover:text-foreground">
              Signups
            </Link>
            <Link href="/admin/salons" className="hover:text-foreground">
              Salons
            </Link>
            <Link href="/admin/barber-shops" className="hover:text-foreground">
              Barbers
            </Link>
            <Link href="/admin/nail-salons" className="hover:text-foreground">
              Nails
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs sm:text-sm">
          <Link
            href="/admin/barber-shops/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Add barber
          </Link>
          <Link
            href="/admin/nail-salons/new"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
          >
            Add nail bar
          </Link>
          <Link href={backHref} className="text-muted hover:text-foreground">
            Back to app
          </Link>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
    </div>
  );
}
