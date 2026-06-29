import { SmartDashboardHeader } from "@/components/smart/dashboard/smart-dashboard-header";
import { MetricCard } from "@/components/smart/dashboard/metric-card";
import { PerformanceChart } from "@/components/smart/dashboard/performance-chart";
import { ActivityFeed } from "@/components/smart/dashboard/activity-feed";
import { PlatformDonut } from "@/components/smart/dashboard/platform-donut";
import { LocationsBarChart } from "@/components/smart/dashboard/locations-bar-chart";
import { SystemStatus } from "@/components/smart/dashboard/system-status";
import {
  fetchDashboardOverview,
  formatMinorAsCurrency,
} from "@core/smart/dashboard-stats";

export default async function SmartOverviewPage() {
  let stats;
  try {
    stats = await fetchDashboardOverview();
  } catch {
    stats = {
      appointmentsToday: 0,
      appointmentsTodayTrend: 0,
      revenueThisMonthMinor: 0,
      revenueTrendPercent: 0,
      locationsCount: 0,
      newLocationsThisWeek: 0,
      platformDistribution: [
        { platform: "salon" as const, label: "SalonSynk", count: 0, percent: 0 },
        { platform: "barber" as const, label: "BarberSynk", count: 0, percent: 0 },
        { platform: "nail" as const, label: "NailSynk", count: 0, percent: 0 },
      ],
      dailyPerformance: [],
      topLocations: [],
      recentActivity: [],
      landingStats: { businesses: 0, appointments: 0, transactions: 0, platforms: 3 },
    };
  }

  const sparkAppts = stats.dailyPerformance.slice(-7).map((d) => d.appointments);
  const sparkRev = stats.dailyPerformance.slice(-7).map((d) => d.revenueMinor);

  return (
    <>
      <SmartDashboardHeader />
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
            trend={`${stats.newLocationsThisWeek} new this week`}
            trendPositive
            accentClass="text-nail"
          />
        </div>

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
          <SystemStatus />
        </div>
      </main>
    </>
  );
}
