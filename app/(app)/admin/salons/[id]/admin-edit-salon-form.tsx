"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  adminUpdateSalon,
  adminUploadSalonLogo,
  adminAssignOwner,
  adminInviteOwner,
  adminCreateOwnerWithPassword,
  adminResendOwnerInvite,
  adminAssignStaff,
  adminInviteStaff,
  adminCreateStaffWithPassword,
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
  const [resendEmail, setResendEmail] = useState("");
  const [resendMsg, setResendMsg] = useState<"saved" | "error" | null>(null);
  const [resendErrorText, setResendErrorText] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createMsg, setCreateMsg] = useState<"saved" | "error" | null>(null);
  const [createErrorText, setCreateErrorText] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [staffCreateEmail, setStaffCreateEmail] = useState("");
  const [staffCreatePassword, setStaffCreatePassword] = useState("");
  const [staffCreateName, setStaffCreateName] = useState("");
  const [staffCreateMsg, setStaffCreateMsg] = useState<"saved" | "error" | null>(null);
  const [staffCreateErrorText, setStaffCreateErrorText] = useState("");
  const [staffCreateLoading, setStaffCreateLoading] = useState(false);

  const [staffInviteEmail, setStaffInviteEmail] = useState("");
  const [staffInviteName, setStaffInviteName] = useState("");
  const [staffInviteMsg, setStaffInviteMsg] = useState<"saved" | "error" | null>(null);
  const [staffInviteErrorText, setStaffInviteErrorText] = useState("");
  const [staffInviteLoading, setStaffInviteLoading] = useState(false);

  const [staffAssignEmail, setStaffAssignEmail] = useState("");
  const [staffAssignMsg, setStaffAssignMsg] = useState<"saved" | "error" | null>(null);
  const [staffAssignLoading, setStaffAssignLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
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

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveMsg(null);
    setLogoUploading(true);
    const formData = new FormData();
    formData.append("logo", file);
    const result = await adminUploadSalonLogo(salonId, formData);
    setLogoUploading(false);
    if (result.error) setSaveMsg("error");
    else if (result.url) {
      setLogoUrl(result.url);
      setSaveMsg("saved");
    }
    e.target.value = "";
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

  async function handleAssignStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!staffAssignEmail.trim()) return;
    setStaffAssignMsg(null);
    setStaffAssignLoading(true);
    const result = await adminAssignStaff(salonId, staffAssignEmail, "staff");
    setStaffAssignLoading(false);
    setStaffAssignMsg(result.error ? "error" : "saved");
    if (!result.error) setStaffAssignEmail("");
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
            aria-label="Business name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">URL slug</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="URL slug"
          />
          <p className="text-xs text-muted mt-1">
            /book/{slug || "…"} · /shop/{slug || "…"}
          </p>
        </div>

        <h2 className="text-lg font-semibold pt-4">Branding</h2>
        <p className="text-sm text-muted">
          Used on the public booking and shop pages so clients see the salon&apos;s brand.
        </p>
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
            <button
              type="button"
              onClick={() => logoFileInputRef.current?.click()}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium shrink-0 disabled:opacity-50"
              disabled={logoUploading}
              title="Upload logo image from your device"
            >
              {logoUploading ? "Uploading…" : "Upload logo"}
            </button>
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoFileChange}
              className="hidden"
              aria-label="Upload logo image"
              title="Upload logo image"
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
            <h3 className="text-sm font-medium mb-1">Create owner (no email verification)</h3>
            <p className="text-xs text-muted mb-2">Set email and password directly. They can log in immediately.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!createEmail.trim() || !createPassword.trim()) return;
                setCreateMsg(null);
                setCreateErrorText("");
                setCreateLoading(true);
                const result = await adminCreateOwnerWithPassword(salonId, createEmail, createPassword, createName || undefined);
                setCreateLoading(false);
                setCreateMsg(result.error ? "error" : "saved");
                if (result.error) setCreateErrorText(result.error);
                else {
                  setCreateEmail("");
                  setCreatePassword("");
                  setCreateName("");
                }
              }}
              className="flex flex-wrap gap-2 items-end"
            >
              <div>
                <label htmlFor="create-email" className="sr-only">Email</label>
                <input
                  id="create-email"
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="kc@fabhair.london"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
                  required
                />
              </div>
              <div>
                <label htmlFor="create-password" className="sr-only">Password</label>
                <input
                  id="create-password"
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-40"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label htmlFor="create-name" className="sr-only">Name</label>
                <input
                  id="create-name"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Name (optional)"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-32"
                />
              </div>
              <button
                type="submit"
                disabled={createLoading || !createEmail.trim() || !createPassword.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {createLoading ? "Creating…" : "Create owner"}
              </button>
            </form>
            {createMsg === "saved" && <p className="text-sm text-green-400 mt-2">Owner created. They can log in with that email and password.</p>}
            {createMsg === "error" && <p className="text-sm text-red-400 mt-2">{createErrorText || "Could not create."}</p>}
          </div>
          <div>
            <h3 className="text-sm font-medium mb-1">Invite new owner (sends email)</h3>
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
          <div>
            <h3 className="text-sm font-medium mb-1">Resend invite link</h3>
            <p className="text-xs text-muted mb-2">Send a new invite link (e.g. after fixing the Site URL). Uses production URL.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!resendEmail.trim()) return;
                setResendMsg(null);
                setResendErrorText("");
                setResendLoading(true);
                const result = await adminResendOwnerInvite(salonId, resendEmail);
                setResendLoading(false);
                setResendMsg(result.error ? "error" : "saved");
                if (result.error) setResendErrorText(result.error);
                else setResendEmail("");
              }}
              className="flex gap-2 flex-wrap items-end"
            >
              <div>
                <label htmlFor="resend-email" className="sr-only">Email</label>
                <input
                  id="resend-email"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="kiri@fabhair.london"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={resendLoading || !resendEmail.trim()}
                className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
              >
                {resendLoading ? "Sending…" : "Resend invite"}
              </button>
            </form>
            {resendMsg === "saved" && <p className="text-sm text-green-400 mt-2">New invite link sent to that email.</p>}
            {resendMsg === "error" && <p className="text-sm text-red-400 mt-2">{resendErrorText || "Could not send."}</p>}
          </div>
        </div>
      </section>

      <section className="pt-8 border-t border-border">
        <h2 className="text-lg font-semibold mb-2">Staff logins (general salon)</h2>
        <p className="text-xs text-muted mb-4">
          Create the shared front-desk/general login here as <strong>staff</strong> (non-manager). Staff will only see Diary, Clients,
          Checkout and Help, and will be prompted for their name + PIN for sensitive actions.
        </p>

        {owners.filter((m) => m.role !== "owner").length > 0 && (
          <ul className="text-sm text-muted mb-4">
            {owners
              .filter((m) => m.role !== "owner")
              .map((m) => (
                <li key={m.id}>
                  {m.display_name ?? "—"} ({m.email ?? "—"}) — {m.role}
                </li>
              ))}
          </ul>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Create staff login (no email verification)</h3>
            <p className="text-xs text-muted mb-2">Set email and password directly. They can log in immediately.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!staffCreateEmail.trim() || !staffCreatePassword.trim()) return;
                setStaffCreateMsg(null);
                setStaffCreateErrorText("");
                setStaffCreateLoading(true);
                const result = await adminCreateStaffWithPassword(
                  salonId,
                  staffCreateEmail,
                  staffCreatePassword,
                  staffCreateName || undefined,
                  "staff"
                );
                setStaffCreateLoading(false);
                setStaffCreateMsg(result.error ? "error" : "saved");
                if (result.error) setStaffCreateErrorText(result.error);
                else {
                  setStaffCreateEmail("");
                  setStaffCreatePassword("");
                  setStaffCreateName("");
                }
              }}
              className="flex flex-wrap gap-2 items-end"
            >
              <div>
                <label htmlFor="staff-create-email" className="sr-only">Email</label>
                <input
                  id="staff-create-email"
                  type="email"
                  value={staffCreateEmail}
                  onChange={(e) => setStaffCreateEmail(e.target.value)}
                  placeholder="frontdesk@salon.com"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
                  required
                />
              </div>
              <div>
                <label htmlFor="staff-create-password" className="sr-only">Password</label>
                <input
                  id="staff-create-password"
                  type="password"
                  value={staffCreatePassword}
                  onChange={(e) => setStaffCreatePassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-40"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label htmlFor="staff-create-name" className="sr-only">Name</label>
                <input
                  id="staff-create-name"
                  type="text"
                  value={staffCreateName}
                  onChange={(e) => setStaffCreateName(e.target.value)}
                  placeholder="Front Desk (optional)"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-40"
                />
              </div>
              <button
                type="submit"
                disabled={staffCreateLoading || !staffCreateEmail.trim() || !staffCreatePassword.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {staffCreateLoading ? "Creating…" : "Create staff"}
              </button>
            </form>
            {staffCreateMsg === "saved" && <p className="text-sm text-green-400 mt-2">Staff login created. They can log in with that email and password.</p>}
            {staffCreateMsg === "error" && <p className="text-sm text-red-400 mt-2">{staffCreateErrorText || "Could not create."}</p>}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1">Invite staff (sends email)</h3>
            <p className="text-xs text-muted mb-2">Sends them an email to create their login.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!staffInviteEmail.trim()) return;
                setStaffInviteMsg(null);
                setStaffInviteErrorText("");
                setStaffInviteLoading(true);
                const result = await adminInviteStaff(salonId, staffInviteEmail, staffInviteName || undefined, "staff");
                setStaffInviteLoading(false);
                setStaffInviteMsg(result.error ? "error" : "saved");
                if (result.error) setStaffInviteErrorText(result.error);
                else {
                  setStaffInviteEmail("");
                  setStaffInviteName("");
                }
              }}
              className="flex flex-wrap gap-2 items-end"
            >
              <div>
                <label htmlFor="staff-invite-email" className="sr-only">Email</label>
                <input
                  id="staff-invite-email"
                  type="email"
                  value={staffInviteEmail}
                  onChange={(e) => setStaffInviteEmail(e.target.value)}
                  placeholder="frontdesk@salon.com"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
                  required
                />
              </div>
              <div>
                <label htmlFor="staff-invite-name" className="sr-only">Name</label>
                <input
                  id="staff-invite-name"
                  type="text"
                  value={staffInviteName}
                  onChange={(e) => setStaffInviteName(e.target.value)}
                  placeholder="Front Desk (optional)"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-40"
                />
              </div>
              <button
                type="submit"
                disabled={staffInviteLoading || !staffInviteEmail.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {staffInviteLoading ? "Sending…" : "Invite staff"}
              </button>
            </form>
            {staffInviteMsg === "saved" && <p className="text-sm text-green-400 mt-2">Invite sent. They will receive an email to create their login.</p>}
            {staffInviteMsg === "error" && <p className="text-sm text-red-400 mt-2">{staffInviteErrorText || "Could not send invite."}</p>}
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1">Add existing staff (already has account)</h3>
            <form onSubmit={handleAssignStaff} className="flex gap-2 flex-wrap items-end">
              <div>
                <label htmlFor="staff-email" className="sr-only">Email</label>
                <input
                  id="staff-email"
                  type="email"
                  value={staffAssignEmail}
                  onChange={(e) => setStaffAssignEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
                />
              </div>
              <button
                type="submit"
                disabled={staffAssignLoading || !staffAssignEmail.trim()}
                className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50"
              >
                {staffAssignLoading ? "Adding…" : "Add staff"}
              </button>
            </form>
            {staffAssignMsg === "saved" && <p className="text-sm text-green-400 mt-2">Staff added.</p>}
            {staffAssignMsg === "error" && <p className="text-sm text-red-400 mt-2">Could not add (user may not exist).</p>}
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
