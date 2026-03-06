"use client";

import { useState } from "react";
import { updateSalonBranding } from "./actions";

export function SettingsView({
  salonId,
  salonName,
  salonSlug,
  stripeConnectAccountId,
  subscriptionStatus,
  formatFlatFee,
  branding,
}: {
  salonId: string;
  salonName: string;
  salonSlug: string;
  stripeConnectAccountId: string | null;
  subscriptionStatus: string;
  formatFlatFee: string;
  branding: { logo_url: string; primary_color: string; company_name: string };
}) {
  const connectUrl = `/api/stripe/connect?salonId=${encodeURIComponent(salonId)}`;
  const [logoUrl, setLogoUrl] = useState(branding.logo_url);
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [companyName, setCompanyName] = useState(branding.company_name);
  const [brandingMsg, setBrandingMsg] = useState<"saved" | "error" | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);

  async function handleBrandingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBrandingMsg(null);
    setBrandingLoading(true);
    const result = await updateSalonBranding(salonId, {
      logo_url: logoUrl.trim() || undefined,
      primary_color: primaryColor.trim() || undefined,
      company_name: companyName.trim() || undefined,
    });
    setBrandingLoading(false);
    setBrandingMsg(result.error ? "error" : "saved");
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-2">Business</h2>
        <p className="text-muted text-sm">{salonName}</p>
        <p className="text-muted text-xs mt-1">
          Booking page: /book/{salonSlug}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Branding</h2>
        <p className="text-muted text-sm mb-4">
          Customise your public booking page so it matches your salon. Clients see this when they book online.
        </p>
        <form onSubmit={handleBrandingSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Primary colour (hex)</label>
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#a78bfa"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Display name (optional)</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Defaults to business name"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {brandingMsg === "saved" && <p className="text-sm text-green-400">Branding saved.</p>}
          {brandingMsg === "error" && <p className="text-sm text-red-400">Failed to save.</p>}
          <button
            type="submit"
            disabled={brandingLoading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {brandingLoading ? "Saving…" : "Save branding"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Payments (Stripe Connect)</h2>
        <p className="text-muted text-sm mb-4">
          Connect your Stripe account to receive in-salon payments and deposits.
        </p>
        {stripeConnectAccountId ? (
          <p className="text-green-400 text-sm">Connected</p>
        ) : (
          <a
            href={connectUrl}
            className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Connect Stripe account
          </a>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Subscription</h2>
        <p className="text-muted text-sm mb-2">
          SalonSynk flat fee: {formatFlatFee}
        </p>
        <p className="text-sm">
          Status: <span className="capitalize">{subscriptionStatus}</span>
        </p>
      </section>
    </div>
  );
}
