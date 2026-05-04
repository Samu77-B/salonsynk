"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientForm } from "./client-form";
import { importClientsFromCsv, type CsvImportRowError } from "./actions";

export type ClientListRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  sex: string | null;
  patch_test_due_at: string | null;
  last_skin_test_at?: string | null;
  profile_photo_url: string | null;
};

function ClientAvatar({ client }: { client: ClientListRow }) {
  const src = client.profile_photo_url
    ?? (client.sex === "male" ? "/imgs/His.png" : "/imgs/Her.png");
  const hasPhoto = !!client.profile_photo_url;

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-background/50">
      <Image
        src={src}
        alt={client.name || "Client"}
        fill
        className={`object-cover ${hasPhoto ? "" : "opacity-40"}`}
        sizes="40px"
      />
    </div>
  );
}

function ClientCard({ client }: { client: ClientListRow }) {
  const display = client.name?.trim() || client.email?.trim() || client.phone?.trim() || "No name";
  const contact = [client.email, client.phone].filter(Boolean).join(" · ");

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <ClientAvatar client={client} />
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug">{display}</h3>
          {contact ? <p className="mt-0.5 truncate text-sm text-muted">{contact}</p> : null}
        </div>
      </div>
      {client.patch_test_due_at ? (
        <p className="text-xs text-amber-400">
          Patch test due: {new Date(client.patch_test_due_at).toLocaleDateString("en-GB")}
        </p>
      ) : null}
      {client.last_skin_test_at && (() => {
        const monthsSince = Math.floor((Date.now() - new Date(client.last_skin_test_at!).getTime()) / (30.44 * 24 * 60 * 60 * 1000));
        if (monthsSince >= 12) return <p className="text-xs text-red-400">Skin test expired ({monthsSince} months ago)</p>;
        return null;
      })()}
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

const CSV_TEMPLATE = `name,email,phone,sex,notes,marketing_opt_in
Jane Example,jane@example.com,07700900000,female,Prefers Saturday afternoons,yes
John Example,john@example.com,+447700900111,male,,no
`;

function ImportClientsPanel({ salonId }: { salonId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<CsvImportRowError[]>([]);

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clients-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSummary(null);
    setRowErrors([]);
    setLoading(true);
    try {
      const text = await file.text();
      const result = await importClientsFromCsv(salonId, text);
      if (result.error) {
        setSummary(result.error);
        setRowErrors(result.rowErrors);
      } else {
        const parts = [`Imported ${result.added} client${result.added === 1 ? "" : "s"}.`];
        if (result.skipped > 0) {
          parts.push(`${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped.`);
        }
        if (result.rowErrors.length) {
          parts.push(`${result.rowErrors.length} row${result.rowErrors.length === 1 ? "" : "s"} had errors (see below).`);
        }
        setSummary(parts.join(" "));
        setRowErrors(result.rowErrors);
        if (result.added > 0) router.refresh();
      }
    } catch (err) {
      setSummary(err instanceof Error ? err.message : "Could not read CSV.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background/60 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">Import clients (CSV)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-border px-3 py-1.5 text-sm"
          >
            Download template
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Choose a CSV file to import clients"
            onChange={handleFile}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {loading ? "Importing…" : "Import CSV"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Columns: <span className="font-mono text-xs">name</span>, <span className="font-mono text-xs">email</span>,{" "}
        <span className="font-mono text-xs">phone</span>, <span className="font-mono text-xs">sex</span> (male/female),{" "}
        <span className="font-mono text-xs">notes</span>, <span className="font-mono text-xs">marketing_opt_in</span>{" "}
        (yes/no, defaults to yes). Each row needs at least one of name, email, or phone. Up to 2,000 rows. Rows that
        match an existing email or phone in this salon are skipped.
      </p>
      {summary ? <p className="mt-2 text-sm text-muted">{summary}</p> : null}
      {rowErrors.length > 0 ? (
        <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs text-red-400">
          {rowErrors.slice(0, 20).map((r) => (
            <li key={`${r.line}-${r.message}`}>
              Line {r.line}: {r.message}
            </li>
          ))}
          {rowErrors.length > 20 ? <li>…and {rowErrors.length - 20} more</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

export function ClientsView({ salonId, clients }: { salonId: string; clients: ClientListRow[] }) {
  return (
    <section className="space-y-6">
      <ImportClientsPanel salonId={salonId} />

      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">Import CSV</span> brings in many clients at once. You can also add
        one at a time below, or open a card to edit details, notes, and colour formulas. Each person appears as a{" "}
        <span className="font-medium text-foreground">card</span> in the grid.
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
        <p className="text-sm text-muted">
          No clients yet. Use <span className="font-medium text-foreground">Import CSV</span> at the top of this page, or
          the form below to add your first client.
        </p>
      )}
    </section>
  );
}
