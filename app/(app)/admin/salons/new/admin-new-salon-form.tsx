"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminCreateSalon, adminUploadSalonLogo } from "../actions";

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AdminNewSalonForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const bookingPageUrl = origin ? `${origin}/book/${slug || "my-salon"}` : "";

  function handleCopyBookingUrl() {
    if (bookingPageUrl && typeof navigator?.clipboard?.writeText === "function") {
      navigator.clipboard.writeText(bookingPageUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await adminCreateSalon(name, slug || slugFromName(name), ownerEmail || undefined);
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }
    if (result.salonId && logoFile) {
      const formData = new FormData();
      formData.append("logo", logoFile);
      const uploadResult = await adminUploadSalonLogo(result.salonId, formData);
      if (uploadResult.error) {
        setError(uploadResult.error);
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    if (result.salonId) {
      router.push(`/admin/salons/${result.salonId}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Business name
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
          placeholder="e.g. The Hair Studio"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium mb-1">
          URL slug (booking link)
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
            value={bookingPageUrl}
            placeholder={origin ? "" : "Loading…"}
            className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
            aria-label="Booking page URL"
          />
          <button
            type="button"
            onClick={handleCopyBookingUrl}
            disabled={!bookingPageUrl}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
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
          placeholder="owner@salon.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted mt-1">
          If the user has already signed up, they will be added as owner.
        </p>
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
            aria-label="Upload logo image"
          />
        </div>
        <p className="text-xs text-muted mt-1">
          PNG, JPEG, GIF, WebP, or SVG up to 2MB. Used on the public booking page.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create salon"}
      </button>
    </form>
  );
}
