import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ClientForm } from "../client-form";
import { ClientDetailView } from "../client-detail-view";
import { ClientPhotos } from "../client-photos";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  type ClientRow = {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    sex?: string | null;
    marketing_opt_in?: boolean | null;
    color_formulas: unknown;
    patch_test_due_at: string | null;
    last_skin_test_at?: string | null;
  };

  const supabase = await createClient();

  async function loadClient(): Promise<ClientRow | null> {
    const withSkinTest = await supabase
      .from("clients")
      .select("id, name, email, phone, notes, sex, marketing_opt_in, color_formulas, patch_test_due_at, last_skin_test_at")
      .eq("id", id)
      .eq("salon_id", context!.salon.id)
      .single();
    if (!withSkinTest.error) return withSkinTest.data as ClientRow | null;
    const withSex = await supabase
      .from("clients")
      .select("id, name, email, phone, notes, sex, marketing_opt_in, color_formulas, patch_test_due_at")
      .eq("id", id)
      .eq("salon_id", context!.salon.id)
      .single();
    if (!withSex.error) return withSex.data as ClientRow | null;
    const basic = await supabase
      .from("clients")
      .select("id, name, email, phone, notes, color_formulas, patch_test_due_at, marketing_opt_in")
      .eq("id", id)
      .eq("salon_id", context!.salon.id)
      .single();
    return basic.data as ClientRow | null;
  }

  const client = await loadClient();

  if (!client) notFound();

  let clientPhotos: { id: string; slot: "profile" | "photo_2" | "photo_3" | "photo_4"; url: string }[] = [];
  try {
    const { data: photos } = await supabase
      .from("client_photos")
      .select("id, slot, url")
      .eq("client_id", id)
      .eq("salon_id", context.salon.id);
    clientPhotos = (photos ?? []).map((p: { id: string; slot: string; url: string }) => ({
      id: p.id,
      slot: p.slot as "profile" | "photo_2" | "photo_3" | "photo_4",
      url: p.url,
    }));
  } catch {
    // client_photos table may not exist yet
  }

  let clientNotes: { id: string; note: string; note_type: string; created_by: string | null; created_at: string }[] = [];
  try {
    const { data: notes } = await supabase
      .from("client_notes")
      .select("id, note, note_type, created_by, created_at")
      .eq("client_id", id)
      .eq("salon_id", context.salon.id)
      .order("created_at", { ascending: false });
    clientNotes = (notes ?? []) as typeof clientNotes;
  } catch {
    // table may not exist yet
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, services(name)")
    .eq("client_id", id)
    .order("start_time", { ascending: false })
    .limit(50);

  const { data: saleRows } = await supabase
    .from("sales_transactions")
    .select("amount_minor, paid_at, service_ids, product_ids")
    .eq("salon_id", context.salon.id)
    .eq("client_id", id)
    .order("paid_at", { ascending: false })
    .limit(100);

  const allServiceIds = new Set<string>();
  const allProductIds = new Set<string>();
  for (const r of saleRows ?? []) {
    for (const s of r.service_ids ?? []) {
      if (s) allServiceIds.add(s);
    }
    for (const p of r.product_ids ?? []) {
      if (p) allProductIds.add(p);
    }
  }

  const [svcRes, prodRes] = await Promise.all([
    allServiceIds.size > 0
      ? supabase.from("services").select("id, name").eq("salon_id", context.salon.id).in("id", [...allServiceIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    allProductIds.size > 0
      ? supabase.from("products").select("id, name").eq("salon_id", context.salon.id).in("id", [...allProductIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const serviceNameById = Object.fromEntries((svcRes.data ?? []).map((s) => [s.id, s.name ?? ""]));
  const productNameById = Object.fromEntries((prodRes.data ?? []).map((p) => [p.id, p.name ?? ""]));

  const salesHistory = (saleRows ?? []).map((r) => ({
    paidAt: r.paid_at,
    amountMinor: Number(r.amount_minor ?? 0),
    serviceLabels: (r.service_ids ?? []).map((i: string) => serviceNameById[i] || "").filter(Boolean),
    productLabels: (r.product_ids ?? []).map((i: string) => productNameById[i] || "").filter(Boolean),
  }));

  const formulas = (client.color_formulas as { text?: string; image_url?: string }[] | null) ?? [];
  const patchDue = client.patch_test_due_at ? new Date(client.patch_test_due_at) : null;
  const now = new Date();
  const daysUntilPatch = patchDue
    ? Math.ceil((patchDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  let loyaltyData: { points: number; total_visits: number; tier: string } | null = null;
  try {
    const { data: inc } = await supabase
      .from("client_incentives")
      .select("points, total_visits, tier")
      .eq("salon_id", context.salon.id)
      .eq("client_id", id)
      .maybeSingle();
    if (inc) {
      loyaltyData = {
        points: inc.points as number,
        total_visits: inc.total_visits as number,
        tier: inc.tier as string,
      };
    }
  } catch {
    // table may not exist yet
  }

  const profilePhoto = clientPhotos.find((p) => p.slot === "profile");
  const avatarSrc = profilePhoto
    ? profilePhoto.url
    : client.sex === "male"
      ? "/imgs/His.png"
      : "/imgs/Her.png";

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl p-4 md:p-6">
      <Link href="/clients" className="text-sm text-muted hover:text-foreground mb-4 inline-block">
        Back to clients
      </Link>
      <div className="flex items-center gap-4 mb-6">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-border bg-background/50">
          <Image
            src={avatarSrc}
            alt={client.name || "Client"}
            fill
            className={`object-cover ${profilePhoto ? "" : "opacity-40"}`}
            sizes="64px"
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">
            {client.name || client.email || client.phone || "Client"}
          </h1>
          {(client.email || client.phone) && (
            <p className="text-sm text-muted truncate">
              {[client.email, client.phone].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {daysUntilPatch !== null && (
        <div
          className={
            daysUntilPatch <= 0
              ? "rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 mb-6"
              : "rounded-lg border border-border p-4 mb-6"
          }
        >
          <p className="text-sm font-medium">Patch test</p>
          <p className={daysUntilPatch <= 0 ? "text-amber-400" : "text-muted"}>
            {daysUntilPatch > 0
              ? `${daysUntilPatch} day${daysUntilPatch === 1 ? "" : "s"} until patch test due`
              : "Patch test due"}
          </p>
          <p className="text-xs text-muted mt-1">
            Due: {patchDue?.toLocaleDateString("en-GB")}
          </p>
        </div>
      )}

      <section className="mb-8">
        <ClientPhotos
          clientId={client.id}
          photos={clientPhotos}
          sex={client.sex ?? null}
        />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Details</h2>
        <ClientForm
          salonId={context.salon.id}
          clientId={client.id}
          initial={{
            name: client.name ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            notes: client.notes ?? "",
            sex: client.sex ?? "",
            marketing_opt_in: client.marketing_opt_in !== false,
          }}
        />
      </section>

      <ClientDetailView
        clientId={client.id}
        salonId={context.salon.id}
        formulas={formulas}
        appointments={appointments ?? []}
        sales={salesHistory}
        onPatchTestDueAt={client.patch_test_due_at}
        onLastSkinTestAt={client.last_skin_test_at ?? null}
        clientNotes={clientNotes}
        loyaltyData={loyaltyData}
      />
    </main>
  );
}
