import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
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
    color_formulas: unknown;
    patch_test_due_at: string | null;
  };

  const supabase = await createClient();
  const fullQ = await supabase
    .from("clients")
    .select("id, name, email, phone, notes, sex, color_formulas, patch_test_due_at")
    .eq("id", id)
    .eq("salon_id", context.salon.id)
    .single();
  const client: ClientRow | null = fullQ.error
    ? (await supabase.from("clients").select("id, name, email, phone, notes, color_formulas, patch_test_due_at").eq("id", id).eq("salon_id", context.salon.id).single()).data as ClientRow | null
    : fullQ.data as ClientRow | null;

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

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, services(name)")
    .eq("client_id", id)
    .order("start_time", { ascending: false })
    .limit(50);

  const formulas = (client.color_formulas as { text?: string; image_url?: string }[] | null) ?? [];
  const patchDue = client.patch_test_due_at ? new Date(client.patch_test_due_at) : null;
  const now = new Date();
  const daysUntilPatch = patchDue
    ? Math.ceil((patchDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const profilePhoto = clientPhotos.find((p) => p.slot === "profile");
  const avatarSrc = profilePhoto
    ? profilePhoto.url
    : client.sex === "male"
      ? "/imgs/His.png"
      : "/imgs/Her.png";

  return (
    <main className="p-4 md:p-6 max-w-3xl min-w-0">
      <Link href="/clients" className="text-sm text-muted hover:text-foreground mb-4 inline-block">
        Back to clients
      </Link>
      <div className="flex items-center gap-4 mb-6">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-border bg-background/50">
          <img
            src={avatarSrc}
            alt={client.name || "Client"}
            className={`h-full w-full object-cover ${profilePhoto ? "" : "opacity-40"}`}
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
          }}
        />
      </section>

      <ClientDetailView
        clientId={client.id}
        formulas={formulas}
        appointments={appointments ?? []}
        onPatchTestDueAt={client.patch_test_due_at}
      />
    </main>
  );
}
