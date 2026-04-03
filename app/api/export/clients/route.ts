import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import { getExportContext } from "../_context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getExportContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lines: string[] = [csvRow(["name", "email", "phone", "marketing_opt_in", "notes", "created_at"])];

  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await ctx.supabase
      .from("clients")
      .select("name, email, phone, marketing_opt_in, notes, created_at")
      .eq("salon_id", ctx.salonId)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const batch = data ?? [];
    for (const row of batch) {
      lines.push(
        csvRow([
          row.name,
          row.email,
          row.phone,
          row.marketing_opt_in === false ? "no" : "yes",
          row.notes,
          row.created_at,
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
      "Content-Disposition": `attachment; filename="salonsynk-clients-${safeName}.csv"`,
    },
  });
}
