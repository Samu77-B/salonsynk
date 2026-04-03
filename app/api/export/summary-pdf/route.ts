import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { getExportContext } from "../_context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_DAYS = 90;

export async function GET() {
  const ctx = await getExportContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const [clientsC, teamC, salesAgg] = await Promise.all([
    ctx.supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", ctx.salonId),
    ctx.supabase
      .from("salon_members")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", ctx.salonId)
      .eq("is_active", true),
    ctx.supabase
      .from("sales_transactions")
      .select("amount_minor")
      .eq("salon_id", ctx.salonId)
      .gte("paid_at", sinceIso),
  ]);

  const clientCount = clientsC.count ?? 0;
  const teamCount = teamC.count ?? 0;
  const salesRows = salesAgg.data ?? [];
  const salesTxCount = salesRows.length;
  const salesTotalMinor = salesRows.reduce((acc, r) => acc + Number((r as { amount_minor: number }).amount_minor ?? 0), 0);
  const salesGbp = (salesTotalMinor / 100).toFixed(2);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SalonSynk data summary", margin, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Salon: ${ctx.salonName}`, margin, y);
  y += 6;
  doc.text(`Generated: ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`, margin, y);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text(`Rolling ${WINDOW_DAYS} days (sales) · static counts (clients & team)`, margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`Clients on file: ${clientCount}`, margin, y);
  y += 6;
  doc.text(`Active team members: ${teamCount}`, margin, y);
  y += 6;
  doc.text(`Sales transactions (${WINDOW_DAYS}d): ${salesTxCount}`, margin, y);
  y += 6;
  doc.text(`Sales total (${WINDOW_DAYS}d): £${salesGbp}`, margin, y);
  y += 12;
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("For full rows use CSV exports from the Reports page.", margin, y);

  const safeName = ctx.salonName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "salon";
  const buf = doc.output("arraybuffer");

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="salonsynk-summary-${safeName}.pdf"`,
    },
  });
}
