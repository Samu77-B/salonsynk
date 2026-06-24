"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAddNailSalonOwner, adminCreateNailOwnerWithPassword } from "../actions";

export function AdminAddNailOwnerForm({ salonId }: { salonId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg] = useState<"saved" | "error" | null>(null);
  const [createErrorText, setCreateErrorText] = useState("");

  async function handleLinkExisting(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const result = await adminAddNailSalonOwner(salonId, email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEmail("");
    setSuccess(true);
    router.refresh();
  }

  async function handleCreateLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!createEmail.trim() || !createPassword.trim()) return;
    setCreateMsg(null);
    setCreateErrorText("");
    setCreateLoading(true);
    const result = await adminCreateNailOwnerWithPassword(
      salonId,
      createEmail,
      createPassword,
      createName || undefined
    );
    setCreateLoading(false);
    if (result.error) {
      setCreateMsg("error");
      setCreateErrorText(result.error);
      return;
    }
    setCreateMsg("saved");
    setCreateEmail("");
    setCreatePassword("");
    setCreateName("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1">Create owner login</h3>
        <p className="text-xs text-muted mb-2">
          Set an email and password for your client. They can sign in at nailsynk.com/login
          immediately — no email verification.
        </p>
        <form
          onSubmit={handleCreateLogin}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="flex-1 min-w-[12rem]">
            <label htmlFor="createOwnerEmail" className="block text-xs text-muted mb-1">
              Email (their login)
            </label>
            <input
              id="createOwnerEmail"
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              required
              placeholder="owner@nailsalon.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[10rem]">
            <label htmlFor="createOwnerPassword" className="block text-xs text-muted mb-1">
              Password
            </label>
            <input
              id="createOwnerPassword"
              type="password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              required
              minLength={6}
              placeholder="Min 6 characters"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[8rem]">
            <label htmlFor="createOwnerName" className="block text-xs text-muted mb-1">
              Name (optional)
            </label>
            <input
              id="createOwnerName"
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Sarah"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={createLoading || !createEmail.trim() || !createPassword.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {createLoading ? "Creating…" : "Create login"}
          </button>
        </form>
        {createMsg === "saved" && (
          <p className="text-sm text-green-400 mt-2">
            Login created. Share the email and password with your client.
          </p>
        )}
        {createMsg === "error" && (
          <p className="text-sm text-red-400 mt-2">{createErrorText || "Could not create login."}</p>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-medium mb-1">Link existing account</h3>
        <p className="text-xs text-muted mb-2">
          If they already have an account in Supabase, add them as owner by email.
        </p>
        <form onSubmit={handleLinkExisting} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="ownerEmail" className="sr-only">
              Add owner by email
            </label>
            <input
              id="ownerEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="owner@nailsalon.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add owner"}
          </button>
          {error && <p className="text-sm text-red-400 sm:basis-full">{error}</p>}
          {success && (
            <p className="text-sm text-green-400 sm:basis-full">Owner linked successfully.</p>
          )}
        </form>
      </div>
    </div>
  );
}
