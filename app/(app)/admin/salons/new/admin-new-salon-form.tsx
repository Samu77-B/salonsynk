"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCreateSalon } from "../actions";

export function AdminNewSalonForm({
  slugFromName,
}: {
  slugFromName: (name: string) => string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await adminCreateSalon(name, slug || slugFromName(name), ownerEmail || undefined);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
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
        <p className="text-xs text-muted mt-1">/book/{slug || "my-salon"}</p>
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
