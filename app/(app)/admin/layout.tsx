import { redirect } from "next/navigation";
import Link from "next/link";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isSuperAdmin = await getIsSuperAdmin();
  if (!isSuperAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-4 bg-background">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-semibold text-accent">
            Master Admin
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted">
            <Link href="/admin" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/admin/signups" className="hover:text-foreground">
              Signups
            </Link>
            <Link href="/admin/salons" className="hover:text-foreground">
              Salons
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-muted hover:text-foreground">
            Back to app
          </Link>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
