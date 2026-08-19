"use client";

import { useState } from "react";
import { PlanTierPicker } from "@/components/marketing/plan-tier-picker";
import { PaymentGatewayPicker } from "@/components/marketing/payment-gateway-picker";
import { type PlanTierId } from "@/config/plans";
import { type PaymentGatewayId } from "@/config/payment-gateways";

export function RequestAccountForm({ initialPlanTier = "professional" }: { initialPlanTier?: PlanTierId }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [planTier, setPlanTier] = useState<PlanTierId>(initialPlanTier);
  const [paymentGateway, setPaymentGateway] = useState<PaymentGatewayId>("stripe");
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
          planTier,
          paymentGateway,
          platform: "salon",
          message: message || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setFormMessage({ type: "error", text: data.error ?? "Something went wrong. Please try again." });
        return;
      }
      setFormMessage({
        type: "success",
        text: "Thanks — we’ve received your request. We’ll email you when your account is ready.",
      });
      setFullName("");
      setEmail("");
      setSalonName("");
      setPhone("");
      setPlanTier(initialPlanTier);
      setPaymentGateway("stripe");
      setMessage("");
    } catch {
      setFormMessage({ type: "error", text: "Could not send your request. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PlanTierPicker value={planTier} onChange={setPlanTier} />

      <PaymentGatewayPicker value={paymentGateway} onChange={setPaymentGateway} />

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium mb-1">
          Your name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Jane Smith"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Work email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="you@yoursalon.co.uk"
        />
      </div>
      <div>
        <label htmlFor="salonName" className="block text-sm font-medium mb-1">
          Salon or business name
        </label>
        <input
          id="salonName"
          type="text"
          value={salonName}
          onChange={(e) => setSalonName(e.target.value)}
          required
          autoComplete="organization"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="The Hair Studio"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-1">
          Phone <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="07xxx xxxxxx"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1">
          Anything else we should know? <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y min-h-[80px]"
          placeholder="e.g. number of stylists, when you’d like to go live…"
        />
      </div>
      {formMessage && (
        <p
          className={`text-sm ${formMessage.type === "error" ? "text-red-400" : "text-green-400"}`}
          role="alert"
        >
          {formMessage.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Request account"}
      </button>
    </form>
  );
}
