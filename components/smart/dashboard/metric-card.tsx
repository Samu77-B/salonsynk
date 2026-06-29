"use client";

import type { DashboardOverviewStats, PlatformId } from "@core/smart/dashboard-stats";

type MetricCardProps = {
  title: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  accentClass: string;
  sparkData?: number[];
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 80}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" className="h-10 w-20" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  trend,
  trendPositive = true,
  accentClass,
  sparkData,
}: MetricCardProps) {
  const colorMap: Record<string, string> = {
    "text-salon": "#2dd4bf",
    "text-barber": "#fbbf24",
    "text-nail": "#f472b6",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted">{title}</p>
      <div className="mt-2 flex items-end justify-between">
        <p className={`font-heading text-3xl font-bold ${accentClass}`}>{value}</p>
        {sparkData && sparkData.length > 0 && (
          <MiniSparkline data={sparkData} color={colorMap[accentClass] ?? "#7eb8da"} />
        )}
      </div>
      {trend && (
        <p className={`mt-2 text-xs ${trendPositive ? "text-emerald-400" : "text-red-400"}`}>
          {trend}
        </p>
      )}
    </div>
  );
}

export type { DashboardOverviewStats, PlatformId };
