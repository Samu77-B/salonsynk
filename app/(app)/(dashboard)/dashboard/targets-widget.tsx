"use client";

import Link from "next/link";

export type TargetWidgetItem = {
  memberName: string;
  targetType: string;
  period: string;
  current: number;
  target: number;
};

function formatValue(value: number, type: string): string {
  if (type === "revenue" || type === "retail") {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value / 100);
  }
  return String(value);
}

export function TargetsWidget({ items }: { items: TargetWidgetItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Target Progress</h3>
        <Link href="/targets" className="text-xs text-accent hover:underline">View all</Link>
      </div>
      <div className="space-y-3">
        {items.slice(0, 6).map((item, i) => {
          const pct = item.target > 0 ? Math.min(Math.round((item.current / item.target) * 100), 100) : 0;
          const hit = pct >= 100;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium truncate mr-2">
                  {item.memberName} · <span className="capitalize">{item.targetType}</span> <span className="text-muted">({item.period})</span>
                </span>
                <span className={`whitespace-nowrap ${hit ? "text-emerald-400 font-bold" : "text-muted"}`}>
                  {formatValue(item.current, item.targetType)} / {formatValue(item.target, item.targetType)}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${hit ? "bg-emerald-400" : "bg-accent"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
