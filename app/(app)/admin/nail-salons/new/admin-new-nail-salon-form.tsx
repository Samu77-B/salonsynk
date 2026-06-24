"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { adminCreateNailSalon, adminUploadNailSalonLogo } from "../actions";
import { NAIL_SITE } from "@core/config/nail-site";

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AdminNewNailSalonForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#D63384");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const joinQueueUrl = `${NAIL_SITE.url}/nail/join/${slug || "my-salon"}`;

  useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => setWarning(null), 8000);
    return () => clearTimeout(t);
  }, [warning]);

  function handleCopyJoinUrl() {
    if (typeof navigator?.clipboard?.writeText === "function") {
      navigator.clipboard.writeText(joinQueueUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWarning(null);
    setLoading(true);
    const result = await adminCreateNailSalon(
      name,
      slug || slugFromName(name),
      ownerEmail || undefined,
      {
        primary_color: primaryColor.trim() || undefined,
        company_name: name.trim(),
      }
    );
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }
    if (result.salonId && logoFile) {
      const formData = new FormData();
      formData.append("logo", logoFile);
      const uploadResult = await adminUploadNailSalonLogo(result.salonId, formData);
      if (uploadResult.error) {
        setLoading(false);
        setWarning(uploadResult.error);
        router.push(`/admin/nail-salons/${result.salonId}`);
        router.refresh();
        return;
      }
    }
    setLoading(false);
    if (result.ownerWarning) setWarning(result.ownerWarning);
    if (result.salonId) {
      router.push(`/admin/nail-salons/${result.salonId}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Salon name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slug) setSlug(slugFromName(e.target.value));
          }}
          required
          placeholder="e.g. Polished Nails"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium mb-1">
          URL slug (join queue page)
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder={slugFromName(name) || "my-salon"}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <input
            type="text"
            readOnly
            value={joinQueueUrl}
            className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground font-mono"
            aria-label="Join queue URL"
          />
          <button
            type="button"
            onClick={handleCopyJoinUrl}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="primaryColor" className="block text-sm font-medium mb-1">
          Brand colour
        </label>
        <div className="flex items-center gap-3">
          <input
            id="primaryColor"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-border bg-background"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
        <p className="text-xs text-muted mt-1">Colours the public walk-in queue page.</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Logo (optional)</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => logoFileInputRef.current?.click()}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium w-fit"
          >
            {logoFile ? logoFile.name : "Choose logo image"}
          </button>
          {logoFile && (
            <button
              type="button"
              onClick={() => setLogoFile(null)}
              className="text-sm text-muted hover:text-foreground w-fit"
            >
              Remove
            </button>
          )}
          <input
            ref={logoFileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="hidden"
            aria-label="Upload salon logo"
          />
        </div>
        <p className="text-xs text-muted mt-1">Shown on the walk-in queue page. PNG, JPEG, GIF, WebP, or SVG up to 2MB.</p>
      </div>
      <div>
        <label htmlFor="ownerEmail" className="block text-sm font-medium mb-1">
          Owner email (optional)
        </label>
        <input
          id="ownerEmail"
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="owner@nailsalon.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted mt-1">
          The user must already exist in Authentication. They will be added as salon owner.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {warning && <p className="text-sm text-amber-400">{warning}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Creating…" : "Add salon"}
      </button>
    </form>
  );
}
