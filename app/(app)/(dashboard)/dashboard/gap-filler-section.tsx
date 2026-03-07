"use client";

import { useState, useEffect } from "react";
import { getEmptySlotCandidates } from "./actions";
import type { SlotWithCandidates } from "@/lib/gap-filler";

export function GapFillerSection() {
  const [slots, setSlots] = useState<SlotWithCandidates[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmptySlotCandidates()
      .then((res) => {
        if (res.error) setError(res.error);
        else setSlots(res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="text-lg font-semibold mb-2">Gap filler</h2>
        <p className="text-sm text-muted-foreground">Checking for empty slots…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="text-lg font-semibold mb-2">Gap filler</h2>
        <p className="text-sm text-red-400">{error}</p>
      </section>
    );
  }

  const withCandidates = slots.filter((s) => s.candidates.length > 0);
  if (withCandidates.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="text-lg font-semibold mb-2">Gap filler</h2>
        <p className="text-sm text-muted-foreground">
          No cancelled slots with lapsed clients right now. When you have a cancellation, we’ll suggest clients who had that service and haven’t visited in 4+ weeks.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-background p-4 space-y-4">
      <h2 className="text-lg font-semibold">Gap filler</h2>
      <p className="text-sm text-muted-foreground">
        Cancelled slots and top clients who had this service but haven’t visited in 4+ weeks. Draft SMS for you to approve before sending.
      </p>
      {withCandidates.map(({ slot, candidates, draftSms }) => {
        const slotDate = new Date(slot.startTime);
        const dateStr = slotDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        const timeStr = slotDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        return (
          <div key={slot.appointmentId} className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">
              {slot.serviceName} — {dateStr} at {timeStr}
            </p>
            <p className="text-xs text-muted-foreground">
              Top {candidates.length} client{candidates.length !== 1 ? "s" : ""}:{" "}
              {candidates.map((c) => c.clientName || c.clientEmail || "Unknown").join(", ")}
            </p>
            <div className="bg-muted/50 rounded p-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Draft SMS (approve before sending):</p>
              <p className="text-sm">{draftSms}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
