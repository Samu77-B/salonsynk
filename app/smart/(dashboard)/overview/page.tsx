import { createClient } from "@/lib/supabase/server";
import { getSmartAccess, tenantIdsByPlatform } from "@core/auth/smart-access";
import { SmartDashboardHeader } from "@/components/smart/dashboard/smart-dashboard-header";
import { MetricCard } from "@/components/smart/dashboard/metric-card";
import { PerformanceChart } from "@/components/smart/dashboard/performance-chart";
import { ActivityFeed } from "@/components/smart/dashboard/activity-feed";
import { PlatformDonut } from "@/components/smart/dashboard/platform-donut";
import { LocationsBarChart } from "@/components/smart/dashboard/locations-bar-chart";
import { SystemStatus } from "@/components/smart/dashboard/system-status";
import { OwnerLocationList } from "@/components/smart/owner/owner-location-list";
import {
  fetchDashboardOverview,
  formatMinorAsCurrency,
  type DashboardOverviewStats,
} from "@core/smart/dashboard-stats";
import { fetchPaysynkOverview, paysynkAvailabilityLabel } from "@core/paysynk/admin-api";
import type { PaysynkResult, PaysynkOverview } from "@core/paysynk/types";

const EMPTY_STATS: DashboardOverviewStats = {
  appointmentsToday: 0,
  appointmentsTodayTrend: 0,
  revenueThisMonthMinor: 0,
  revenueTrendPercent: 0,
  locationsCount: 0,
  newLocationsThisWeek: 0,
  platformDistribution: [
    { platform: "salon", label: "SalonSynk", count: 0, percent: 0 },
    { platform: "barber", label: "BarberSynk", count: 0, percent: 0 },
    { platform: "nail", label: "NailSynk", count: 0, percent: 0 },
  ],
  dailyPerformance: [],
  topLocations: [],
  recentActivity: [],
  landingStats: { businesses: 0, appointments: 0, transactions: 0, platforms: 4 },
};

export default async function SmartOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = user ? await getSmartAccess(user.id) : null;
  const isSuperAdmin = access?.isSuperAdmin ?? false;
  const ownedLocations = access?.ownedLocations ?? [];

  let stats = EMPTY_STATS;
  let paysynk: PaysynkResult<PaysynkOverview> | null = null;
  const [dbStats, pay] = await Promise.all([
    (async () => {
      try {
        return isSuperAdmin
          ? await fetchDashboardOverview()
          : await fetchDashboardOverview(undefined, tenantIdsByPlatform(ownedLocations));
      } catch {
        return EMPTY_STATS;
      }
    })(),
    isSuperAdmin ? fetchPaysynkOverview() : Promise.resolve(null),
  ]);
  stats = dbStats;
  paysynk = pay;

  if (paysynk?.ok) {
    stats = {
      ...stats,
      locationsCount: stats.locationsCount + paysynk.data.stores.total,
      revenueThisMonthMinor: stats.revenueThisMonthMinor + paysynk.data.revenueThisMonthMinor,
    };
  }

  const paysynkStatus = paysynk
    ? paysynk.ok
      ? { status: "Operational" as const, tone: "ok" as const }
      : {
          status: paysynkAvailabilityLabel(paysynk.availability),
          tone: paysynk.availability === "unconfigured" ? ("warn" as const) : ("down" as const),
        }
    : undefined;

  const sparkAppts = stats.dailyPerformance.slice(-7).map((d) => d.appointments);
  const sparkRev = stats.dailyPerformance.slice(-7).map((d) => d.revenueMinor);

  return (
    <>
      <SmartDashboardHeader
        subtitle={
          isSuperAdmin
            ? "Unified dashboard across all platforms and locations"
            : "Your locations across SalonSynk, BarberSynk, NailSynk, and PaySynk"
        }
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            title="Appointments Today"
            value={stats.appointmentsToday.toLocaleString()}
            trend={`${stats.appointmentsTodayTrend >= 0 ? "+" : ""}${stats.appointmentsTodayTrend.toFixed(1)}% vs yesterday`}
            trendPositive={stats.appointmentsTodayTrend >= 0}
            accentClass="text-salon"
            sparkData={sparkAppts}
          />
          <MetricCard
            title="Revenue This Month"
            value={formatMinorAsCurrency(stats.revenueThisMonthMinor)}
            trend={`${stats.revenueTrendPercent >= 0 ? "+" : ""}${stats.revenueTrendPercent.toFixed(1)}% vs last month`}
            trendPositive={stats.revenueTrendPercent >= 0}
            accentClass="text-barber"
            sparkData={sparkRev.map((v) => v / 100)}
          />
          <MetricCard
            title="Locations Synced"
            value={stats.locationsCount.toLocaleString()}
            trend={
              isSuperAdmin
                ? paysynk?.ok
                  ? `${stats.newLocationsThisWeek} new this week · ${paysynk.data.stores.total} PaySynk`
                  : `${stats.newLocationsThisWeek} new this week`
                : `${ownedLocations.length} you own`
            }
            trendPositive
            accentClass="text-nail"
          />
        </div>

        {!isSuperAdmin && ownedLocations.length > 0 && (
          <div className="mt-6">
            <OwnerLocationList locations={ownedLocations} />
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PerformanceChart data={stats.dailyPerformance} />
          </div>
          <ActivityFeed items={stats.recentActivity} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <LocationsBarChart locations={stats.topLocations} />
          <PlatformDonut
            data={stats.platformDistribution}
            total={stats.appointmentsToday}
          />
          {isSuperAdmin ? <SystemStatus paysynk={paysynkStatus} /> : <div className="hidden lg:block" />}
        </div>
      </main>
    </>
  );
}
