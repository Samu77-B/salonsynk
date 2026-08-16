"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCreatePaysynkClient } from "../actions";

export function AdminNewPaysynkClientForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [approve, setApprove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTemporaryPassword(null);
    setLoading(true);
    const result = await adminCreatePaysynkClient({
      fullName,
      storeName,
      email,
      ...(password.trim() ? { password: password.trim() } : {}),
      approve,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data?.temporaryPassword) {
      setTemporaryPassword(result.data.temporaryPassword);
      setCreatedName(result.data.signup.name);
      return;
    }
    router.push("/admin/paysynk");
    router.refresh();
  }

  function handleCopyPassword() {
    if (!temporaryPassword) return;
    if (typeof navigator?.clipboard?.writeText === "function") {
      navigator.clipboard.writeText(temporaryPassword).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  if (temporaryPassword) {
    return (
      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">
          {createdName ? `${createdName} created.` : "Client created."} Copy this password now — it
          will not be shown again.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            readOnly
            value={temporaryPassword}
            className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-sm"
            aria-label="Temporary password"
          />
          <button
            type="button"
            onClick={handleCopyPassword}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            router.push("/admin/paysynk");
            router.refresh();
          }}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Back to PaySynk clients
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="mb-1 block text-sm font-medium">
          Owner name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="e.g. Alex Khan"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="storeName" className="mb-1 block text-sm font-medium">
          Store name
        </label>
        <input
          id="storeName"
          type="text"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          required
          placeholder="e.g. Khan Retail"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Owner email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="owner@shop.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password (optional)
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank to auto-generate"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-muted">
          If you leave this blank, PaySynk may return a temporary password after create.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={approve}
          onChange={(e) => setApprove(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Approve immediately
          <span className="mt-0.5 block text-xs text-muted">
            Pending shops are not public until approved.
          </span>
        </span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create client"}
      </button>
    </form>
  );
}
