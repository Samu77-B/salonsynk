"use client";

import { useRef, useState } from "react";
import {
  adminUpdateBarberShop,
  adminUploadBarberShopLogo,
  type BarberBrandingInput,
} from "../actions";

export function AdminEditBarberShopForm({
  shopId,
  initialName,
  initialSlug,
  initialBranding,
}: {
  shopId: string;
  initialName: string;
  initialSlug: string;
  initialBranding: { logo_url: string; primary_color: string; company_name: string };
}) {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [logoUrl, setLogoUrl] = useState(initialBranding.logo_url);
  const [primaryColor, setPrimaryColor] = useState(initialBranding.primary_color);
  const [companyName, setCompanyName] = useState(initialBranding.company_name);
  const [saveMsg, setSaveMsg] = useState<"saved" | "error" | null>(null);
  const [saveErrorText, setSaveErrorText] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    setLoading(true);
    const branding: BarberBrandingInput = {};
    if (logoUrl.trim()) branding.logo_url = logoUrl.trim();
    if (primaryColor.trim()) branding.primary_color = primaryColor.trim();
    if (companyName.trim()) branding.company_name = companyName.trim();
    const result = await adminUpdateBarberShop(shopId, {
      name: name.trim(),
      slug: slug.trim(),
      branding: Object.keys(branding).length ? branding : undefined,
    });
    setLoading(false);
    if (result.error) {
      setSaveErrorText(result.error);
      setSaveMsg("error");
      return;
    }
    setSaveMsg("saved");
  }

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveMsg(null);
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const result = await adminUploadBarberShopLogo(shopId, formData);
      if (result.error) {
        setSaveErrorText(result.error);
        setSaveMsg("error");
      } else if (result.url) {
        setLogoUrl(result.url);
        setSaveMsg("saved");
      }
    } catch (err) {
      setSaveErrorText(err instanceof Error ? err.message : "Upload failed");
      setSaveMsg("error");
    } finally {
      setLogoUploading(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="shopName" className="block text-sm font-medium mb-1">
          Shop name
        </label>
        <input
          id="shopName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="shopSlug" className="block text-sm font-medium mb-1">
          URL slug
        </label>
        <input
          id="shopSlug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
        />
      </div>
      <div>
        <label htmlFor="companyName" className="block text-sm font-medium mb-1">
          Display name on queue page
        </label>
        <input
          id="companyName"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={name}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="primaryColor" className="block text-sm font-medium mb-1">
          Brand colour
        </label>
        <div className="flex items-center gap-3">
          <input
            id="primaryColor"
            type="color"
            value={primaryColor || "#A0522D"}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-border bg-background"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#A0522D"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
        <p className="text-xs text-muted mt-1">Used on the public walk-in queue page.</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Logo</label>
        {logoUrl ? (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Shop logo" className="h-12 w-auto object-contain rounded bg-white/10 p-1" />
            <button
              type="button"
              onClick={() => setLogoUrl("")}
              className="text-sm text-muted hover:text-foreground"
            >
              Remove
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => logoFileInputRef.current?.click()}
          disabled={logoUploading}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {logoUploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
        </button>
        <input
          ref={logoFileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoFileChange}
          className="hidden"
          aria-label="Upload shop logo"
        />
        <p className="text-xs text-muted mt-1">PNG, JPEG, GIF, WebP, or SVG up to 2MB.</p>
      </div>
      {saveMsg === "saved" && <p className="text-sm text-green-400">Saved.</p>}
      {saveMsg === "error" && <p className="text-sm text-red-400">{saveErrorText}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
