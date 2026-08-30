import { createAdminClient } from "@/lib/supabase/admin";

export type DateRange = {
  from: Date;
  to: Date;
};

export type PlatformId = "salon" | "barber" | "nail";

export type DashboardOverviewStats = {
  appointmentsToday: number;
  appointmentsTodayTrend: number;
  revenueThisMonthMinor: number;
  revenueTrendPercent: number;
  locationsCount: number;
  newLocationsThisWeek: number;
  platformDistribution: {
    platform: PlatformId;
    label: string;
    count: number;
    percent: number;
  }[];
  dailyPerformance: {
    date: string;
    appointments: number;
    revenueMinor: number;
    newClients: number;
  }[];
  topLocations: {
    name: string;
    platform: PlatformId;
    revenueMinor: number;
  }[];
  recentActivity: {
    id: string;
    type: string;
    platform: PlatformId;
    message: string;
    timestamp: string;
    ago: string;
  }[];
  landingStats: {
    businesses: number;
    appointments: number;
    transactions: number;
    platforms: number;
  };
};

function startOfDay(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function endOfDay(d: Date): string {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

function startOfMonth(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function eachDay(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export type TenantScope = {
  salonIds: string[];
  shopIds: string[];
  nailSalonIds: string[];
};

type CountFilter = {
  column: string;
  gte?: string;
  lte?: string;
  eq?: string;
  in?: string[];
};

async function safeCount(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  filters?: CountFilter[]
): Promise<number> {
  for (const f of filters ?? []) {
    if (f.in && f.in.length === 0) return 0;
  }
  let q = admin.from(table).select("*", { count: "exact", head: true });
  for (const f of filters ?? []) {
    if (f.gte) q = q.gte(f.column, f.gte);
    if (f.lte) q = q.lte(f.column, f.lte);
    if (f.eq) q = q.eq(f.column, f.eq);
    if (f.in) q = q.in(f.column, f.in);
  }
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

async function sumAmountMinor(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  dateColumn: string,
  from: string,
  to: string,
  idColumn: string,
  nameTable: string,
  tenantIds?: string[]
): Promise<{ total: number; byLocation: Map<string, { name: string; amount: number }> }> {
  if (tenantIds && tenantIds.length === 0) return { total: 0, byLocation: new Map() };

  let q = admin.from(table).select("*").gte(dateColumn, from).lte(dateColumn, to);
  if (tenantIds) q = q.in(idColumn, tenantIds);
  const { data, error } = await q;

  if (error || !data) return { total: 0, byLocation: new Map() };

  const byLocation = new Map<string, number>();
  let total = 0;
  for (const row of data as Record<string, unknown>[]) {
    const amt = Number(row.amount_minor) || 0;
    total += amt;
    const locId = String(row[idColumn] ?? "");
    if (locId) {
      byLocation.set(locId, (byLocation.get(locId) ?? 0) + amt);
    }
  }

  const ids = [...byLocation.keys()];
  const nameMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: names } = await admin.from(nameTable).select("id, name").in("id", ids);
    for (const n of names ?? []) {
      nameMap.set(n.id, n.name);
    }
  }

  const byLocationNamed = new Map<string, { name: string; amount: number }>();
  for (const [id, amount] of byLocation) {
    byLocationNamed.set(id, { name: nameMap.get(id) ?? "Unknown", amount });
  }

  return { total, byLocation: byLocationNamed };
}

export async function fetchLandingStats() {
  const admin = createAdminClient();
  const [salons, barbers, nails, salonAppts, barberAppts, nailAppts, salonTx, barberTx, nailTx] =
    await Promise.all([
      safeCount(admin, "salons"),
      safeCount(admin, "barber_shops"),
      safeCount(admin, "nail_salons"),
      safeCount(admin, "appointments"),
      safeCount(admin, "barber_appointments"),
      safeCount(admin, "nail_appointments"),
      safeCount(admin, "sales_transactions"),
      safeCount(admin, "barber_sales_transactions"),
      safeCount(admin, "nail_sales_transactions"),
    ]);

  return {
    businesses: salons + barbers + nails,
    appointments: salonAppts + barberAppts + nailAppts,
    transactions: salonTx + barberTx + nailTx,
    platforms: 4,
  };
}

export async function fetchDashboardOverview(
  range: DateRange = {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  },
  scope?: TenantScope
): Promise<DashboardOverviewStats> {
  const admin = createAdminClient();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const yesterdayStart = startOfDay(yesterday);
  const yesterdayEnd = endOfDay(yesterday);

  const monthStart = startOfMonth(today);
  const lastMonthStart = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999).toISOString();

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const salonIds = scope?.salonIds;
  const shopIds = scope?.shopIds;
  const nailIds = scope?.nailSalonIds;
  const scoped = Boolean(scope);

  const [
    salonToday,
    barberToday,
    nailToday,
    salonYesterday,
    barberYesterday,
    nailYesterday,
    salonsCount,
    barbersCount,
    nailsCount,
    newSalonsWeek,
    newBarbersWeek,
    newNailsWeek,
    salonMonthRev,
    barberMonthRev,
    nailMonthRev,
    salonLastMonthRev,
    barberLastMonthRev,
    nailLastMonthRev,
    landingStats,
  ] = await Promise.all([
    safeCount(admin, "appointments", [
      { column: "start_time", gte: todayStart, lte: todayEnd },
      ...(salonIds ? [{ column: "salon_id", in: salonIds }] : []),
    ]),
    safeCount(admin, "barber_appointments", [
      { column: "start_time", gte: todayStart, lte: todayEnd },
      ...(shopIds ? [{ column: "shop_id", in: shopIds }] : []),
    ]),
    safeCount(admin, "nail_appointments", [
      { column: "start_time", gte: todayStart, lte: todayEnd },
      ...(nailIds ? [{ column: "salon_id", in: nailIds }] : []),
    ]),
    safeCount(admin, "appointments", [
      { column: "start_time", gte: yesterdayStart, lte: yesterdayEnd },
      ...(salonIds ? [{ column: "salon_id", in: salonIds }] : []),
    ]),
    safeCount(admin, "barber_appointments", [
      { column: "start_time", gte: yesterdayStart, lte: yesterdayEnd },
      ...(shopIds ? [{ column: "shop_id", in: shopIds }] : []),
    ]),
    safeCount(admin, "nail_appointments", [
      { column: "start_time", gte: yesterdayStart, lte: yesterdayEnd },
      ...(nailIds ? [{ column: "salon_id", in: nailIds }] : []),
    ]),
    scoped ? Promise.resolve(salonIds?.length ?? 0) : safeCount(admin, "salons"),
    scoped ? Promise.resolve(shopIds?.length ?? 0) : safeCount(admin, "barber_shops"),
    scoped ? Promise.resolve(nailIds?.length ?? 0) : safeCount(admin, "nail_salons"),
    safeCount(admin, "salons", [
      { column: "created_at", gte: weekAgo.toISOString() },
      ...(salonIds ? [{ column: "id", in: salonIds }] : []),
    ]),
    safeCount(admin, "barber_shops", [
      { column: "created_at", gte: weekAgo.toISOString() },
      ...(shopIds ? [{ column: "id", in: shopIds }] : []),
    ]),
    safeCount(admin, "nail_salons", [
      { column: "created_at", gte: weekAgo.toISOString() },
      ...(nailIds ? [{ column: "id", in: nailIds }] : []),
    ]),
    sumAmountMinor(
      admin,
      "sales_transactions",
      "paid_at",
      monthStart,
      todayEnd,
      "salon_id",
      "salons",
      salonIds
    ),
    sumAmountMinor(
      admin,
      "barber_sales_transactions",
      "paid_at",
      monthStart,
      todayEnd,
      "shop_id",
      "barber_shops",
      shopIds
    ),
    sumAmountMinor(
      admin,
      "nail_sales_transactions",
      "paid_at",
      monthStart,
      todayEnd,
      "salon_id",
      "nail_salons",
      nailIds
    ),
    sumAmountMinor(
      admin,
      "sales_transactions",
      "paid_at",
      lastMonthStart,
      lastMonthEnd,
      "salon_id",
      "salons",
      salonIds
    ),
    sumAmountMinor(
      admin,
      "barber_sales_transactions",
      "paid_at",
      lastMonthStart,
      lastMonthEnd,
      "shop_id",
      "barber_shops",
      shopIds
    ),
    sumAmountMinor(
      admin,
      "nail_sales_transactions",
      "paid_at",
      lastMonthStart,
      lastMonthEnd,
      "salon_id",
      "nail_salons",
      nailIds
    ),
    scoped
      ? Promise.resolve({
          businesses: (salonIds?.length ?? 0) + (shopIds?.length ?? 0) + (nailIds?.length ?? 0),
          appointments: 0,
          transactions: 0,
          platforms: 4,
        })
      : fetchLandingStats(),
  ]);

  const appointmentsToday = salonToday + barberToday + nailToday;
  const appointmentsYesterday = salonYesterday + barberYesterday + nailYesterday;
  const appointmentsTodayTrend =
    appointmentsYesterday > 0
      ? ((appointmentsToday - appointmentsYesterday) / appointmentsYesterday) * 100
      : appointmentsToday > 0
        ? 100
        : 0;

  const revenueThisMonthMinor =
    salonMonthRev.total + barberMonthRev.total + nailMonthRev.total;
  const revenueLastMonthMinor =
    salonLastMonthRev.total + barberLastMonthRev.total + nailLastMonthRev.total;
  const revenueTrendPercent =
    revenueLastMonthMinor > 0
      ? ((revenueThisMonthMinor - revenueLastMonthMinor) / revenueLastMonthMinor) * 100
      : revenueThisMonthMinor > 0
        ? 100
        : 0;

  const totalApptsForDist = appointmentsToday || 1;
  const platformDistribution = [
    {
      platform: "salon" as PlatformId,
      label: "SalonSynk",
      count: salonToday,
      percent: Math.round((salonToday / totalApptsForDist) * 100),
    },
    {
      platform: "barber" as PlatformId,
      label: "BarberSynk",
      count: barberToday,
      percent: Math.round((barberToday / totalApptsForDist) * 100),
    },
    {
      platform: "nail" as PlatformId,
      label: "NailSynk",
      count: nailToday,
      percent: Math.round((nailToday / totalApptsForDist) * 100),
    },
  ];

  const rangeFrom = startOfDay(range.from);
  const rangeTo = endOfDay(range.to);
  const days = eachDay(range.from, range.to);

  const emptyRows = Promise.resolve({ data: [] as Record<string, unknown>[] });

  const [salonApptsRange, barberApptsRange, nailApptsRange] = await Promise.all([
    salonIds && salonIds.length === 0
      ? emptyRows
      : (() => {
          let q = admin
            .from("appointments")
            .select("start_time")
            .gte("start_time", rangeFrom)
            .lte("start_time", rangeTo);
          if (salonIds) q = q.in("salon_id", salonIds);
          return q;
        })(),
    shopIds && shopIds.length === 0
      ? emptyRows
      : (() => {
          let q = admin
            .from("barber_appointments")
            .select("start_time")
            .gte("start_time", rangeFrom)
            .lte("start_time", rangeTo);
          if (shopIds) q = q.in("shop_id", shopIds);
          return q;
        })(),
    nailIds && nailIds.length === 0
      ? emptyRows
      : (() => {
          let q = admin
            .from("nail_appointments")
            .select("start_time")
            .gte("start_time", rangeFrom)
            .lte("start_time", rangeTo);
          if (nailIds) q = q.in("salon_id", nailIds);
          return q;
        })(),
  ]);

  const apptsByDay = new Map<string, number>();
  for (const d of days) apptsByDay.set(d, 0);
  for (const rows of [salonApptsRange.data, barberApptsRange.data, nailApptsRange.data]) {
    for (const row of rows ?? []) {
      const day = (row as { start_time: string }).start_time.slice(0, 10);
      apptsByDay.set(day, (apptsByDay.get(day) ?? 0) + 1);
    }
  }

  const [salonRevRange, barberRevRange, nailRevRange] = await Promise.all([
    salonIds && salonIds.length === 0
      ? emptyRows
      : (() => {
          let q = admin
            .from("sales_transactions")
            .select("paid_at, amount_minor")
            .gte("paid_at", rangeFrom)
            .lte("paid_at", rangeTo);
          if (salonIds) q = q.in("salon_id", salonIds);
          return q;
        })(),
    shopIds && shopIds.length === 0
      ? emptyRows
      : (() => {
          let q = admin
            .from("barber_sales_transactions")
            .select("paid_at, amount_minor")
            .gte("paid_at", rangeFrom)
            .lte("paid_at", rangeTo);
          if (shopIds) q = q.in("shop_id", shopIds);
          return q;
        })(),
    nailIds && nailIds.length === 0
      ? emptyRows
      : (() => {
          let q = admin
            .from("nail_sales_transactions")
            .select("paid_at, amount_minor")
            .gte("paid_at", rangeFrom)
            .lte("paid_at", rangeTo);
          if (nailIds) q = q.in("salon_id", nailIds);
          return q;
        })(),
  ]);

  const revByDay = new Map<string, number>();
  for (const d of days) revByDay.set(d, 0);
  for (const rows of [salonRevRange.data, barberRevRange.data, nailRevRange.data]) {
    for (const row of rows ?? []) {
      const r = row as { paid_at: string; amount_minor: number };
      const day = r.paid_at.slice(0, 10);
      revByDay.set(day, (revByDay.get(day) ?? 0) + (Number(r.amount_minor) || 0));
    }
  }

  const dailyPerformance = days.map((date) => ({
    date,
    appointments: apptsByDay.get(date) ?? 0,
    revenueMinor: revByDay.get(date) ?? 0,
    newClients: 0,
  }));

  type LocEntry = { name: string; platform: PlatformId; revenueMinor: number };
  const allLocations: LocEntry[] = [];
  for (const [, v] of salonMonthRev.byLocation) {
    allLocations.push({ name: v.name, platform: "salon", revenueMinor: v.amount });
  }
  for (const [, v] of barberMonthRev.byLocation) {
    allLocations.push({ name: v.name, platform: "barber", revenueMinor: v.amount });
  }
  for (const [, v] of nailMonthRev.byLocation) {
    allLocations.push({ name: v.name, platform: "nail", revenueMinor: v.amount });
  }
  allLocations.sort((a, b) => b.revenueMinor - a.revenueMinor);
  const topLocations = allLocations.slice(0, 5);

  const [recentSalonAppts, recentBarberAppts, recentNailAppts, recentSalonTx, recentBarberTx, recentNailTx] =
    await Promise.all([
      salonIds && salonIds.length === 0
        ? emptyRows
        : (() => {
            let q = admin
              .from("appointments")
              .select("id, created_at, guest_name, status")
              .order("created_at", { ascending: false })
              .limit(8);
            if (salonIds) q = q.in("salon_id", salonIds);
            return q;
          })(),
      shopIds && shopIds.length === 0
        ? emptyRows
        : (() => {
            let q = admin
              .from("barber_appointments")
              .select("id, created_at, guest_name, status")
              .order("created_at", { ascending: false })
              .limit(8);
            if (shopIds) q = q.in("shop_id", shopIds);
            return q;
          })(),
      nailIds && nailIds.length === 0
        ? emptyRows
        : (() => {
            let q = admin
              .from("nail_appointments")
              .select("id, created_at, guest_name, status")
              .order("created_at", { ascending: false })
              .limit(8);
            if (nailIds) q = q.in("salon_id", nailIds);
            return q;
          })(),
      salonIds && salonIds.length === 0
        ? emptyRows
        : (() => {
            let q = admin
              .from("sales_transactions")
              .select("id, paid_at, amount_minor")
              .order("paid_at", { ascending: false })
              .limit(5);
            if (salonIds) q = q.in("salon_id", salonIds);
            return q;
          })(),
      shopIds && shopIds.length === 0
        ? emptyRows
        : (() => {
            let q = admin
              .from("barber_sales_transactions")
              .select("id, paid_at, amount_minor")
              .order("paid_at", { ascending: false })
              .limit(5);
            if (shopIds) q = q.in("shop_id", shopIds);
            return q;
          })(),
      nailIds && nailIds.length === 0
        ? emptyRows
        : (() => {
            let q = admin
              .from("nail_sales_transactions")
              .select("id, paid_at, amount_minor")
              .order("paid_at", { ascending: false })
              .limit(5);
            if (nailIds) q = q.in("salon_id", nailIds);
            return q;
          })(),
    ]);

  type ActivityItem = DashboardOverviewStats["recentActivity"][number];
  const activity: ActivityItem[] = [];

  for (const row of recentSalonAppts.data ?? []) {
    const r = row as { id: string; created_at: string; guest_name: string | null; status: string };
    activity.push({
      id: r.id,
      type: "appointment",
      platform: "salon",
      message: `New appointment booked${r.guest_name ? ` — ${r.guest_name}` : ""}`,
      timestamp: r.created_at,
      ago: formatAgo(r.created_at),
    });
  }
  for (const row of recentBarberAppts.data ?? []) {
    const r = row as { id: string; created_at: string; guest_name: string | null; status: string };
    activity.push({
      id: r.id,
      type: "appointment",
      platform: "barber",
      message: `New appointment booked${r.guest_name ? ` — ${r.guest_name}` : ""}`,
      timestamp: r.created_at,
      ago: formatAgo(r.created_at),
    });
  }
  for (const row of recentNailAppts.data ?? []) {
    const r = row as { id: string; created_at: string; guest_name: string | null; status: string };
    activity.push({
      id: r.id,
      type: "appointment",
      platform: "nail",
      message: `New appointment booked${r.guest_name ? ` — ${r.guest_name}` : ""}`,
      timestamp: r.created_at,
      ago: formatAgo(r.created_at),
    });
  }
  for (const row of recentSalonTx.data ?? []) {
    const r = row as { id: string; paid_at: string; amount_minor: number };
    activity.push({
      id: r.id,
      type: "payment",
      platform: "salon",
      message: `Payment received — £${(r.amount_minor / 100).toFixed(2)}`,
      timestamp: r.paid_at,
      ago: formatAgo(r.paid_at),
    });
  }
  for (const row of recentBarberTx.data ?? []) {
    const r = row as { id: string; paid_at: string; amount_minor: number };
    activity.push({
      id: r.id,
      type: "payment",
      platform: "barber",
      message: `Payment received — £${(r.amount_minor / 100).toFixed(2)}`,
      timestamp: r.paid_at,
      ago: formatAgo(r.paid_at),
    });
  }
  for (const row of recentNailTx.data ?? []) {
    const r = row as { id: string; paid_at: string; amount_minor: number };
    activity.push({
      id: r.id,
      type: "payment",
      platform: "nail",
      message: `Payment received — £${(r.amount_minor / 100).toFixed(2)}`,
      timestamp: r.paid_at,
      ago: formatAgo(r.paid_at),
    });
  }

  activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    appointmentsToday,
    appointmentsTodayTrend,
    revenueThisMonthMinor,
    revenueTrendPercent,
    locationsCount: salonsCount + barbersCount + nailsCount,
    newLocationsThisWeek: newSalonsWeek + newBarbersWeek + newNailsWeek,
    platformDistribution,
    dailyPerformance,
    topLocations,
    recentActivity: activity.slice(0, 20),
    landingStats,
  };
}

export function formatMinorAsCurrency(minor: number): string {
  if (minor >= 100000) {
    return `£${Math.round(minor / 100000)}K`;
  }
  return `£${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
