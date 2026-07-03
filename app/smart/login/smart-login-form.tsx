"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import type { PlatformMembership } from "@core/auth/resolve-user-platform";

type SmartRedirectResponse =
  | { type: "redirect"; url: string }
  | { type: "local"; path: string }
  | { type: "picker"; memberships: PlatformMembership[] }
  | { type: "error"; message: string };

export function SmartLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [memberships, setMemberships] = useState<PlatformMembership[] | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPlatform = searchParams.get("from");

  async function completeRedirect(platform?: string) {
    const res = await fetch("/api/auth/smart-redirect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    const data = (await res.json()) as SmartRedirectResponse;

    if (data.type === "error") {
      setMessage({ type: "error", text: data.message });
      return;
    }

    if (data.type === "picker") {
      setMemberships(data.memberships);
      return;
    }

    if (data.type === "local") {
      router.refresh();
      router.push(data.path);
      return;
    }

    if (data.type === "redirect") {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = data.url;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setMemberships(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }

      const preferredPlatform =
        fromPlatform === "salon" || fromPlatform === "barber" || fromPlatform === "nail"
          ? fromPlatform
          : undefined;

      await completeRedirect(preferredPlatform);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  }

  async function handlePlatformPick(platform: string) {
    setLoading(true);
    setMessage(null);
    try {
      await completeRedirect(platform);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  }

  const PLATFORM_LABELS: Record<string, string> = {
    salon: "SalonSynk",
    barber: "BarberSynk",
    nail: "NailSynk",
  };

  if (memberships && memberships.length > 1) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Choose which platform to open:</p>
        <ul className="space-y-2">
          {memberships.map((m) => (
            <li key={`${m.platform}-${m.tenantId}`}>
              <button
                type="button"
                disabled={loading}
                onClick={() => handlePlatformPick(m.platform)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground hover:border-accent/50 transition-colors disabled:opacity-50"
              >
                <span className="font-medium">{PLATFORM_LABELS[m.platform]}</span>
                <span className="block text-xs text-muted mt-0.5">{m.tenantName}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      {message && (
        <p className={`text-sm ${message.type === "error" ? "text-red-400" : "text-green-400"}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
