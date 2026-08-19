"use client";

import { useState } from "react";
import { NAIL_MONTHLY_GBP } from "@core/billing/platform-billing";
import { NAIL_SITE } from "@core/config/nail-site";

const ACCENT = "#9B4B6A";
const TEXT_DARK = "#2D2A32";
const TEXT_MUTED = "#6B6560";

export function NailRequestForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormMessage(null);
    try {
      const res = await fetch("/api/account-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          salonName,
          phone: phone || undefined,
          planTier: "nail",
          paymentGateway: "stripe",
          platform: "nail",
          message: message ? `[${NAIL_SITE.name}] ${message}` : `[${NAIL_SITE.name} signup]`,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setFormMessage({ type: "error", text: data.error ?? "Something went wrong. Please try again." });
        return;
      }
      setFormMessage({
        type: "success",
        text: "Thanks — we've received your request. We'll email you when your account is ready.",
      });
      setFullName("");
      setEmail("");
      setSalonName("");
      setPhone("");
      setMessage("");
    } catch {
      setFormMessage({ type: "error", text: "Could not send your request. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border p-4" style={{ borderColor: ACCENT, backgroundColor: "rgba(155,75,106,0.05)" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: TEXT_DARK }}>{NAIL_SITE.name}</p>
            <p className="text-xs" style={{ color: TEXT_MUTED }}>Walk-in queue for nail bars</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold" style={{ color: TEXT_DARK }}>£{NAIL_MONTHLY_GBP}</p>
            <p className="text-xs" style={{ color: TEXT_MUTED }}>per month</p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium mb-1" style={{ color: TEXT_DARK }}>
          Your name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "#e8e2dc", color: TEXT_DARK }}
          placeholder="Jane Smith"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: TEXT_DARK }}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "#e8e2dc", color: TEXT_DARK }}
          placeholder="you@yoursalon.co.uk"
        />
      </div>
      <div>
        <label htmlFor="salonName" className="block text-sm font-medium mb-1" style={{ color: TEXT_DARK }}>
          Salon name
        </label>
        <input
          id="salonName"
          type="text"
          value={salonName}
          onChange={(e) => setSalonName(e.target.value)}
          required
          autoComplete="organization"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "#e8e2dc", color: TEXT_DARK }}
          placeholder="Polished Nails"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-1" style={{ color: TEXT_DARK }}>
          Phone <span className="font-normal" style={{ color: TEXT_MUTED }}>(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "#e8e2dc", color: TEXT_DARK }}
          placeholder="07xxx xxxxxx"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1" style={{ color: TEXT_DARK }}>
          Anything else? <span className="font-normal" style={{ color: TEXT_MUTED }}>(optional)</span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-y min-h-[80px]"
          style={{ borderColor: "#e8e2dc", color: TEXT_DARK }}
          placeholder="e.g. number of technicians, stations…"
        />
      </div>
      {formMessage && (
        <p
          className={`text-sm ${formMessage.type === "error" ? "text-red-600" : "text-green-600"}`}
          role="alert"
        >
          {formMessage.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        style={{ backgroundColor: ACCENT }}
      >
        {loading ? "Sending…" : "Request account"}
      </button>
    </form>
  );
}
