"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminUpdateNailSalon,
  adminUploadNailSalonLogo,
  type NailBrandingInput,
} from "../actions";

export function AdminEditNailSalonForm({
  salonId,
  initialName,
  initialSlug,
  initialBranding,
}: {
  salonId: string;
  initialName: string;
  initialSlug: string;
  initialBranding: {
    logo_url: string;
    primary_color: string;
    company_name: string;
    show_title_on_queue: boolean;
    next_available_only: boolean;
    show_services_on_queue: boolean;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [logoUrl, setLogoUrl] = useState(initialBranding.logo_url);
  const [primaryColor, setPrimaryColor] = useState(initialBranding.primary_color);
  const [companyName, setCompanyName] = useState(initialBranding.company_name);
  const [showTitleOnQueue, setShowTitleOnQueue] = useState(initialBranding.show_title_on_queue);
  const [nextAvailableOnly, setNextAvailableOnly] = useState(initialBranding.next_available_only);
  const [showServicesOnQueue, setShowServicesOnQueue] = useState(initialBranding.show_services_on_queue);
  const [saveMsg, setSaveMsg] = useState<"saved" | "error" | null>(null);
  const [saveErrorText, setSaveErrorText] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    setLoading(true);
    const branding: NailBrandingInput = {
      show_title_on_queue: showTitleOnQueue,
      next_available_only: nextAvailableOnly,
      show_services_on_queue: showServicesOnQueue,
    };
    if (logoUrl.trim()) branding.logo_url = logoUrl.trim();
    if (primaryColor.trim()) branding.primary_color = primaryColor.trim();
    if (companyName.trim()) branding.company_name = companyName.trim();
    const result = await adminUpdateNailSalon(salonId, {
      name: name.trim(),
      slug: slug.trim(),
      branding,
    });
    setLoading(false);
    if (result.error) {
      setSaveErrorText(result.error);
      setSaveMsg("error");
      return;
    }
    setSaveMsg("saved");
    router.refresh();
  }

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveMsg(null);
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const result = await adminUploadNailSalonLogo(salonId, formData);
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
        <label htmlFor="salonName" className="block text-sm font-medium mb-1">
          Salon name
        </label>
        <input
          id="salonName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="salonSlug" className="block text-sm font-medium mb-1">
          URL slug
        </label>
        <input
          id="salonSlug"
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
        <p className="text-xs text-muted mt-1">Shown as the main heading on the walk-in queue page.</p>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showTitleOnQueue}
          onChange={(e) => setShowTitleOnQueue(e.target.checked)}
          className="rounded border-border"
        />
        Show salon title on public queue page
      </label>
      <p className="text-xs text-muted -mt-2">
        Turn off to show only your logo (useful if the logo already includes the salon name).
      </p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={nextAvailableOnly}
          onChange={(e) => setNextAvailableOnly(e.target.checked)}
          className="rounded border-border"
        />
        Next available technician only on join queue
      </label>
      <p className="text-xs text-muted -mt-2">
        Customers won&apos;t pick a named technician — they&apos;ll only see &quot;Next available technician&quot;.
      </p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showServicesOnQueue}
          onChange={(e) => setShowServicesOnQueue(e.target.checked)}
          className="rounded border-border"
        />
        Show service dropdown on join queue
      </label>
      <p className="text-xs text-muted -mt-2">
        Turn off if customers should only enter their name and phone (no service selection).
      </p>
      <div>
        <label htmlFor="primaryColor" className="block text-sm font-medium mb-1">
          Brand colour
        </label>
        <div className="flex items-center gap-3">
          <input
            id="primaryColor"
            type="color"
            value={primaryColor || "#D63384"}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-border bg-background"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#D63384"
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
            <img src={logoUrl} alt="Salon logo" className="h-12 w-auto object-contain rounded bg-white/10 p-1" />
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
          aria-label="Upload salon logo"
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
