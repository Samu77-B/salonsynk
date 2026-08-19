"use client";

import { useState } from "react";

export function BarberRequestForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
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
          salonName: shopName,
          phone: phone || undefined,
          planTier: "barber",
          paymentGateway: "stripe",
          platform: "barber",
          message: message ? `[BarberSynk] ${message}` : "[BarberSynk signup]",
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
      setShopName("");
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
      {/* Fixed single plan */}
      <div className="rounded-lg border p-4" style={{ borderColor: "#A0522D", backgroundColor: "rgba(160,82,45,0.05)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#36454F" }}>BarberSynk</p>
            <p className="text-xs" style={{ color: "#5a6a74" }}>Queue management for barber shops</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: "#36454F" }}>£25</p>
            <p className="text-xs" style={{ color: "#5a6a74" }}>per month</p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium mb-1" style={{ color: "#36454F" }}>
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
          style={{ borderColor: "#d6d0c4", color: "#36454F" }}
          placeholder="John Smith"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: "#36454F" }}>
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
          style={{ borderColor: "#d6d0c4", color: "#36454F" }}
          placeholder="you@yourshop.co.uk"
        />
      </div>
      <div>
        <label htmlFor="shopName" className="block text-sm font-medium mb-1" style={{ color: "#36454F" }}>
          Shop name
        </label>
        <input
          id="shopName"
          type="text"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          required
          autoComplete="organization"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "#d6d0c4", color: "#36454F" }}
          placeholder="The Barber Shop"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-1" style={{ color: "#36454F" }}>
          Phone <span className="font-normal" style={{ color: "#8a8278" }}>(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "#d6d0c4", color: "#36454F" }}
          placeholder="07xxx xxxxxx"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1" style={{ color: "#36454F" }}>
          Anything else? <span className="font-normal" style={{ color: "#8a8278" }}>(optional)</span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-y min-h-[80px]"
          style={{ borderColor: "#d6d0c4", color: "#36454F" }}
          placeholder="e.g. number of barbers, how many chairs…"
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
        style={{ backgroundColor: "#A0522D" }}
      >
        {loading ? "Sending…" : "Request account"}
      </button>
    </form>
  );
}
