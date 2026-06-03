"use client";

import { useState } from "react";
import Link from "next/link";

const HELP_AREAS = [
  { id: "services", label: "Service menu & prices" },
  { id: "team", label: "Staff / team members" },
  { id: "products", label: "Retail products" },
  { id: "branding", label: "Branding & booking page" },
  { id: "stripe", label: "Stripe Connect setup" },
] as const;

export function SetupHelpForm({ salonName }: { salonName: string }) {
  const [hasPriceLists, setHasPriceLists] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function toggleArea(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasPriceLists === null) {
      setMsg({ type: "err", text: "Please say whether you have price lists ready." });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/setup-concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasPriceLists,
          helpAreas: selected.map((id) => HELP_AREAS.find((a) => a.id === id)?.label ?? id),
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "Could not send request." });
        return;
      }
      setMsg({
        type: "ok",
        text: "Request sent! We'll email you within 1–2 working days with a quote before any work starts.",
      });
      setNotes("");
      setSelected([]);
    } catch {
      setMsg({ type: "err", text: "Could not send request. Try again or email hello@salonsynk.com." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted">
        Salon: <span className="font-medium text-foreground">{salonName}</span>
      </p>

      <fieldset>
        <legend className="text-sm font-medium mb-2">
          Do you have price lists and service details ready to send us?
        </legend>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="priceLists"
              checked={hasPriceLists === true}
              onChange={() => setHasPriceLists(true)}
            />
            Yes — from £60
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="priceLists"
              checked={hasPriceLists === false}
              onChange={() => setHasPriceLists(false)}
            />
            Not yet / need help — from £120
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium mb-2">What would you like us to set up?</legend>
        <div className="space-y-2">
          {HELP_AREAS.map(({ id, label }) => (
            <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={() => toggleArea(id)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="setup-notes" className="block text-sm font-medium mb-1">
          Notes (optional)
        </label>
        <textarea
          id="setup-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Attach details in a follow-up email, or describe what you need…"
        />
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === "ok" ? "text-green-400" : "text-red-400"}`} role="alert">
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Sending…" : "Request setup help"}
      </button>

      <p className="text-xs text-muted">
        Prefer email? Contact{" "}
        <a href="mailto:hello@salonsynk.com" className="text-accent hover:underline">
          hello@salonsynk.com
        </a>
        .{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Back to dashboard
        </Link>
      </p>
    </form>
  );
}
