"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage({ type: "error", text: error.message });
        return;
      }
      router.refresh();
      router.push(next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          New password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
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
        {loading ? "Saving…" : "Set password & continue"}
      </button>
    </form>
  );
}
