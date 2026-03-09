"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminUpdateSalon,
  adminAssignOwner,
  adminInviteOwner,
  adminDeleteSalon,
  type BrandingInput,
} from "../actions";

type Member = {
  id: string;
  role: string;
  display_name: string | null;
  email: string | null;
};

export function AdminEditSalonForm({
  salonId,
  initialName,
  initialSlug,
  initialBranding,
  owners,
}: {
  salonId: string;
  initialName: string;
  initialSlug: string;
  initialBranding: { logo_url: string; primary_color: string; company_name: string };
  owners: Member[];
}) {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [logoUrl, setLogoUrl] = useState(initialBranding.logo_url);
  const [primaryColor, setPrimaryColor] = useState(initialBranding.primary_color);
  const [companyName, setCompanyName] = useState(initialBranding.company_name);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [saveMsg, setSaveMsg] = useState<"saved" | "error" | null>(null);
  const [assignMsg, setAssignMsg] = useState<"saved" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteMsg, setInviteMsg] = useState<"saved" | "error" | null>(null);
  const [inviteErrorText, setInviteErrorText] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    setLoading(true);
    const branding: BrandingInput = {};
    if (logoUrl.trim()) branding.logo_url = logoUrl.trim();
    if (primaryColor.trim()) branding.primary_color = primaryColor.trim();
    if (companyName.trim()) branding.company_name = companyName.trim();
    const result = await adminUpdateSalon(salonId, {
      name: name.trim(),
      slug: slug.trim(),
      branding: Object.keys(branding).length ? branding : undefined,
    });
    setLoading(false);
    setSaveMsg(result.error ? "error" : "saved");
  }

  async function handleAssignOwner(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerEmail.trim()) return;
    setAssignMsg(null);
    setAssignLoading(true);
    const result = await adminAssignOwner(salonId, ownerEmail);
    setAssignLoading(false);
    setAssignMsg(result.error ? "error" : "saved");
    if (!result.error) setOwnerEmail("");
  }

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Business name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">URL slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted mt-1">/book/{slug || "…"}</p>
        </div>

        <h2 className="text-lg font-semibold pt-4">Branding</h2>
        <p className="text-sm text-muted">
          Used on the public booking page so clients see the salon&apos;s brand.
        </p>
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
        {saveMsg === "saved" && (
          <p className="text-sm text-green-400">Settings saved.</p>
        )}
        {saveMsg === "error" && (
          <p className="text-sm text-red-400">Failed to save.</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
      </form>

      <section>
        <h2 className="text-lg font-semibold mb-2">Owners</h2>
        {owners.length > 0 && (
          <ul className="text-sm text-muted mb-4">
            {owners
              .filter((m) => m.role === "owner")
              .map((m) => (
                <li key={m.id}>
                  {m.display_name ?? "—"} ({m.email ?? "—"})
                </li>
              ))}
          </ul>
        )}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Invite new owner (no account yet)</h3>
            <p className="text-xs text-muted mb-2">Sends them an email to create their login. They become owner when they sign up.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!inviteEmail.trim()) return;
                setInviteMsg(null);
                setInviteErrorText("");
                setInviteLoading(true);
                const result = await adminInviteOwner(salonId, inviteEmail, inviteName || undefined);
                setInviteLoading(false);
                setInviteMsg(result.error ? "error" : "saved");
                if (result.error) setInviteErrorText(result.error);
                else {
                  setInviteEmail("");
                  setInviteName("");
                }
              }}
              className="flex flex-wrap gap-2 items-end"
            >
              <div>
                <label htmlFor="invite-email" className="sr-only">Email</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="kiri@fabhair.london"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
                  required
                />
              </div>
              <div>
                <label htmlFor="invite-name" className="sr-only">Name</label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Kiri (optional)"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-40"
                />
              </div>
              <button
                type="submit"
                disabled={inviteLoading || !inviteEmail.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {inviteLoading ? "Sending…" : "Invite owner"}
              </button>
            </form>
            {inviteMsg === "saved" && <p className="text-sm text-green-400 mt-2">Invite sent. They will receive an email to create their login.</p>}
            {inviteMsg === "error" && <p className="text-sm text-red-400 mt-2">{inviteErrorText || "Could not send invite."}</p>}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">Add existing owner (already has account)</h3>
            <form onSubmit={handleAssignOwner} className="flex gap-2 flex-wrap items-end">
              <div>
                <label htmlFor="owner-email" className="sr-only">Email</label>
                <input
                  id="owner-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
                />
              </div>
              <button
                type="submit"
                disabled={assignLoading || !ownerEmail.trim()}
                className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
              >
                {assignLoading ? "Adding…" : "Add owner"}
              </button>
            </form>
            {assignMsg === "saved" && <p className="text-sm text-green-400 mt-2">Owner added.</p>}
            {assignMsg === "error" && <p className="text-sm text-red-400 mt-2">Could not add (user may not exist).</p>}
          </div>
        </div>
      </section>

      <section className="pt-8 border-t border-border">
        <h2 className="text-lg font-semibold mb-2 text-red-400">Danger zone</h2>
        <p className="text-sm text-muted mb-2">
          Permanently delete this salon and all its data (appointments, clients, team, services). This cannot be undone.
        </p>
        {deleteError && <p className="text-sm text-red-400 mb-2">Failed to delete salon.</p>}
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`Delete "${initialName}"? This will remove all appointments, clients, team members, and services.`)) return;
            setDeleteError(false);
            setDeleteLoading(true);
            const result = await adminDeleteSalon(salonId);
            setDeleteLoading(false);
            if (result.error) {
              setDeleteError(true);
            } else {
              router.push("/admin/salons");
            }
          }}
          disabled={deleteLoading}
          className="rounded-lg border border-red-400/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
        >
          {deleteLoading ? "Deleting…" : "Delete salon"}
        </button>
      </section>
    </div>
  );
}
