import { NextResponse } from "next/server";
import { csvRow } from "@/lib/csv";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExportContext } from "../_context";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getExportContext();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lines: string[] = [csvRow(["display_name", "role", "employment_type", "active", "account_email"])];

  const { data: members, error } = await ctx.supabase
    .from("salon_members")
    .select("display_name, role, employment_type, is_active, user_id")
    .eq("salon_id", ctx.salonId)
    .order("display_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = [...new Set((members ?? []).map((m) => m.user_id).filter((id): id is string => Boolean(id)))];
  const emailByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: profs } = await admin.from("profiles").select("id, email").in("id", userIds);
      for (const p of profs ?? []) {
        if (p.id && p.email) emailByUserId.set(p.id, p.email);
      }
    } catch {
      // profiles unavailable — leave emails blank
    }
  }

  for (const row of members ?? []) {
    const email = row.user_id ? emailByUserId.get(row.user_id) : undefined;
    lines.push(
      csvRow([
        row.display_name,
        row.role,
        row.employment_type,
        row.is_active === false ? "no" : "yes",
        email,
      ]),
    );
  }

  const body = lines.join("\r\n") + "\r\n";
  const safeName = ctx.salonName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "salon";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="salonsynk-team-${safeName}.csv"`,
    },
  });
}
