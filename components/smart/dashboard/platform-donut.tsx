"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { PlatformId } from "@core/smart/dashboard-stats";

type PlatformDonutProps = {
  data: {
    platform: PlatformId;
    label: string;
    count: number;
    percent: number;
  }[];
  total: number;
};

const COLORS: Record<PlatformId, string> = {
  salon: "#2dd4bf",
  barber: "#fbbf24",
  nail: "#f472b6",
};

export function PlatformDonut({ data, total }: PlatformDonutProps) {
  const chartData = data.map((d) => ({
    name: d.label,
    value: d.count,
    percent: d.percent,
    platform: d.platform,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-semibold">Platform Distribution</h3>
      <p className="mt-1 text-sm text-muted">{total.toLocaleString()} appointments today</p>
      <div className="mx-auto h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell key={entry.platform} fill={COLORS[entry.platform]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#161616", border: "1px solid #2a2a2a" }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1">
        {data.map((d) => (
          <div key={d.platform} className="flex justify-between text-sm">
            <span style={{ color: COLORS[d.platform] }}>{d.label}</span>
            <span className="text-muted">
              {d.percent}% ({d.count.toLocaleString()})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
