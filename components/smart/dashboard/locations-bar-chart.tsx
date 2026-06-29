"use client";

import type { PlatformId } from "@core/smart/dashboard-stats";

type LocationsBarChartProps = {
  locations: {
    name: string;
    platform: PlatformId;
    revenueMinor: number;
  }[];
};

const COLORS: Record<PlatformId, string> = {
  salon: "#2dd4bf",
  barber: "#fbbf24",
  nail: "#f472b6",
};

export function LocationsBarChart({ locations }: LocationsBarChartProps) {
  const max = Math.max(...locations.map((l) => l.revenueMinor), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-semibold">Top Locations by Revenue</h3>
      <ul className="mt-4 space-y-3">
        {locations.length === 0 ? (
          <li className="text-sm text-muted">No revenue data yet</li>
        ) : (
          locations.map((loc) => (
            <li key={`${loc.platform}-${loc.name}`}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="truncate">{loc.name}</span>
                <span className="text-muted shrink-0 ml-2">
                  £{(loc.revenueMinor / 100).toLocaleString("en-GB")}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(loc.revenueMinor / max) * 100}%`,
                    backgroundColor: COLORS[loc.platform],
                  }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
