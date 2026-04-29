import { Suspense } from "react";
import { getCurrentUserSalon } from "@/lib/supabase/salon";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsSuperAdmin } from "@/lib/supabase/admin-auth";
import { redirect } from "next/navigation";
import { isMissingProcessingColumnError } from "@/lib/db/service-schema";
import { Reveal } from "@/components/reveal";
import { DiaryView } from "./diary-view";
import { GapFillerSection } from "./gap-filler-section";
import { TargetsWidget, type TargetWidgetItem } from "./targets-widget";
import { isManagerRole } from "@/lib/dashboard-roles";

export const dynamic = "force-dynamic";

/** Plain JSON for RSC → client props (drops non-serializable values from Supabase). */
function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function DashboardPage() {
  const context = await getCurrentUserSalon();
  if (!context) redirect("/onboarding");

  try {
    return await renderDashboardPage(context);
  } catch (e) {
    console.error("[DashboardPage] render failed", e);
    const msg = e instanceof Error ? e.message : "Something went wrong loading the diary.";
    return (
      <main className="p-4 md:p-6 min-w-0 space-y-4">
        <h1 className="text-xl font-bold">Diary</h1>
        <p className="text-sm text-red-400 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">{msg}</p>
        <p className="text-sm text-muted">
          Try reloading the page. If this keeps happening, check Vercel logs for the same timestamp or run locally with{" "}
          <code className="text-xs">npm run dev</code> to see the full error.
        </p>
      </main>
    );
  }
}

async function renderDashboardPage(context: NonNullable<Awaited<ReturnType<typeof getCurrentUserSalon>>>) {
  const userSb = await createClient();
  const isSuperAdmin = await getIsSuperAdmin();
  const isManager = isManagerRole(isSuperAdmin, context.member.role ?? "");
  /** Super admins may have no salon_members row; RLS would hide salon data. Scope all queries to context.salon.id. */
  const supabase = isSuperAdmin
    ? (() => {
        try {
          return createAdminClient();
        } catch {
          return userSb;
        }
      })()
    : userSb;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Load a wide window so Prev/Next week in the diary still shows appointments (not only "this" week).
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 21);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 77);
  rangeEnd.setHours(0, 0, 0, 0);

  const servicesPromise = (async () => {
    const withColor = await supabase
      .from("services")
      .select("id, name, duration_minutes, processing_time_minutes, color")
      .eq("salon_id", context.salon.id)
      .order("name");
    if (!withColor.error) return withColor;
    const withProcessing = await supabase
      .from("services")
      .select("id, name, duration_minutes, processing_time_minutes")
      .eq("salon_id", context.salon.id)
      .order("name");
    if (!withProcessing.error) return withProcessing;
    if (!isMissingProcessingColumnError(withProcessing.error)) return withProcessing;
    return supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("salon_id", context.salon.id)
      .order("name");
  })();

  const [membersRes, servicesRes, clientsRes, appointmentsRes] = await Promise.all([
    supabase
      .from("salon_members")
      .select("id, display_name, role, avatar_url")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("role", { ascending: false }),
    servicesPromise,
    (async () => {
      const withSkinTest = await supabase
        .from("clients")
        .select("id, name, email, phone, last_skin_test_at")
        .eq("salon_id", context.salon.id)
        .order("name");
      if (!withSkinTest.error) return withSkinTest;
      return supabase
        .from("clients")
        .select("id, name, email, phone")
        .eq("salon_id", context.salon.id)
        .order("name");
    })(),
    (async () => {
      const fullSelect = `
        id, start_time, end_time, status, notes,
        client_id, guest_name, guest_email, guest_phone,
        stylist_id, service_id, send_reminder_sms, send_review_request, send_aftercare,
        deposit_payment_intent_id, before_photo_url, after_photo_url, change_charge_minor,
        clients(name, email, phone),
        services(name, duration_minutes, processing_time_minutes),
        salon_members(display_name),
        appointment_services(sort_order, service_id, services(name, duration_minutes, processing_time_minutes))
      `;
      const minimalSelect = `
        id, start_time, end_time, status, notes,
        client_id, guest_name, guest_email, guest_phone,
        stylist_id, service_id,
        clients(name, email, phone),
        services(name, duration_minutes),
        salon_members(display_name)
      `;
      const query = (sel: string) =>
        supabase
          .from("appointments")
          .select(sel)
          .eq("salon_id", context.salon.id)
          .gte("start_time", rangeStart.toISOString())
          .lt("start_time", rangeEnd.toISOString())
          .order("start_time");

      const full = await query(fullSelect);
      if (!full.error) return full;
      return query(minimalSelect);
    })(),
  ]);

  const members = membersRes.data ?? [];
  const services = (servicesRes.data ?? []).map((s) => {
    const row = s as {
      id: string;
      name: string;
      duration_minutes: number;
      processing_time_minutes?: number | null;
      color?: string | null;
    };
    return {
      id: row.id,
      name: row.name,
      duration_minutes: row.duration_minutes,
      processing_time_minutes: row.processing_time_minutes ?? 0,
      color: row.color ?? null,
    };
  });
  const clients = clientsRes.data ?? [];

  // Load stylist timing overrides (graceful if table doesn't exist yet)
  const stylistOverrides: Record<string, Record<string, number>> = {};
  try {
    const memberIds = members.map((m: { id: string }) => m.id);
    if (memberIds.length > 0) {
      const { data: overridesData } = await supabase
        .from("stylist_service_overrides")
        .select("stylist_id, service_id, custom_duration_minutes")
        .in("stylist_id", memberIds);
      for (const o of overridesData ?? []) {
        const row = o as { stylist_id: string; service_id: string; custom_duration_minutes: number };
        if (!stylistOverrides[row.stylist_id]) stylistOverrides[row.stylist_id] = {};
        stylistOverrides[row.stylist_id][row.service_id] = row.custom_duration_minutes;
      }
    }
  } catch {
    // stylist_service_overrides table may not exist yet
  }

  // Build client prompt data from loaded appointments and client fields
  const clientLastVisit: Record<string, string> = {};
  for (const a of (appointmentsRes.data ?? []) as unknown as { client_id: string | null; start_time: string; status: string }[]) {
    if (!a.client_id || a.status === "canceled") continue;
    if (!clientLastVisit[a.client_id] || a.start_time > clientLastVisit[a.client_id]) {
      clientLastVisit[a.client_id] = a.start_time;
    }
  }

  // Load colour formulas for client prompts (lightweight: just client_id + last formula)
  const clientColourFormula: Record<string, string> = {};
  try {
    const clientIds = clients.map((c: { id: string }) => c.id);
    if (clientIds.length > 0) {
      const { data: formulaRows } = await supabase
        .from("clients")
        .select("id, color_formulas")
        .in("id", clientIds);
      for (const row of formulaRows ?? []) {
        const r = row as { id: string; color_formulas: unknown };
        const formulas = Array.isArray(r.color_formulas) ? r.color_formulas : [];
        if (formulas.length > 0) {
          const last = formulas[formulas.length - 1] as { formula?: string; text?: string; brand?: string };
          const display = last.formula || last.text || (last.brand ? `Brand: ${last.brand}` : "");
          if (display) clientColourFormula[r.id] = display;
        }
      }
    }
  } catch {
    // color_formulas column may not exist
  }

  // Load important client notes for prompts (allergy / skin_test type)
  const clientAlertNotes: Record<string, string[]> = {};
  try {
    const clientIds = clients.map((c: { id: string }) => c.id);
    if (clientIds.length > 0) {
      const { data: noteRows } = await supabase
        .from("client_notes")
        .select("client_id, note, note_type")
        .in("client_id", clientIds)
        .in("note_type", ["allergy", "skin_test"])
        .order("created_at", { ascending: false })
        .limit(200);
      for (const row of noteRows ?? []) {
        const r = row as { client_id: string; note: string; note_type: string };
        if (!clientAlertNotes[r.client_id]) clientAlertNotes[r.client_id] = [];
        clientAlertNotes[r.client_id].push(r.note);
      }
    }
  } catch {
    // client_notes table may not exist yet
  }

  const clientPromptData: Record<string, { lastVisit?: string; lastFormula?: string; alertNotes?: string[] }> = {};
  for (const c of clients) {
    const cid = (c as { id: string }).id;
    const entry: { lastVisit?: string; lastFormula?: string; alertNotes?: string[] } = {};
    if (clientLastVisit[cid]) entry.lastVisit = clientLastVisit[cid];
    if (clientColourFormula[cid]) entry.lastFormula = clientColourFormula[cid];
    if (clientAlertNotes[cid]?.length) entry.alertNotes = clientAlertNotes[cid];
    if (Object.keys(entry).length > 0) clientPromptData[cid] = entry;
  }

  const clientPhotoMap: Record<string, string> = {};
  try {
    const clientIds = clients.map((c: { id: string }) => c.id);
    if (clientIds.length > 0) {
      const { data: clientProfilePhotos } = await supabase
        .from("client_photos")
        .select("client_id, url")
        .in("client_id", clientIds)
        .eq("slot", "profile");
      for (const p of clientProfilePhotos ?? []) {
        clientPhotoMap[(p as { client_id: string; url: string }).client_id] =
          (p as { client_id: string; url: string }).url;
      }
    }
  } catch {
    // client_photos table may not exist yet — gracefully degrade
  }

  type RawApptRow = {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    notes: string | null;
    client_id: string | null;
    guest_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    stylist_id: string;
    service_id: string | null;
    deposit_payment_intent_id?: string | null;
    before_photo_url?: string | null;
    after_photo_url?: string | null;
    send_reminder_sms?: boolean;
    send_review_request?: boolean;
    send_aftercare?: boolean;
    clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
    services: { name: string; duration_minutes: number; processing_time_minutes?: number } | { name: string; duration_minutes: number; processing_time_minutes?: number }[] | null;
    salon_members: { display_name: string | null } | { display_name: string | null }[] | null;
    appointment_services?: {
      sort_order: number;
      service_id: string;
      services: { name: string; duration_minutes: number; processing_time_minutes?: number } | null;
    }[] | null;
  };

  const appointments = ((appointmentsRes.data ?? []) as unknown as RawApptRow[]).map((a) => {
    const lines = Array.isArray(a.appointment_services) ? [...a.appointment_services] : [];
    lines.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
    const ids = lines.map((l) => l.service_id).filter(Boolean);
    const service_line_ids = ids.length > 0 ? ids : a.service_id ? [a.service_id] : [];

    let services = a.services;
    if (lines.length > 1) {
      const names: string[] = [];
      let durSum = 0;
      let procMax = 0;
      for (const l of lines) {
        const svc = l.services;
        if (svc?.name) names.push(svc.name);
        durSum += Number(svc?.duration_minutes) || 0;
        procMax = Math.max(procMax, Number(svc?.processing_time_minutes) || 0);
      }
      services = {
        name: names.join(" · "),
        duration_minutes: durSum,
        processing_time_minutes: procMax,
      };
    } else if (lines.length === 1 && lines[0].services) {
      const svc = lines[0].services;
      services = {
        name: svc.name,
        duration_minutes: Number(svc.duration_minutes) || 60,
        processing_time_minutes: Number(svc.processing_time_minutes) || 0,
      };
    }

    const { appointment_services: _, ...rest } = a;
    return { ...rest, services, service_line_ids };
  }) as {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    notes: string | null;
    client_id: string | null;
    guest_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    stylist_id: string;
    service_id: string | null;
    service_line_ids: string[];
    deposit_payment_intent_id?: string | null;
    before_photo_url?: string | null;
    after_photo_url?: string | null;
    send_reminder_sms?: boolean;
    send_review_request?: boolean;
    send_aftercare?: boolean;
    clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
    services: { name: string; duration_minutes: number; processing_time_minutes?: number } | { name: string; duration_minutes: number; processing_time_minutes?: number }[] | null;
    salon_members: { display_name: string | null } | { display_name: string | null }[] | null;
  }[];

  // --- Targets widget data ---
  const targetWidgetItems: TargetWidgetItem[] = [];
  if (isManager) {
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const { data: activeTargets } = await supabase
        .from("staff_targets")
        .select("member_id, target_type, target_value, period")
        .eq("salon_id", context.salon.id)
        .eq("is_active", true);

      if (activeTargets && activeTargets.length > 0) {
        const [weekSalesRes, monthSalesRes, weekApptsRes, monthApptsRes] = await Promise.all([
          supabase
            .from("sales_transactions")
            .select("amount_minor, salon_members(id)")
            .eq("salon_id", context.salon.id)
            .gte("paid_at", weekStart.toISOString())
            .lt("paid_at", weekEnd.toISOString()),
          supabase
            .from("sales_transactions")
            .select("amount_minor, salon_members(id)")
            .eq("salon_id", context.salon.id)
            .gte("paid_at", monthStart.toISOString())
            .lt("paid_at", monthEnd.toISOString()),
          supabase
            .from("appointments")
            .select("stylist_id")
            .eq("salon_id", context.salon.id)
            .eq("status", "completed")
            .gte("start_time", weekStart.toISOString())
            .lt("start_time", weekEnd.toISOString()),
          supabase
            .from("appointments")
            .select("stylist_id")
            .eq("salon_id", context.salon.id)
            .eq("status", "completed")
            .gte("start_time", monthStart.toISOString())
            .lt("start_time", monthEnd.toISOString()),
        ]);

        type WRow = { amount_minor: number; salon_members: { id: string } | { id: string }[] | null };
        const revByMember = (rows: WRow[], _period: string) => {
          const m: Record<string, number> = {};
          for (const r of rows) {
            const sm = Array.isArray(r.salon_members) ? r.salon_members[0] : r.salon_members;
            if (sm?.id) m[sm.id] = (m[sm.id] ?? 0) + Number(r.amount_minor ?? 0);
          }
          return m;
        };
        const apptByMember = (rows: { stylist_id: string | null }[]) => {
          const m: Record<string, number> = {};
          for (const r of rows) { if (r.stylist_id) m[r.stylist_id] = (m[r.stylist_id] ?? 0) + 1; }
          return m;
        };

        const weekRev = revByMember((weekSalesRes.data ?? []) as WRow[], "weekly");
        const monthRev = revByMember((monthSalesRes.data ?? []) as WRow[], "monthly");
        const weekAppt = apptByMember(weekApptsRes.data ?? []);
        const monthAppt = apptByMember(monthApptsRes.data ?? []);

        const memberNameMap: Record<string, string> = {};
        for (const m of members) {
          memberNameMap[m.id] = m.display_name || "Unnamed";
        }

        for (const t of activeTargets) {
          const isMoney = t.target_type === "revenue" || t.target_type === "retail";
          let current = 0;
          if (isMoney) {
            current = t.period === "weekly" ? (weekRev[t.member_id] ?? 0) : (monthRev[t.member_id] ?? 0);
          } else {
            current = t.period === "weekly" ? (weekAppt[t.member_id] ?? 0) : (monthAppt[t.member_id] ?? 0);
          }
          targetWidgetItems.push({
            memberName: memberNameMap[t.member_id] ?? "Unknown",
            targetType: t.target_type,
            period: t.period,
            current,
            target: t.target_value,
          });
        }
      }
    } catch {
      // staff_targets table may not exist yet
    }
  }

  return (
    <main className="p-4 md:p-6 min-w-0 space-y-6">
      <Reveal>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading diary…</p>}>
          <DiaryView
            salonId={context.salon.id}
            salonName={context.salon.name}
            members={jsonClone(members)}
            services={jsonClone(services)}
            clients={jsonClone(clients)}
            appointments={jsonClone(appointments)}
            clientPhotoMap={jsonClone(clientPhotoMap)}
            stylistOverrides={jsonClone(stylistOverrides)}
            clientPromptData={jsonClone(clientPromptData)}
          />
        </Suspense>
      </Reveal>
      {isManager && targetWidgetItems.length > 0 && (
        <Reveal>
          <TargetsWidget items={targetWidgetItems} />
        </Reveal>
      )}
      <Reveal>
        <GapFillerSection />
      </Reveal>
    </main>
  );
}
