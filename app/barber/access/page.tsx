import Link from "next/link";
import { createClient } from "@core/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentUserShop } from "@modules/barber/lib/shop";

export default async function BarberAccessPage() {
  const context = await getCurrentUserShop();
  if (context) redirect("/barber/dashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="barber-dashboard min-h-screen bg-canvas text-foreground flex items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold">Barber shop access</h1>
        <p className="text-sm text-muted">
          Your login is active, but this account is not linked to a BarberSynk shop yet. If you
          received a welcome email, open the set-password link from that message again, or ask your
          admin to resend the invite.
        </p>
        <p className="text-sm text-muted">
          Signed in as <span className="text-foreground">{user.email}</span>
        </p>
        <Link href="/barber/login" className="btn-accent inline-block px-6 py-3 text-sm font-semibold">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
