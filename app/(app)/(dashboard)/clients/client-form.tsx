"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientAction } from "./actions";

const inputClass =
  "min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60";

export function ClientForm({
  salonId,
  clientId,
  initial,
  /** On the clients list: reset form and refresh instead of navigating away. */
  inlineOnCreate,
}: {
  salonId: string;
  clientId?: string;
  initial?: { name?: string; email?: string; phone?: string; notes?: string; sex?: string | null };
  inlineOnCreate?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showCancel = Boolean(clientId) || !inlineOnCreate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (clientId) {
      const { updateClientAction } = await import("./actions");
      const result = await updateClientAction(clientId, {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
        sex: sex || null,
      });
      if (result.error) setError(result.error);
      else router.push(`/clients/${clientId}`);
    } else {
      const result = await createClientAction({
        salonId,
        name: name || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        sex: sex || null,
      });
      if (result.error) setError(result.error);
      else if (inlineOnCreate) {
        setName("");
        setEmail("");
        setPhone("");
        setNotes("");
        setSex("");
        router.refresh();
      } else {
        router.push("/clients");
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="client-name" className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input
          id="client-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="client-email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="client-phone" className="mb-1 block text-sm font-medium">
            Phone
          </label>
          <input
            id="client-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="client-sex" className="mb-1 block text-sm font-medium">
            Sex
          </label>
          <select
            id="client-sex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className={inputClass}
          >
            <option value="">Not set</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="client-notes" className="mb-1 block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="client-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Colour history, preferences, or anything your team should know."
          className={`${inputClass} min-h-[4.5rem] resize-y`}
        />
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {showCancel && (
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Saving…" : clientId ? "Save" : "Add client"}
        </button>
      </div>
    </form>
  );
}
