"use client";

import { useState, useRef } from "react";
import { updateSalonBranding, updateRenterAdminFee, uploadSalonLogo, updateDepositSettings, updateReminderSettings, updateSalonMarketingSettings } from "./actions";
import type { PlatformFeatureId } from "@/config/plans";
import { dashboardBtnPrimaryClass, dashboardInputClass, dashboardSectionClass, dashboardFlowClass } from "@/components/dashboard/ui";

export function SettingsView(props: {
  salonId: string;
  salonName: string;
  salonSlug: string;
  stripeConnectAccountId: string | null;
  subscriptionStatus: string;
  planLabel: string;
  planPriceLabel: string;
  branding: { logo_url: string; primary_color: string; company_name: string; booking_heading: string };
  showSalonTaxVault?: boolean;
  salonTaxVaultMinor?: number;
  showRenterTaxVault?: boolean;
  renterTaxVaultMinor?: number;
  isOwner?: boolean;
  adminFeePercent?: number;
  depositRequired?: boolean;
  depositType?: "percent" | "flat";
  depositValue?: number;
  reminderHours?: number[];
  googleReviewUrl?: string;
  weMissYouWeeksMin?: number;
  weMissYouWeeksMax?: number;
  weMissYouDiscountCode?: string;
  subscriptionCheckoutAvailable?: boolean;
  hasBillingCustomer?: boolean;
  enabledFeatures?: PlatformFeatureId[];
  paymentGateway?: string;
  paymentGatewayLabel?: string;
  usesStripeCheckout?: boolean;
}) {
  const {
    salonId,
    salonName,
    salonSlug,
    stripeConnectAccountId,
    subscriptionStatus,
    planLabel,
    planPriceLabel,
    branding,
    isOwner,
    adminFeePercent,
    depositRequired = false,
    depositType = "percent",
    depositValue = 20,
    reminderHours = [24],
    googleReviewUrl = "",
    weMissYouWeeksMin = 6,
    weMissYouWeeksMax = 10,
    weMissYouDiscountCode = "",
    subscriptionCheckoutAvailable = false,
    hasBillingCustomer = false,
    enabledFeatures = [],
    paymentGatewayLabel = "Stripe",
    usesStripeCheckout = true,
  } = props;
  const features = new Set(enabledFeatures);
  const hasProductsShop = features.has("products_shop");
  const hasStripeConnect = features.has("stripe_connect") && usesStripeCheckout;
  const hasDeposits = features.has("deposits_no_show");
  const hasReminders = features.has("email_reminders");
  const hasReviewRequests = features.has("review_requests");
  const hasWeMissYou = features.has("we_miss_you");
  const hasChairRenterSplits = features.has("chair_renter_splits");
  const connectUrl = `/api/stripe/connect?salonId=${encodeURIComponent(salonId)}`;
  const subscribeUrl = `/api/stripe/create-subscription-checkout?salonId=${encodeURIComponent(salonId)}`;
  const billingPortalUrl = `/api/stripe/billing-portal?salonId=${encodeURIComponent(salonId)}`;
  const [logoUrl, setLogoUrl] = useState(branding.logo_url);
  const [adminFee, setAdminFee] = useState(String(adminFeePercent ?? 10));
  const [adminFeeMsg, setAdminFeeMsg] = useState<"saved" | "error" | null>(null);
  const [adminFeeLoading, setAdminFeeLoading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [companyName, setCompanyName] = useState(branding.company_name);
  const [bookingHeading, setBookingHeading] = useState(branding.booking_heading);
  const [brandingMsg, setBrandingMsg] = useState<"saved" | "error" | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [depositReq, setDepositReq] = useState(depositRequired);
  const [depositTypeVal, setDepositTypeVal] = useState<"percent" | "flat">(depositType);
  const [depositVal, setDepositVal] = useState(
    depositType === "flat" && depositValue > 0 ? (depositValue / 100).toFixed(2) : String(depositValue)
  );
  const [depositMsg, setDepositMsg] = useState<"saved" | "error" | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [reminderHoursVal, setReminderHoursVal] = useState<number[]>(reminderHours);
  const [reminderMsg, setReminderMsg] = useState<"saved" | "error" | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [googleReviewUrlVal, setGoogleReviewUrlVal] = useState(googleReviewUrl);
  const [wmWeeksMin, setWmWeeksMin] = useState(String(weMissYouWeeksMin));
  const [wmWeeksMax, setWmWeeksMax] = useState(String(weMissYouWeeksMax));
  const [wmDiscountCode, setWmDiscountCode] = useState(weMissYouDiscountCode);
  const [marketingMsg, setMarketingMsg] = useState<"saved" | "error" | null>(null);
  const [marketingLoading, setMarketingLoading] = useState(false);

  async function handleBrandingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBrandingMsg(null);
    setBrandingLoading(true);
    const result = await updateSalonBranding(salonId, {
      logo_url: logoUrl.trim() || undefined,
      primary_color: primaryColor.trim() || undefined,
      company_name: companyName.trim() || undefined,
      booking_heading: bookingHeading.trim() || undefined,
    });
    setBrandingLoading(false);
    setBrandingMsg(result.error ? "error" : "saved");
  }

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBrandingMsg(null);
    setLogoUploading(true);
    const formData = new FormData();
    formData.append("logo", file);
    const result = await uploadSalonLogo(salonId, formData);
    setLogoUploading(false);
    if (result.error) {
      setBrandingMsg("error");
    } else {
      if (result.url) setLogoUrl(result.url);
      setBrandingMsg("saved");
    }
  }

  return (
    <div className={`${dashboardFlowClass} space-y-4`}>
      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Business</h2>
        <p className="text-muted text-sm">{salonName}</p>
        <p className="text-muted text-xs mt-1">
          Booking page:{" "}
          <a href={`/book/${salonSlug}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            /book/{salonSlug}
          </a>
        </p>
        {hasProductsShop ? (
          <p className="text-muted text-xs mt-1">
            Shop page (retail products):{" "}
            <a href={`/shop/${salonSlug}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              /shop/{salonSlug}
            </a>
          </p>
        ) : null}
      </section>

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Branding</h2>
        <p className="text-muted text-sm mb-4">
          Customise your public booking{hasProductsShop ? " and shop" : ""} pages so they match your salon. Clients see this when they book online
          {hasProductsShop ? " or browse products" : ""}.
        </p>
        <form onSubmit={handleBrandingSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Logo</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full sm:flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => logoFileInputRef.current?.click()}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium"
                  disabled={logoUploading}
                >
                  {logoUploading ? "Uploading…" : "Upload logo"}
                </button>
              </div>
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
                aria-label="Upload logo image"
              />
            </div>
            <p className="text-xs text-muted mt-1">
              Paste a URL or upload an image file. PNG, JPEG, GIF, WebP, or SVG up to 2MB.
            </p>
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
          <div>
            <label className="block text-sm font-medium mb-1">Booking page heading (optional)</label>
            <input
              type="text"
              value={bookingHeading}
              onChange={(e) => setBookingHeading(e.target.value)}
              placeholder={`Book at ${companyName || salonName}`}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted mt-1">
              Custom heading shown on your booking page. Leave blank to hide it entirely.
            </p>
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

      {isOwner && hasChairRenterSplits && (
        <section className={dashboardSectionClass}>
          <h2 className="text-lg font-semibold mb-2">Renter admin fee</h2>
          <p className="text-muted text-sm mb-2">
            When a renter receives a payment, this percentage goes to the salon. The rest goes to the stylist.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAdminFeeMsg(null);
              setAdminFeeLoading(true);
              const result = await updateRenterAdminFee(salonId, Number(adminFee));
              setAdminFeeLoading(false);
              setAdminFeeMsg(result.error ? "error" : "saved");
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Admin fee (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={adminFee}
                onChange={(e) => setAdminFee(e.target.value)}
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                aria-label="Admin fee percentage"
              />
            </div>
            <button
              type="submit"
              disabled={adminFeeLoading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {adminFeeLoading ? "Saving…" : "Save"}
            </button>
            {adminFeeMsg === "saved" && <span className="text-sm text-green-400">Saved.</span>}
            {adminFeeMsg === "error" && <span className="text-sm text-red-400">Failed.</span>}
          </form>
        </section>
      )}

      {isOwner && hasDeposits && (
        <section className={dashboardSectionClass}>
          <h2 className="text-lg font-semibold mb-2">No-Show & Deposit</h2>
          <p className="text-muted text-sm mb-4">
            Require a deposit at booking (percentage or flat fee). Use &quot;Charge No-Show Fee&quot; in the appointment details to capture it if the client doesn&apos;t show.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setDepositMsg(null);
              setDepositLoading(true);
              const val =
                depositTypeVal === "percent"
                  ? Math.min(100, Math.max(0, Math.round(Number(depositVal) || 0)))
                  : Math.max(0, Math.round((Number(depositVal) || 0) * 100));
              const result = await updateDepositSettings(salonId, {
                deposit_required: depositReq,
                deposit_type: depositTypeVal,
                deposit_value: val,
              });
              setDepositLoading(false);
              setDepositMsg(result.error ? "error" : "saved");
            }}
            className="space-y-3"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={depositReq}
                onChange={(e) => setDepositReq(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm font-medium">Require deposit at booking</span>
            </label>
            {depositReq && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={depositTypeVal}
                    onChange={(e) => setDepositTypeVal(e.target.value as "percent" | "flat")}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    aria-label="Deposit type"
                  >
                    <option value="percent">Percentage of service</option>
                    <option value="flat">Flat fee (£)</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={depositTypeVal === "percent" ? 100 : undefined}
                    step={depositTypeVal === "percent" ? 1 : 0.01}
                    value={depositVal}
                    onChange={(e) => setDepositVal(e.target.value)}
                    placeholder={depositTypeVal === "percent" ? "20" : "5.00"}
                    className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-muted">{depositTypeVal === "percent" ? "%" : "£"}</span>
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={depositLoading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {depositLoading ? "Saving…" : "Save deposit settings"}
            </button>
            {depositMsg === "saved" && <span className="text-sm text-green-400">Saved.</span>}
            {depositMsg === "error" && <span className="text-sm text-red-400">Failed.</span>}
          </form>
        </section>
      )}

      {hasStripeConnect ? (
      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Payments (Stripe Connect)</h2>
        <p className="text-muted text-sm mb-2">
          Your salon uses <span className="font-medium text-foreground">{paymentGatewayLabel}</span> for
          in-salon card payments.
        </p>
        <p className="text-muted text-sm mb-4">
          Connect your Stripe account to receive in-salon payments and deposits through SalonSynk checkout.
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
      ) : (
      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Card payments</h2>
        <p className="text-muted text-sm">
          Your salon uses <span className="font-medium text-foreground">{paymentGatewayLabel}</span> on
          your existing terminal. Use <strong>Checkout</strong> to record sales after payment — no Stripe
          Connect needed. Contact{" "}
          <a href="mailto:hello@salonsynk.com" className="text-accent hover:underline">
            hello@salonsynk.com
          </a>{" "}
          to switch to SalonSynk Stripe checkout.
        </p>
      </section>
      )}

      <section className={dashboardSectionClass}>
        <h2 className="text-lg font-semibold mb-2">Subscription</h2>
        <p className="text-muted text-sm mb-2">
          Your plan: <span className="font-medium text-foreground">{planLabel}</span> ({planPriceLabel}). Billed to
          SalonSynk (platform) — separate from Stripe Connect payouts for your salon. Your tier is set by SalonSynk
          admin; contact support to change plan.
        </p>
        <p className="text-sm mb-3">
          Status: <span className="capitalize">{subscriptionStatus}</span>
        </p>
        {isOwner && subscriptionCheckoutAvailable && (subscriptionStatus === "inactive" || subscriptionStatus === "canceled") && (
          <a
            href={subscribeUrl}
            className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Pay subscription (card)
          </a>
        )}
        {isOwner &&
          hasBillingCustomer &&
          (subscriptionStatus === "active" || subscriptionStatus === "past_due") && (
            <>
            <a
              href={billingPortalUrl}
              className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              Manage billing
            </a>
            {subscriptionStatus === "active" && (
              <a
                href="/setup-help"
                className="inline-flex ml-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
              >
                Request setup help
              </a>
            )}
            </>
          )}
        {isOwner && !subscriptionCheckoutAvailable && (
          <p className="text-muted text-sm">
            Subscription checkout is not configured for the {planLabel} plan yet. Ask SalonSynk support to enable
            billing for your tier.
          </p>
        )}
        {isOwner &&
          subscriptionStatus === "active" &&
          !hasBillingCustomer &&
          subscriptionCheckoutAvailable && (
            <p className="text-muted text-sm mt-2">
              Billing is active but the customer profile is not linked in-app yet. If you need to change card or
              cancel, use the Stripe customer portal from your invoice email or contact support.
            </p>
          )}
      </section>

      {isOwner && hasReminders && (
        <section className={dashboardSectionClass}>
          <h2 className="text-lg font-semibold mb-2">Appointment Reminders</h2>
          <p className="text-muted text-sm mb-4">
            Choose when to send appointment reminders. Clients with a phone number or email will receive a message before their appointment.
          </p>
          <div className="space-y-2">
            {[
              { value: 12, label: "12 hours before" },
              { value: 24, label: "24 hours before" },
              { value: 48, label: "48 hours before" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderHoursVal.includes(opt.value)}
                  onChange={(e) => {
                    setReminderHoursVal((prev) =>
                      e.target.checked
                        ? [...prev, opt.value].sort((a, b) => a - b)
                        : prev.filter((h) => h !== opt.value)
                    );
                  }}
                  className="rounded border-border"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
          {reminderHoursVal.length === 0 && (
            <p className="text-xs text-amber-500 mt-2">No reminders selected — clients won&apos;t receive any appointment reminders.</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              disabled={reminderLoading}
              onClick={async () => {
                setReminderMsg(null);
                setReminderLoading(true);
                const result = await updateReminderSettings(salonId, reminderHoursVal);
                setReminderLoading(false);
                setReminderMsg(result.error ? "error" : "saved");
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {reminderLoading ? "Saving…" : "Save reminder settings"}
            </button>
            {reminderMsg === "saved" && <span className="text-sm text-green-400">Saved.</span>}
            {reminderMsg === "error" && <span className="text-sm text-red-400">Failed.</span>}
          </div>
        </section>
      )}

      {isOwner && (hasReviewRequests || hasWeMissYou) && (
        <section className={dashboardSectionClass}>
          <h2 className="text-lg font-semibold mb-2">Marketing &amp; Reviews</h2>
          <p className="text-muted text-sm mb-4">
            Google review link is sent in post-appointment review requests. We Miss You: optional discount code for lapsed-client campaigns.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMarketingMsg(null);
              setMarketingLoading(true);
              const result = await updateSalonMarketingSettings(salonId, {
                google_review_url: googleReviewUrlVal.trim() || undefined,
                we_miss_you_weeks_min: Math.max(0, Math.round(Number(wmWeeksMin) || 0)),
                we_miss_you_weeks_max: Math.max(0, Math.round(Number(wmWeeksMax) || 0)),
                we_miss_you_discount_code: wmDiscountCode.trim() || undefined,
              });
              setMarketingLoading(false);
              setMarketingMsg(result.error ? "error" : "saved");
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-sm font-medium mb-1">Google review URL</label>
              <input
                type="url"
                value={googleReviewUrlVal}
                onChange={(e) => setGoogleReviewUrlVal(e.target.value)}
                placeholder="https://g.page/r/..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="block text-sm font-medium">We Miss You: weeks since last visit</label>
              <input
                type="number"
                min={1}
                max={52}
                value={wmWeeksMin}
                onChange={(e) => setWmWeeksMin(e.target.value)}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                aria-label="Minimum weeks since last visit"
              />
              <span className="text-muted">to</span>
              <input
                type="number"
                min={1}
                max={52}
                value={wmWeeksMax}
                onChange={(e) => setWmWeeksMax(e.target.value)}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                aria-label="Maximum weeks since last visit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">We Miss You discount code (optional)</label>
              <input
                type="text"
                value={wmDiscountCode}
                onChange={(e) => setWmDiscountCode(e.target.value)}
                placeholder="e.g. COMEBACK10"
                className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={marketingLoading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {marketingLoading ? "Saving…" : "Save"}
            </button>
            {marketingMsg === "saved" && <span className="text-sm text-green-400">Saved.</span>}
            {marketingMsg === "error" && <span className="text-sm text-red-400">Failed.</span>}
          </form>
        </section>
      )}

    </div>
  );
}
