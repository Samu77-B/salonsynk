import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/salonsynk_logo.png" alt="SalonSynk" width={32} height={32} className="h-8 w-auto" />
          <span className="font-semibold sr-only sm:not-sr-only">SalonSynk</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-muted hover:text-foreground">
            Diary
          </Link>
          <Link href="/team" className="text-muted hover:text-foreground">
            Team
          </Link>
          <Link href="/clients" className="text-muted hover:text-foreground">
            Clients
          </Link>
          <Link href="/checkout" className="text-muted hover:text-foreground">
            Checkout
          </Link>
          <Link href="/settings" className="text-muted hover:text-foreground">
            Settings
          </Link>
          <span className="text-muted">{user.email}</span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="text-muted hover:text-foreground text-sm">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
