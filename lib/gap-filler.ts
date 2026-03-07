import type { SupabaseClient } from "@supabase/supabase-js";

export type EmptySlot = {
  appointmentId: string;
  serviceId: string;
  serviceName: string;
  startTime: string;
  stylistId: string;
};

export type ClientForSlot = {
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  lastVisitAt: string | null;
};

export type SlotWithCandidates = {
  slot: EmptySlot;
  candidates: ClientForSlot[];
  draftSms: string;
};

const WEEKS_SINCE_VISIT = 4;
const TOP_N_CLIENTS = 5;

/**
 * Find cancelled bookings and for each empty slot get the top 5 clients who
 * previously had that service but haven't visited in 4+ weeks.
 * Returns slots with candidates and a draft SMS for the owner to approve.
 */
export async function findClientsForEmptySlots(
  supabase: SupabaseClient,
  salonId: string
): Promise<SlotWithCandidates[]> {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - WEEKS_SINCE_VISIT * 7);

  const { data: cancelled } = await supabase
    .from("appointments")
    .select("id, service_id, start_time, stylist_id, services(name)")
    .eq("salon_id", salonId)
    .eq("status", "canceled")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(50);

  if (!cancelled?.length) return [];

  const results: SlotWithCandidates[] = [];

  for (const row of cancelled) {
    const serviceId = row.service_id as string | null;
    if (!serviceId) continue;

    const serviceName = (row.services as { name?: string } | null)?.name ?? "a service";
    const slot: EmptySlot = {
      appointmentId: row.id,
      serviceId,
      serviceName,
      startTime: row.start_time as string,
      stylistId: row.stylist_id as string,
    };

    // Clients who had a completed appointment with this service at this salon
    const { data: pastWithService } = await supabase
      .from("appointments")
      .select("client_id")
      .eq("salon_id", salonId)
      .eq("service_id", serviceId)
      .eq("status", "completed")
      .not("client_id", "is", null);

    const clientIds = [...new Set((pastWithService ?? []).map((r) => r.client_id as string).filter(Boolean))];
    if (clientIds.length === 0) {
      results.push({ slot, candidates: [], draftSms: "" });
      continue;
    }

    // For each client get their last appointment end_time at this salon
    const { data: lastVisits } = await supabase
      .from("appointments")
      .select("client_id, end_time")
      .eq("salon_id", salonId)
      .in("client_id", clientIds)
      .order("end_time", { ascending: false });

    const lastByClient = new Map<string, string>();
    for (const r of lastVisits ?? []) {
      const cid = r.client_id as string;
      if (!lastByClient.has(cid)) lastByClient.set(cid, r.end_time as string);
    }

    const lapsedClientIds = clientIds.filter((cid) => {
      const last = lastByClient.get(cid);
      return last ? new Date(last) < fourWeeksAgo : true;
    });

    if (lapsedClientIds.length === 0) {
      results.push({ slot, candidates: [], draftSms: "" });
      continue;
    }

    const sortedByLastVisit = lapsedClientIds
      .map((cid) => ({ clientId: cid, lastVisit: lastByClient.get(cid) ?? null }))
      .sort((a, b) => {
        if (!a.lastVisit) return 1;
        if (!b.lastVisit) return -1;
        return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
      })
      .slice(0, TOP_N_CLIENTS);

    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, phone, email")
      .eq("salon_id", salonId)
      .in("id", sortedByLastVisit.map((c) => c.clientId));

    const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
    const candidates: ClientForSlot[] = sortedByLastVisit.map(({ clientId, lastVisit }) => {
      const c = clientMap.get(clientId);
      return {
        clientId,
        clientName: c?.name ?? null,
        clientPhone: c?.phone ?? null,
        clientEmail: c?.email ?? null,
        lastVisitAt: lastVisit ?? null,
      };
    });

    const slotDate = new Date(slot.startTime);
    const dateStr = slotDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const timeStr = slotDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const draftSms = generateDraftSms(serviceName, dateStr, timeStr);

    results.push({ slot, candidates, draftSms });
  }

  return results;
}

/**
 * Generate a draft SMS for the owner to approve before sending to clients.
 */
function generateDraftSms(serviceName: string, dateStr: string, timeStr: string): string {
  return `Hi! We've had a cancellation and have availability for ${serviceName} on ${dateStr} at ${timeStr}. Would you like to book? Reply to this message or call us.`;
}
