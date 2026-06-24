import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { createClient } from "@core/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { NailClientForm } from "../client-form";
import { NailClientDetailView } from "../client-detail-view";
import { NailClientBillingSummary } from "../client-billing-summary";
import { computeBalanceDueMinor } from "@/lib/appointment-billing";

type AptRow = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  service_id?: string | null;
  nail_services?: { name: string } | { name: string }[] | null;
  nail_appointment_services?: { nail_services?: { name: string } | null }[] | null;
};

function serviceLabel(row: AptRow): string {
  const lines = row.nail_appointment_services;
  if (Array.isArray(lines) && lines.length > 0) {
    const names = lines
      .map((l) => {
        const svc = l.nail_services;
        if (Array.isArray(svc)) return svc[0]?.name;
        return svc?.name;
      })
      .filter((n): n is string => Boolean(n));
    if (names.length > 0) return names.join(", ");
  }
  const svc = row.nail_services;
  if (Array.isArray(svc)) return svc[0]?.name ?? "—";
  return svc?.name ?? "—";
}

export default async function NailClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/nail/login");

  const supabase = await createClient();

  const fullSelect = `
    id, name, email, phone, notes, patch_test_due_at, last_skin_test_at
  `;

  const { data: client, error: clientErr } = await supabase
    .from("nail_clients")
    .select(fullSelect)
    .eq("id", id)
    .eq("salon_id", context.salon.id)
    .single();

  if (clientErr || !client) notFound();

  const aptSelectFull = `
    id, start_time, end_time, status, service_id,
    nail_services(name),
    nail_appointment_services(nail_services(name))
  `;
  const aptSelectMinimal = `
    id, start_time, end_time, status, service_id,
    nail_services(name)
  `;

  let appointmentsRaw: AptRow[] = [];
  const aptFull = await supabase
    .from("nail_appointments")
    .select(aptSelectFull)
    .eq("client_id", id)
    .order("start_time", { ascending: false })
    .limit(50);
  if (!aptFull.error) {
    appointmentsRaw = (aptFull.data ?? []) as unknown as AptRow[];
  } else {
    const aptMin = await supabase
      .from("nail_appointments")
      .select(aptSelectMinimal)
      .eq("client_id", id)
      .order("start_time", { ascending: false })
      .limit(50);
    appointmentsRaw = (aptMin.data ?? []) as unknown as AptRow[];
  }

  const appointments = appointmentsRaw.map((a) => ({
    id: a.id,
    start_time: a.start_time,
    end_time: a.end_time,
    status: a.status,
    serviceLabel: serviceLabel(a),
  }));

  const { data: saleRows } = await supabase
    .from("nail_sales_transactions")
    .select("amount_minor, paid_at, service_ids")
    .eq("salon_id", context.salon.id)
    .eq("client_id", id)
    .order("paid_at", { ascending: false })
    .limit(100);

  const { data: billingAppts } = await supabase
    .from("nail_appointments")
    .select("id, status, bill_total_minor, deposit_amount_minor, nail_services(price_minor)")
    .eq("client_id", id)
    .in("status", ["scheduled", "completed"]);

  const totalDepositsMinor = (billingAppts ?? []).reduce(
    (sum, row) => sum + Number((row as { deposit_amount_minor?: number | null }).deposit_amount_minor ?? 0),
    0
  );

  const totalPaidMinor = (saleRows ?? []).reduce((sum, r) => sum + Number(r.amount_minor ?? 0), 0);

  let expectedBillMinor = 0;
  for (const row of billingAppts ?? []) {
    const r = row as {
      status: string;
      bill_total_minor?: number | null;
      nail_services?: { price_minor?: number | null } | { price_minor?: number | null }[] | null;
    };
    if (r.status !== "scheduled") continue;
    const svc = Array.isArray(r.nail_services) ? r.nail_services[0] : r.nail_services;
    const fallback = Number(svc?.price_minor ?? 0);
    expectedBillMinor += Number(r.bill_total_minor ?? fallback);
  }

  const balanceDueMinor = computeBalanceDueMinor({
    billTotalMinor: expectedBillMinor,
    depositAmountMinor: totalDepositsMinor,
    paidSalesMinor: totalPaidMinor,
  });

  const allServiceIds = new Set<string>();
  for (const r of saleRows ?? []) {
    for (const s of r.service_ids ?? []) {
      if (s) allServiceIds.add(s);
    }
  }

  const svcRes =
    allServiceIds.size > 0
      ? await supabase
          .from("nail_services")
          .select("id, name")
          .eq("salon_id", context.salon.id)
          .in("id", [...allServiceIds])
      : { data: [] as { id: string; name: string }[] };

  const serviceNameById = Object.fromEntries((svcRes.data ?? []).map((s) => [s.id, s.name ?? ""]));

  const salesHistory = (saleRows ?? []).map((r) => ({
    paidAt: r.paid_at,
    amountMinor: Number(r.amount_minor ?? 0),
    serviceLabels: (r.service_ids ?? []).map((i: string) => serviceNameById[i] || "").filter(Boolean),
  }));

  const patchDue = client.patch_test_due_at ? new Date(client.patch_test_due_at) : null;
  const now = new Date();
  const daysUntilPatch = patchDue
    ? Math.ceil((patchDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link href="/nail/clients" className="text-sm text-muted hover:text-foreground mb-4 inline-block">
        Back to clients
      </Link>
      <h1 className="text-2xl font-bold leading-tight mb-6">
        {client.name || client.email || client.phone || "Client"}
      </h1>
      {(client.email || client.phone) && (
        <p className="text-sm text-muted truncate mb-6">
          {[client.email, client.phone].filter(Boolean).join(" · ")}
        </p>
      )}

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
          <p className="text-xs text-muted mt-1">Due: {patchDue?.toLocaleDateString("en-GB")}</p>
        </div>
      )}

      <NailClientBillingSummary
        totalDepositsMinor={totalDepositsMinor}
        totalPaidMinor={totalPaidMinor}
        balanceDueMinor={balanceDueMinor}
      />

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Details</h2>
        <NailClientForm
          salonId={context.salon.id}
          clientId={client.id}
          initial={{
            name: client.name ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            notes: client.notes ?? "",
          }}
        />
      </section>

      <NailClientDetailView
        clientId={client.id}
        appointments={appointments}
        sales={salesHistory}
        onPatchTestDueAt={client.patch_test_due_at}
        onLastSkinTestAt={client.last_skin_test_at ?? null}
      />
    </div>
  );
}
