"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarGap } from "@/lib/ai/calendar-gaps";
import { formatDurationMinutes } from "@/lib/format-duration";

type GapPromotion = {
  gap: CalendarGap;
  promotion: { sms: string; emailSubject: string; emailBody: string };
  bookingPrefillUrl: string;
};

export function AiGapFillPanel({ salonName }: { salonName: string }) {
  const [items, setItems] = useState<GapPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/gap-fill", { credentials: "same-origin" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to load gaps");
      }
      const data = (await res.json()) as { gaps: GapPromotion[] };
      setItems(data.gaps ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load gaps");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="rounded-xl border border-border bg-white/5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-lg font-semibold">Quick Fill</h2>
          <p className="text-sm text-muted">
            Calendar gaps of 30–60 minutes at {salonName}. Generate last-minute promotions to fill empty slots.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Refresh"}
        </button>
      </header>

      <div className="space-y-3 p-4 sm:p-5">
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-muted">No fillable gaps in the next 7 days. Check back after cancellations.</p>
        )}

        {items.map((item) => {
          const { gap, promotion } = item;
          const open = expandedId === gap.gapId;
          return (
            <article key={gap.gapId} className="rounded-lg border border-border bg-background/40 p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {gap.dayLabel} · {gap.timeLabel}
                  </p>
                  <p className="text-sm text-muted">
                    {gap.stylistName} · {formatDurationMinutes(gap.durationMinutes)}
                    {gap.source === "cancellation" ? " · from cancellation" : ""}
                  </p>
                  {gap.suggestedServiceNames.length > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      Suits: {gap.suggestedServiceNames.join(", ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : gap.gapId)}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-background"
                >
                  {open ? "Hide" : "Quick Fill"}
                </button>
              </div>

              {open && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">SMS</p>
                      <button
                        type="button"
                        onClick={() => void copyText(`${gap.gapId}-sms`, promotion.sms)}
                        className="text-xs text-accent hover:underline"
                      >
                        {copiedField === `${gap.gapId}-sms` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="rounded-md border border-border bg-background/80 p-2 text-xs leading-relaxed">
                      {promotion.sms}
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Email</p>
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            `${gap.gapId}-email`,
                            `Subject: ${promotion.emailSubject}\n\n${promotion.emailBody}`
                          )
                        }
                        className="text-xs text-accent hover:underline"
                      >
                        {copiedField === `${gap.gapId}-email` ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="text-xs font-medium">{promotion.emailSubject}</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-background/80 p-2 text-xs leading-relaxed">
                      {promotion.emailBody}
                    </p>
                  </div>
                  <a
                    href={item.bookingPrefillUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-accent hover:underline"
                  >
                    Open public booking link for this slot →
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
