"use client";

import { useState, useRef } from "react";
import { updateSalonBranding, updateRenterAdminFee, uploadSalonLogo, addService, updateService, deleteService, updateDepositSettings, updateSalonMarketingSettings } from "./actions";

type ServiceRow = { id: string; name: string; duration_minutes: number; price_minor: number; processing_time_minutes?: number };

export function SettingsView({
  salonId,
  salonName,
  salonSlug,
  stripeConnectAccountId,
  subscriptionStatus,
  formatFlatFee,
  branding,
  showSalonTaxVault,
  salonTaxVaultMinor,
  showRenterTaxVault,
  renterTaxVaultMinor,
  isOwner,
  adminFeePercent,
  services = [],
  depositRequired = false,
  depositType = "percent",
  depositValue = 20,
  googleReviewUrl = "",
  weMissYouWeeksMin = 6,
  weMissYouWeeksMax = 10,
  weMissYouDiscountCode = "",
}: {
  salonId: string;
  salonName: string;
  salonSlug: string;
  stripeConnectAccountId: string | null;
  subscriptionStatus: string;
  formatFlatFee: string;
  branding: { logo_url: string; primary_color: string; company_name: string };
  showSalonTaxVault?: boolean;
  salonTaxVaultMinor?: number;
  showRenterTaxVault?: boolean;
  renterTaxVaultMinor?: number;
  isOwner?: boolean;
  adminFeePercent?: number;
  services?: ServiceRow[];
  depositRequired?: boolean;
  depositType?: "percent" | "flat";
  depositValue?: number;
  googleReviewUrl?: string;
  weMissYouWeeksMin?: number;
  weMissYouWeeksMax?: number;
  weMissYouDiscountCode?: string;
}) {
  const connectUrl = `/api/stripe/connect?salonId=${encodeURIComponent(salonId)}`;
  const [logoUrl, setLogoUrl] = useState(branding.logo_url);
  const [adminFee, setAdminFee] = useState(String(adminFeePercent ?? 10));
  const [adminFeeMsg, setAdminFeeMsg] = useState<"saved" | "error" | null>(null);
  const [adminFeeLoading, setAdminFeeLoading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [companyName, setCompanyName] = useState(branding.company_name);
  const [brandingMsg, setBrandingMsg] = useState<"saved" | "error" | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(60);
  const [newServicePrice, setNewServicePrice] = useState("");
  const [serviceMsg, setServiceMsg] = useState<"saved" | "error" | null>(null);
  const [serviceError, setServiceError] = useState("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState(60);
  const [editPrice, setEditPrice] = useState("");
  const [newServiceProcessing, setNewServiceProcessing] = useState(0);
  const [editProcessing, setEditProcessing] = useState(0);
  const [depositReq, setDepositReq] = useState(depositRequired);
  const [depositTypeVal, setDepositTypeVal] = useState<"percent" | "flat">(depositType);
  const [depositVal, setDepositVal] = useState(
    depositType === "flat" && depositValue > 0 ? (depositValue / 100).toFixed(2) : String(depositValue)
  );
  const [depositMsg, setDepositMsg] = useState<"saved" | "error" | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
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

      {isOwner && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Services</h2>
          <p className="text-muted text-sm mb-4">
            Add and edit the services clients can book. Set duration and price (optional).
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newServiceName.trim()) return;
              setServiceMsg(null);
              setServiceError("");
              setServiceLoading(true);
              const priceMinor = newServicePrice.trim() ? Math.round(parseFloat(newServicePrice) * 100) : 0;
              const result = await addService(salonId, {
                name: newServiceName.trim(),
                duration_minutes: newServiceDuration,
                price_minor: priceMinor,
                processing_time_minutes: newServiceProcessing,
              });
              setServiceLoading(false);
              setServiceMsg(result.error ? "error" : "saved");
              if (result.error) setServiceError(result.error);
              if (!result.error) {
                setNewServiceName("");
                setNewServiceDuration(60);
                setNewServicePrice("");
                setNewServiceProcessing(0);
              }
            }}
            className="flex flex-wrap gap-2 items-end mb-4"
          >
            <div>
              <label htmlFor="new-service-name" className="block text-sm font-medium mb-1">Name</label>
              <input
                id="new-service-name"
                type="text"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="e.g. Balayage"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-40"
                aria-label="Service name"
              />
            </div>
            <div>
              <label htmlFor="new-service-duration" className="block text-sm font-medium mb-1">Duration (min)</label>
              <input
                id="new-service-duration"
                type="number"
                min={5}
                max={480}
                value={newServiceDuration}
                onChange={(e) => setNewServiceDuration(Number(e.target.value) || 60)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-20"
                aria-label="Duration in minutes"
              />
            </div>
            <div>
              <label htmlFor="new-service-price" className="block text-sm font-medium mb-1">Price (£)</label>
              <input
                id="new-service-price"
                type="text"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                placeholder="0"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-20"
                aria-label="Price in pounds"
              />
            </div>
            <div>
              <label htmlFor="new-service-processing" className="block text-sm font-medium mb-1">Processing (min)</label>
              <input
                id="new-service-processing"
                type="number"
                min={0}
                max={480}
                value={newServiceProcessing}
                onChange={(e) => setNewServiceProcessing(Number(e.target.value) || 0)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-20"
                aria-label="Processing time (e.g. color development)"
              />
            </div>
            <button
              type="submit"
              disabled={serviceLoading || !newServiceName.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {serviceLoading ? "Adding…" : "Add"}
            </button>
            {serviceMsg === "saved" && <span className="text-sm text-green-400">Added.</span>}
            {serviceMsg === "error" && <span className="text-sm text-red-400">Failed.</span>}
            {serviceMsg === "error" && serviceError && <span className="text-sm text-red-400">{serviceError}</span>}
          </form>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-border last:border-0">
                {editingId === s.id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded border border-border px-2 py-1 text-sm flex-1 min-w-0"
                      aria-label="Service name"
                      placeholder="Service name"
                    />
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={editDuration}
                      onChange={(e) => setEditDuration(Number(e.target.value) || 60)}
                      className="rounded border border-border px-2 py-1 text-sm w-16"
                      aria-label="Duration in minutes"
                    />
                    <input
                      type="text"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="0"
                      className="rounded border border-border px-2 py-1 text-sm w-16"
                      aria-label="Price in pounds"
                    />
                    <input
                      type="number"
                      min={0}
                      max={480}
                      value={editProcessing}
                      onChange={(e) => setEditProcessing(Number(e.target.value) || 0)}
                      className="rounded border border-border px-2 py-1 text-sm w-14"
                      aria-label="Processing minutes"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setServiceError("");
                        setServiceLoading(true);
                        const result = await updateService(salonId, s.id, {
                          name: editName.trim(),
                          duration_minutes: editDuration,
                          price_minor: editPrice.trim() ? Math.round(parseFloat(editPrice) * 100) : 0,
                          processing_time_minutes: editProcessing,
                        });
                        setServiceLoading(false);
                        setEditingId(null);
                        if (result.error) {
                          setServiceMsg("error");
                          setServiceError(result.error);
                        }
                      }}
                      className="text-sm text-accent hover:underline"
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-sm text-muted hover:underline">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 font-medium truncate">{s.name}</span>
                    <span className="text-sm text-muted">{s.duration_minutes} min</span>
                    {(s.processing_time_minutes ?? 0) > 0 && (
                      <span className="text-xs text-muted">+{s.processing_time_minutes} proc</span>
                    )}
                    {s.price_minor > 0 && (
                      <span className="text-sm text-muted">£{(s.price_minor / 100).toFixed(2)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(s.id);
                        setEditName(s.name);
                        setEditDuration(s.duration_minutes);
                        setEditPrice(s.price_minor > 0 ? (s.price_minor / 100).toFixed(2) : "");
                        setEditProcessing(s.processing_time_minutes ?? 0);
                      }}
                      className="text-sm text-accent hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete "${s.name}"?`)) return;
                        setServiceLoading(true);
                        await deleteService(salonId, s.id);
                        setServiceLoading(false);
                      }}
                      className="text-sm text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {services.length === 0 && (
            <p className="text-sm text-muted">No services yet. Add one above.</p>
          )}
        </section>
      )}

      {isOwner && (
        <section>
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

      {isOwner && (
        <section>
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

      {isOwner && (
        <section>
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
              />
              <span className="text-muted">to</span>
              <input
                type="number"
                min={1}
                max={52}
                value={wmWeeksMax}
                onChange={(e) => setWmWeeksMax(e.target.value)}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm"
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

      {showSalonTaxVault && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Tax Vault</h2>
          <p className="text-muted text-sm mb-2">
            Tax collected on employee revenue (subscription and related). Reserve for your tax obligations.
          </p>
          <p className="text-sm font-medium">
            Balance: £{((salonTaxVaultMinor ?? 0) / 100).toFixed(2)}
          </p>
        </section>
      )}

      {showRenterTaxVault && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Your Tax Vault</h2>
          <p className="text-muted text-sm mb-2">
            Save for your own tax obligations on renter income.
          </p>
          <p className="text-sm font-medium">
            Balance: £{((renterTaxVaultMinor ?? 0) / 100).toFixed(2)}
          </p>
        </section>
      )}
    </div>
  );
}
