import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@core/supabase/admin";
import { getCurrentUserShop } from "@modules/barber/lib/shop";
import { BarberTeamView } from "./barber-team-view";
import { BarberShopBrandingForm } from "./barber-shop-branding-form";

export const dynamic = "force-dynamic";

export default async function BarberTeamPage() {
  const context = await getCurrentUserShop();
  if (!context) redirect("/onboarding");

  const isOwner = context.member.role === "owner" || context.member.id === "admin";
  if (!isOwner) redirect("/barber/dashboard");

  const admin = createAdminClient();
  const { data: shopRow } = await admin
    .from("barber_shops")
    .select("settings")
    .eq("id", context.shop.id)
    .single();

  const settings = (shopRow?.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | boolean | undefined>) ?? {};
  const brandingStr = (key: string) => {
    const v = branding[key];
    return typeof v === "string" ? v : "";
  };

  const { data: members } = await admin
    .from("barber_members")
    .select(
      "id, role, display_name, user_id, avatar_url, chair_number, is_accepting_walk_ins"
    )
    .eq("shop_id", context.shop.id)
    .eq("is_active", true)
    .order("role")
    .order("display_name");

  const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean) as string[];
  const profilesMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.email) profilesMap[p.id] = p.email;
    }
  }

  const joinUrl = `/barber/join/${context.shop.slug}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/barber/dashboard" className="text-sm text-muted hover:text-foreground">
            ← Live queue
          </Link>
          <h1 className="text-xl font-bold mt-1">Team</h1>
          <p className="text-sm text-muted mt-1">
            Use the checkbox on each person to show or hide them on the public{" "}
            <span className="font-medium text-foreground">Choose your barber</span> page.
          </p>
        </div>
      </div>

      <BarberShopBrandingForm
        shopName={context.shop.name}
        initialCompanyName={brandingStr("company_name").trim() || context.shop.name}
        initialShowTitle={branding.show_title_on_queue !== false}
      />

      <BarberTeamView
        members={JSON.parse(
          JSON.stringify(
            (members ?? []).map((m) => ({
              ...m,
              email: m.user_id ? profilesMap[m.user_id] ?? null : null,
            }))
          )
        )}
      />
    </div>
  );
}
