"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAddBarberShopOwner } from "../actions";

export function AdminAddBarberOwnerForm({ shopId }: { shopId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const result = await adminAddBarberShopOwner(shopId, email);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEmail("");
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="ownerEmail" className="block text-sm font-medium mb-1">
          Add owner by email
        </label>
        <input
          id="ownerEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="owner@barbershop.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Adding…" : "Add owner"}
      </button>
      {error && <p className="text-sm text-red-400 sm:basis-full">{error}</p>}
      {success && (
        <p className="text-sm text-green-400 sm:basis-full">Owner linked successfully.</p>
      )}
    </form>
  );
}
