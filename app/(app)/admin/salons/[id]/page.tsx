import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminEditSalonForm } from "./admin-edit-salon-form";

export default async function AdminEditSalonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, settings")
    .eq("id", id)
    .single();
  if (!salon) notFound();

  const { data: members } = await supabase
    .from("salon_members")
    .select("id, role, display_name, user_id")
    .eq("salon_id", id)
    .eq("is_active", true);

  const userIds = (members ?? []).map((m) => m.user_id).filter(Boolean);
  const profilesMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.email) profilesMap[p.id] = p.email;
    }
  }

  const settings = (salon.settings as Record<string, unknown>) ?? {};
  const branding = (settings.branding as Record<string, string | undefined>) ?? {};

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/salons" className="text-muted hover:text-foreground text-sm">
          ← Salons
        </Link>
        <h1 className="text-2xl font-bold">Edit salon</h1>
      </div>
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <a
          href={`/api/admin/switch-salon?salonId=${salon.id}`}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Manage salon (Team, Services, Clients…)
        </a>
        <span className="text-muted text-sm flex flex-wrap gap-x-3 gap-y-1">
          <span>
            Booking:{" "}
            <a
              href={`/book/${salon.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              /book/{salon.slug}
            </a>
          </span>
          <span>
            Shop:{" "}
            <a
              href={`/shop/${salon.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              /shop/{salon.slug}
            </a>
          </span>
        </span>
      </div>
      <AdminEditSalonForm
        salonId={salon.id}
        initialName={salon.name}
        initialSlug={salon.slug}
        initialBranding={{
          logo_url: branding.logo_url ?? "",
          primary_color: branding.primary_color ?? "",
          company_name: branding.company_name ?? "",
        }}
        owners={(members ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          display_name: m.display_name,
          email: profilesMap[m.user_id] ?? null,
        }))}
      />
    </div>
  );
}
