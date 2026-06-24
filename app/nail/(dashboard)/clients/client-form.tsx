"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNailClientAction } from "./actions";

const inputClass =
  "min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60";

export function NailClientForm({
  salonId,
  clientId,
  initial,
  inlineOnCreate,
}: {
  salonId: string;
  clientId?: string;
  initial?: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
  };
  inlineOnCreate?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showCancel = Boolean(clientId) || !inlineOnCreate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (clientId) {
      const { updateNailClientAction } = await import("./actions");
      const result = await updateNailClientAction(clientId, {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      });
      if (result.error) setError(result.error);
      else router.push(`/nail/clients/${clientId}`);
    } else {
      const result = await createNailClientAction({
        salonId,
        name: name || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      const newId = result.clientId;
      if (!newId) {
        setError("Client was created but we could not read the new id.");
        setLoading(false);
        if (!inlineOnCreate) router.push("/nail/clients");
        else router.refresh();
        return;
      }
      if (inlineOnCreate) {
        setName("");
        setEmail("");
        setPhone("");
        setNotes("");
        router.refresh();
      } else {
        router.push(`/nail/clients/${newId}`);
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="nail-client-name" className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input
          id="nail-client-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="nail-client-email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="nail-client-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="nail-client-phone" className="mb-1 block text-sm font-medium">
            Phone
          </label>
          <input
            id="nail-client-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="nail-client-notes" className="mb-1 block text-sm font-medium">
          Notes
        </label>
        <textarea
          id="nail-client-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Preferences, allergies, or anything your team should know."
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
