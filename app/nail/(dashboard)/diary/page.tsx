import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@core/supabase/server";
import { createAdminClient } from "@core/supabase/admin";
import { getIsSuperAdmin } from "@core/supabase/admin-auth";
import { getCurrentUserNailSalon } from "@modules/nail/lib/shop";
import { memberShowsOnDiary } from "@/lib/show-on-diary";
import { Reveal } from "@/components/reveal";
import { DiaryView } from "./diary-view";

export const dynamic = "force-dynamic";

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function NailDiaryPage() {
  const context = await getCurrentUserNailSalon();
  if (!context) redirect("/nail/login");

  try {
    return await renderDiaryPage(context);
  } catch (e) {
    console.error("[NailDiaryPage] render failed", e);
    const msg = e instanceof Error ? e.message : "Something went wrong loading the diary.";
    return (
      <main className="p-4 md:p-6 min-w-0 space-y-4">
        <h1 className="text-xl font-bold">Diary</h1>
        <p className="text-sm text-red-400 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">{msg}</p>
      </main>
    );
  }
}

async function renderDiaryPage(context: NonNullable<Awaited<ReturnType<typeof getCurrentUserNailSalon>>>) {
  const userSb = await createClient();
  const isSuperAdmin = await getIsSuperAdmin();
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
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 21);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 77);
  rangeEnd.setHours(0, 0, 0, 0);

  const [servicesRes, clientsRes, appointmentsRes, categoriesRes, membersRes] = await Promise.all([
    supabase
      .from("nail_services")
      .select("id, name, duration_minutes, processing_time_minutes, color, category_id, price_minor")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("nail_clients")
      .select("id, name, email, phone, last_skin_test_at")
      .eq("salon_id", context.salon.id)
      .order("name"),
    (async () => {
      const fullSelect = `
        id, start_time, end_time, status, notes,
        client_id, guest_name, guest_email, guest_phone,
        technician_id, service_id,
        deposit_payment_intent_id, bill_total_minor, deposit_amount_minor,
        nail_clients(name, email, phone),
        nail_services(name, duration_minutes, processing_time_minutes, price_minor),
        nail_members(display_name),
        nail_appointment_services(sort_order, service_id, price_override_minor, assigned_technician_id, nail_services(name, duration_minutes, processing_time_minutes, price_minor))
      `;
      const minimalSelect = `
        id, start_time, end_time, status, notes,
        client_id, guest_name, guest_email, guest_phone,
        technician_id, service_id,
        nail_clients(name, email, phone),
        nail_services(name, duration_minutes),
        nail_members(display_name)
      `;
      const query = (sel: string) =>
        supabase
          .from("nail_appointments")
          .select(sel)
          .eq("salon_id", context.salon.id)
          .gte("start_time", rangeStart.toISOString())
          .lt("start_time", rangeEnd.toISOString())
          .order("start_time");

      const full = await query(fullSelect);
      if (!full.error) return full;
      return query(minimalSelect);
    })(),
    supabase
      .from("nail_service_categories")
      .select("id, name, sort_order, color")
      .eq("salon_id", context.salon.id)
      .order("sort_order")
      .order("name"),
    supabase
      .from("nail_members")
      .select("id, display_name, role, avatar_url, show_on_diary")
      .eq("salon_id", context.salon.id)
      .eq("is_active", true)
      .order("role", { ascending: false }),
  ]);

  const allMembers = (membersRes.data ?? []) as {
    id: string;
    display_name: string | null;
    role: string;
    avatar_url?: string | null;
    show_on_diary?: boolean | null;
  }[];
  const membersForDiary = allMembers.filter((m) => memberShowsOnDiary(m));

  const services = (servicesRes.data ?? []).map((s) => {
    const row = s as {
      id: string;
      name: string;
      duration_minutes: number;
      processing_time_minutes?: number | null;
      color?: string | null;
      category_id?: string | null;
      price_minor?: number | null;
    };
    return {
      id: row.id,
      name: row.name,
      duration_minutes: row.duration_minutes,
      processing_time_minutes: row.processing_time_minutes ?? 0,
      color: row.color ?? null,
      category_id: row.category_id ?? null,
      price_minor: row.price_minor != null ? Number(row.price_minor) : null,
    };
  });

  const serviceCategories = (categoriesRes.data ?? []).map((c) => ({
    id: (c as { id: string }).id,
    name: (c as { name: string }).name,
    color: (c as { color?: string | null }).color ?? null,
  }));

  const clients = clientsRes.data ?? [];

  const technicianOverrides: Record<string, Record<string, number>> = {};
  try {
    const memberIds = allMembers.map((m) => m.id);
    if (memberIds.length > 0) {
      const { data: overridesData } = await supabase
        .from("nail_technician_service_overrides")
        .select("technician_id, service_id, duration_minutes")
        .in("technician_id", memberIds);
      for (const o of overridesData ?? []) {
        const row = o as { technician_id: string; service_id: string; duration_minutes: number };
        if (!technicianOverrides[row.technician_id]) technicianOverrides[row.technician_id] = {};
        technicianOverrides[row.technician_id][row.service_id] = row.duration_minutes;
      }
    }
  } catch {
    /* table may not exist yet */
  }

  const clientCompletedCounts: Record<string, number> = {};
  for (const a of (appointmentsRes.data ?? []) as unknown as { client_id: string | null; status: string }[]) {
    if (a.client_id && a.status === "completed") {
      clientCompletedCounts[a.client_id] = (clientCompletedCounts[a.client_id] ?? 0) + 1;
    }
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
    technician_id: string;
    service_id: string | null;
    deposit_payment_intent_id?: string | null;
    bill_total_minor?: number | null;
    deposit_amount_minor?: number | null;
    nail_clients: { name: string | null; email: string | null; phone: string | null } | { name: string | null; email: string | null; phone: string | null }[] | null;
    nail_services: { name: string; duration_minutes: number; processing_time_minutes?: number } | { name: string; duration_minutes: number; processing_time_minutes?: number }[] | null;
    nail_members: { display_name: string | null } | { display_name: string | null }[] | null;
    nail_appointment_services?: {
      sort_order: number;
      service_id: string;
      price_override_minor?: number | null;
      assigned_technician_id?: string | null;
      nail_services: { name: string; duration_minutes: number; processing_time_minutes?: number; price_minor?: number | null } | null;
    }[] | null;
  };

  const appointments = ((appointmentsRes.data ?? []) as unknown as RawApptRow[]).map((a) => {
    const lines = Array.isArray(a.nail_appointment_services) ? [...a.nail_appointment_services] : [];
    lines.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
    const ids = lines.map((l) => l.service_id).filter(Boolean);
    const service_line_ids = ids.length > 0 ? ids : a.service_id ? [a.service_id] : [];

    let servicesBlock = a.nail_services;
    if (lines.length > 1) {
      const names: string[] = [];
      let durSum = 0;
      let procMax = 0;
      for (const l of lines) {
        const svc = l.nail_services;
        if (svc?.name) names.push(svc.name);
        durSum += Number(svc?.duration_minutes) || 0;
        procMax = Math.max(procMax, Number(svc?.processing_time_minutes) || 0);
      }
      servicesBlock = {
        name: names.join(" · "),
        duration_minutes: durSum,
        processing_time_minutes: procMax,
      };
    } else if (lines.length === 1 && lines[0].nail_services) {
      const svc = lines[0].nail_services;
      servicesBlock = {
        name: svc.name,
        duration_minutes: Number(svc.duration_minutes) || 60,
        processing_time_minutes: Number(svc.processing_time_minutes) || 0,
      };
    }

    const service_line_bill = lines.map((l) => ({
      service_id: l.service_id,
      price_override_minor: l.price_override_minor ?? null,
      assigned_technician_id: l.assigned_technician_id ?? null,
    }));

    const { nail_appointment_services: _, nail_services: __, nail_clients: clientsBlock, nail_members: membersBlock, ...rest } = a;
    return {
      ...rest,
      clients: clientsBlock,
      services: servicesBlock,
      nail_members: membersBlock,
      service_line_ids,
      service_line_bill,
    };
  });

  return (
    <Reveal>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading diary…</p>}>
        <DiaryView
          salonId={context.salon.id}
          salonName={context.salon.name}
          members={jsonClone(membersForDiary)}
          services={jsonClone(services)}
          clients={jsonClone(clients)}
          appointments={jsonClone(appointments)}
          technicianOverrides={jsonClone(technicianOverrides)}
          clientCompletedCounts={jsonClone(clientCompletedCounts)}
          categories={jsonClone(serviceCategories)}
        />
      </Suspense>
    </Reveal>
  );
}
