"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCreateGymsynkClient } from "../actions";

export function AdminNewGymsynkClientForm() {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState("");
  const [gymName, setGymName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [createdLinks, setCreatedLinks] = useState<{
    loginUrl: string;
    joinUrl: string;
    embedUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTemporaryPassword(null);
    setLoading(true);
    const result = await adminCreateGymsynkClient({
      ownerName,
      gymName,
      email,
      ...(password.trim() ? { password: password.trim() } : {}),
      ...(slug.trim() ? { slug: slug.trim() } : {}),
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setCreatedName(result.data.tenant.name);
      setCreatedLinks({
        loginUrl: result.data.tenant.loginUrl,
        joinUrl: result.data.tenant.joinUrl,
        embedUrl: result.data.tenant.embedUrl,
      });
      setTemporaryPassword(result.data.temporaryPassword ?? null);
      return;
    }
    router.push("/admin/gymsynk");
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

  if (createdLinks) {
    return (
      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">
          {createdName ? `${createdName} created.` : "Gym created."}
          {temporaryPassword
            ? " Copy this password now — it will not be shown again."
            : " The owner can sign in with the password you set."}
        </p>
        {temporaryPassword ? (
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
        ) : null}
        <ul className="space-y-1 text-sm">
          <li>
            <a href={createdLinks.loginUrl} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
              Owner login
            </a>
          </li>
          <li>
            <a href={createdLinks.joinUrl} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
              Join page
            </a>
          </li>
          <li>
            <a href={createdLinks.embedUrl} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
              Schedule embed
            </a>
          </li>
        </ul>
        <button
          type="button"
          onClick={() => {
            router.push("/admin/gymsynk");
            router.refresh();
          }}
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Back to GymSynk clients
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="ownerName" className="mb-1 block text-sm font-medium">
          Owner name
        </label>
        <input
          id="ownerName"
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          required
          placeholder="e.g. Alex Khan"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="gymName" className="mb-1 block text-sm font-medium">
          Gym name
        </label>
        <input
          id="gymName"
          type="text"
          value={gymName}
          onChange={(e) => setGymName(e.target.value)}
          required
          placeholder="e.g. Reset Studios"
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
          placeholder="owner@gym.example"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="slug" className="mb-1 block text-sm font-medium">
          Slug <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="reset-studios"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted">
          Used in public URLs. Leave blank to build one from the gym name. For the marketing demo,
          a short slug such as demo is easiest to link from gymsynk.net.
        </p>
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          placeholder="Leave blank to generate one"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create gym"}
      </button>
    </form>
  );
}
