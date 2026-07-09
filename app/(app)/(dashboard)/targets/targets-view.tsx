"use client";

import Image from "next/image";
import { useState } from "react";
import { upsertStaffTarget, deleteStaffTarget, type TargetType, type TargetPeriod } from "./actions";
import { dashboardFlowClass, dashboardStaggerClass } from "@/components/dashboard/ui";

type Member = { id: string; display_name: string; role: string; avatar_url: string | null };
type Target = { id: string; member_id: string; target_type: TargetType; target_value: number; period: TargetPeriod; is_active: boolean };
type MemberProgress = { weeklyRevenue: number; monthlyRevenue: number; weeklyAppts: number; monthlyAppts: number };
type Incentive = {
  id: string;
  client_id: string;
  points: number;
  service_points: number;
  product_points: number;
  total_visits: number;
  tier: string;
  last_reward_at: string | null;
};

type Tab = "staff" | "loyalty";

function formatMoney(minor: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(minor / 100);
}

function ProgressBar({ current, target, color }: { current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const overTarget = target > 0 && current >= target;
  return (
    <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${overTarget ? "bg-emerald-400" : color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    bronze: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    silver: "bg-zinc-400/15 text-zinc-300 border-zinc-400/30",
    gold: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  };
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${styles[tier] ?? styles.bronze}`}>
      {tier}
    </span>
  );
}

export function TargetsView({
  salonId,
  members,
  targets,
  progress,
  incentives,
  clientsMap,
  isOwner,
}: {
  salonId: string;
  members: Member[];
  targets: Target[];
  progress: Record<string, MemberProgress>;
  incentives: Incentive[];
  clientsMap: Record<string, { name: string; email: string | null }>;
  isOwner: boolean;
}) {
  const [tab, setTab] = useState<Tab>("staff");
  const [error, setError] = useState<string | null>(null);

  const [addMemberId, setAddMemberId] = useState("");
  const [addType, setAddType] = useState<TargetType>("revenue");
  const [addPeriod, setAddPeriod] = useState<TargetPeriod>("weekly");
  const [addValue, setAddValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAddTarget() {
    if (!addMemberId || !addValue) return;
    setSaving(true);
    setError(null);
    const val = addType === "revenue" || addType === "retail"
      ? Math.round(Number(addValue) * 100)
      : Math.round(Number(addValue));
    const result = await upsertStaffTarget(salonId, addMemberId, addType, addPeriod, val);
    setSaving(false);
    if (result.error) setError(result.error);
    else setAddValue("");
  }

  async function handleDelete(targetId: string) {
    if (!confirm("Remove this target?")) return;
    setError(null);
    const result = await deleteStaffTarget(salonId, targetId);
    if (result.error) setError(result.error);
  }

  function getCurrentValue(memberId: string, targetType: TargetType, period: TargetPeriod): number {
    const p = progress[memberId];
    if (!p) return 0;
    if (targetType === "revenue" || targetType === "retail") {
      return period === "weekly" ? p.weeklyRevenue : p.monthlyRevenue;
    }
    return period === "weekly" ? p.weeklyAppts : p.monthlyAppts;
  }

  function formatTarget(value: number, type: TargetType): string {
    if (type === "revenue" || type === "retail") return formatMoney(value);
    return String(value);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "staff", label: "Staff Targets" },
    { id: "loyalty", label: "Client Loyalty" },
  ];

  return (
    <div className={`${dashboardFlowClass} space-y-4`}>
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      {tab === "staff" && (
        <div className="space-y-6">
          {isOwner && (
            <div className="rounded-xl border border-border bg-white/[0.03] p-4 space-y-3">
              <h3 className="text-sm font-semibold">Set a target</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select
                  value={addMemberId}
                  onChange={(e) => setAddMemberId(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Select team member"
                >
                  <option value="">Select member</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.display_name}</option>
                  ))}
                </select>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as TargetType)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Target type"
                >
                  <option value="revenue">Revenue</option>
                  <option value="appointments">Appointments</option>
                  <option value="retail">Retail sales</option>
                </select>
                <select
                  value={addPeriod}
                  onChange={(e) => setAddPeriod(e.target.value as TargetPeriod)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Target period"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step={addType === "appointments" ? "1" : "0.01"}
                    value={addValue}
                    onChange={(e) => setAddValue(e.target.value)}
                    placeholder={addType === "appointments" ? "Count" : "£ amount"}
                    className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={saving || !addMemberId || !addValue}
                    onClick={handleAddTarget}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50 whitespace-nowrap"
                  >
                    {saving ? "…" : "Set"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {members.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">No active team members.</p>
          ) : (
            <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${dashboardStaggerClass}`}>
              {members.map((m) => {
                const memberTargets = targets.filter((t) => t.member_id === m.id);
                const p = progress[m.id];
                return (
                  <div key={m.id} className="rounded-xl border border-border bg-white/[0.03] p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {m.avatar_url ? (
                        <Image
                          src={m.avatar_url}
                          alt=""
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                          {(m.display_name || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-sm">{m.display_name}</p>
                        <p className="text-xs text-muted capitalize">{m.role}</p>
                      </div>
                    </div>

                    {memberTargets.length === 0 && (
                      <p className="text-xs text-muted">No targets set</p>
                    )}

                    {memberTargets.map((t) => {
                      const current = getCurrentValue(m.id, t.target_type, t.period);
                      const isMoney = t.target_type === "revenue" || t.target_type === "retail";
                      const pct = t.target_value > 0 ? Math.round((current / t.target_value) * 100) : 0;
                      const hit = pct >= 100;
                      return (
                        <div key={t.id} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium capitalize">
                              {t.target_type} ({t.period})
                            </span>
                            <span className={hit ? "text-emerald-400 font-bold" : "text-muted"}>
                              {isMoney ? formatMoney(current) : current} / {formatTarget(t.target_value, t.target_type)}
                              {" "}({pct}%)
                            </span>
                          </div>
                          <ProgressBar
                            current={current}
                            target={t.target_value}
                            color={
                              t.target_type === "revenue" ? "bg-accent"
                              : t.target_type === "appointments" ? "bg-blue-400"
                              : "bg-purple-400"
                            }
                          />
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleDelete(t.id)}
                              className="text-[10px] text-red-400 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {memberTargets.length === 0 && p && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white/5 px-2 py-1.5 text-center">
                          <p className="text-muted">Weekly rev.</p>
                          <p className="font-semibold">{formatMoney(p.weeklyRevenue)}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 px-2 py-1.5 text-center">
                          <p className="text-muted">Weekly appts.</p>
                          <p className="font-semibold">{p.weeklyAppts}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "loyalty" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold mb-2">Client Loyalty Programme</h3>
            <p className="text-xs text-muted mb-3">
              Clients earn points when they pay at checkout: £1 on services = 1 service point, £1 on products = 2 product points.
              Redemption values are set in Settings. Tiers upgrade by visits: Bronze (0–9), Silver (10–19), Gold (20+).
            </p>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2">
                <p className="font-bold text-orange-300">Bronze</p>
                <p className="text-muted">0-9 visits</p>
              </div>
              <div className="rounded-lg bg-zinc-400/10 border border-zinc-400/20 p-2">
                <p className="font-bold text-zinc-300">Silver</p>
                <p className="text-muted">10-19 visits</p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2">
                <p className="font-bold text-yellow-300">Gold</p>
                <p className="text-muted">20+ visits</p>
              </div>
            </div>
          </div>

          {incentives.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">
              No client loyalty data yet. Points are awarded when enrolled clients pay at checkout.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 pr-4">Client</th>
                    <th className="pb-2 pr-4 text-center">Tier</th>
                    <th className="pb-2 pr-4 text-right">Service pts</th>
                    <th className="pb-2 pr-4 text-right">Product pts</th>
                    <th className="pb-2 pr-4 text-right">Visits</th>
                    <th className="pb-2 text-right">Last reward</th>
                  </tr>
                </thead>
                <tbody>
                  {incentives.map((inc) => {
                    const client = clientsMap[inc.client_id];
                    return (
                      <tr key={inc.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{client?.name || "Unknown"}</td>
                        <td className="py-2.5 pr-4 text-center"><TierBadge tier={inc.tier} /></td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{inc.service_points}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{inc.product_points}</td>
                        <td className="py-2.5 pr-4 text-right">{inc.total_visits}</td>
                        <td className="py-2.5 text-right text-muted">
                          {inc.last_reward_at
                            ? new Date(inc.last_reward_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                            : "—"
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
