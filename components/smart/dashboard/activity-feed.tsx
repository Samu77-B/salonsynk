"use client";

import type { PlatformId } from "@core/smart/dashboard-stats";

type ActivityFeedProps = {
  items: {
    id: string;
    type: string;
    platform: PlatformId;
    message: string;
    ago: string;
  }[];
};

const PLATFORM_LABELS: Record<PlatformId, string> = {
  salon: "SalonSynk",
  barber: "BarberSynk",
  nail: "NailSynk",
};

const PLATFORM_COLORS: Record<PlatformId, string> = {
  salon: "#2dd4bf",
  barber: "#fbbf24",
  nail: "#f472b6",
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold">Real-Time Activity</h3>
        <button type="button" className="text-xs text-accent hover:underline">
          View all
        </button>
      </div>
      <ul className="space-y-4 max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <li className="text-sm text-muted">No recent activity</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex gap-3 border-l-2 pl-3" style={{ borderColor: PLATFORM_COLORS[item.platform] }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{item.message}</p>
                <p className="mt-0.5 text-xs text-muted">
                  <span style={{ color: PLATFORM_COLORS[item.platform] }}>
                    {PLATFORM_LABELS[item.platform]}
                  </span>
                  {" · "}
                  {item.ago}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
