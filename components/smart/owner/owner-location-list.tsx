"use client";

import { useState } from "react";
import { PlatformIcon } from "@/components/smart/marketing/platform-icons";
import type { PlatformMembership } from "@core/auth/resolve-user-platform";
import type { SmartPlatformId } from "@core/config/smart-site";

const PLATFORM_LABELS: Record<string, string> = {
  salon: "SalonSynk",
  barber: "BarberSynk",
  nail: "NailSynk",
};

type OwnerLocationListProps = {
  locations: PlatformMembership[];
};

export function OwnerLocationList({ locations }: OwnerLocationListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openLocation(m: PlatformMembership) {
    setLoadingId(`${m.platform}-${m.tenantId}`);
    setError(null);
    try {
      const res = await fetch(
        `/api/auth/owner-location-handoff?platform=${encodeURIComponent(m.platform)}&tenantId=${encodeURIComponent(m.tenantId)}`
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Could not open this location.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not open this location. Try again.");
    } finally {
      setLoadingId(null);
    }
  }

  if (locations.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Your locations</h2>
      <p className="mt-1 text-xs text-muted">
        Open any salon, barber shop, or nail studio you own.
      </p>
      <ul className="mt-4 space-y-2">
        {locations.map((m) => {
          const key = `${m.platform}-${m.tenantId}`;
          const busy = loadingId === key;
          return (
            <li key={key}>
              <button
                type="button"
                disabled={Boolean(loadingId)}
                onClick={() => openLocation(m)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-canvas/40 px-4 py-3 text-left text-sm transition-colors hover:border-accent/40 disabled:opacity-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <PlatformIcon platform={m.platform as SmartPlatformId} className="h-5 w-5" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{m.tenantName}</span>
                  <span className="block text-xs text-muted">{PLATFORM_LABELS[m.platform]}</span>
                </span>
                <span className="text-xs font-medium text-accent">
                  {busy ? "Opening…" : "Open"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
