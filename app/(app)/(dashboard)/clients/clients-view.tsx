"use client";

import Link from "next/link";
import { ClientForm } from "./client-form";

export type ClientListRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  patch_test_due_at: string | null;
};

function ClientCard({ client }: { client: ClientListRow }) {
  const display = client.name?.trim() || client.email?.trim() || client.phone?.trim() || "No name";
  const contact = [client.email, client.phone].filter(Boolean).join(" · ");

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div>
        <h3 className="text-base font-semibold leading-snug">{display}</h3>
        {contact ? <p className="mt-1 truncate text-sm text-muted">{contact}</p> : null}
      </div>
      {client.patch_test_due_at ? (
        <p className="text-xs text-amber-400">
          Patch test due: {new Date(client.patch_test_due_at).toLocaleDateString("en-GB")}
        </p>
      ) : null}
      <div className="mt-auto border-t border-border pt-3">
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          View and edit
        </Link>
      </div>
    </article>
  );
}

export function ClientsView({ salonId, clients }: { salonId: string; clients: ClientListRow[] }) {
  return (
    <section className="space-y-6">
      <p className="text-sm text-muted">
        Add clients here or open a card to edit details, notes, and colour formulas. Each person appears as a{" "}
        <span className="font-medium text-foreground">card</span> in the grid below.
      </p>

      <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-base font-semibold">Add a client</h2>
        <ClientForm salonId={salonId} inlineOnCreate />
      </div>

      {clients.length > 0 ? (
        <div>
          <h2 className="mb-3 text-base font-semibold">Your clients</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">No clients yet. Use the form above to add your first one.</p>
      )}
    </section>
  );
}
