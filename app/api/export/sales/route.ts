import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import { getExportContext } from "../_context";

export const dynamic = "force-dynamic";

function relOne<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export async function GET() {
  const ctx = await getExportContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lines: string[] = [
    csvRow([
      "paid_at",
      "amount_gbp",
      "currency",
      "client_email",
      "client_name",
      "stylist",
      "service_ids",
      "product_ids",
      "employment_type",
    ]),
  ];

  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await ctx.supabase
      .from("sales_transactions")
      .select(
        `
        paid_at,
        amount_minor,
        currency,
        service_ids,
        product_ids,
        employment_type,
        clients (name, email),
        salon_members (display_name)
      `,
      )
      .eq("salon_id", ctx.salonId)
      .order("paid_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const batch = data ?? [];
    for (const row of batch) {
      const r = row as {
        paid_at: string;
        amount_minor: number;
        currency: string | null;
        service_ids: string[] | null;
        product_ids: string[] | null;
        employment_type: string | null;
        clients: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null;
        salon_members:
          | { display_name: string | null }
          | { display_name: string | null }[]
          | null;
      };
      const minor = Number(r.amount_minor ?? 0);
      const gbp = (minor / 100).toFixed(2);
      const client = relOne(r.clients);
      const stylist = relOne(r.salon_members);
      lines.push(
        csvRow([
          r.paid_at,
          gbp,
          r.currency ?? "gbp",
          client?.email,
          client?.name,
          stylist?.display_name,
          (r.service_ids ?? []).join(";"),
          (r.product_ids ?? []).join(";"),
          r.employment_type,
        ]),
      );
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  const body = lines.join("\r\n") + "\r\n";
  const safeName = ctx.salonName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "salon";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="salonsynk-sales-${safeName}.csv"`,
    },
  });
}
