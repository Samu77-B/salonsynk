"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type PerformanceChartProps = {
  data: {
    date: string;
    appointments: number;
    revenueMinor: number;
  }[];
};

export function PerformanceChart({ data }: PerformanceChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    appointments: d.appointments,
    revenue: d.revenueMinor / 100,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold">Performance Analytics</h3>
        <span className="rounded-md border border-border px-2 py-1 text-xs text-muted">Daily</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fill: "#888", fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#888", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 8 }}
              labelStyle={{ color: "#fff" }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="appointments"
              stroke="#2dd4bf"
              strokeWidth={2}
              dot={false}
              name="Appointments"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={false}
              name="Revenue (£)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
