"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NailClientForm } from "./client-form";
import { importNailClientsFromCsv, type CsvImportRowError } from "./actions";

export type NailClientListRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  patch_test_due_at: string | null;
  last_skin_test_at: string | null;
};

function ClientCard({ client }: { client: NailClientListRow }) {
  const display = client.name?.trim() || client.email?.trim() || client.phone?.trim() || "No name";
  const contact = [client.email, client.phone].filter(Boolean).join(" · ");

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-snug">{display}</h3>
        {contact ? <p className="mt-0.5 truncate text-sm text-muted">{contact}</p> : null}
      </div>
      {client.patch_test_due_at ? (
        <p className="text-xs text-amber-400">
          Patch test due: {new Date(client.patch_test_due_at).toLocaleDateString("en-GB")}
        </p>
      ) : null}
      {client.last_skin_test_at && (() => {
        const monthsSince = Math.floor(
          (Date.now() - new Date(client.last_skin_test_at).getTime()) / (30.44 * 24 * 60 * 60 * 1000)
        );
        if (monthsSince >= 12) {
          return <p className="text-xs text-red-400">Skin test expired ({monthsSince} months ago)</p>;
        }
        return null;
      })()}
      <div className="mt-auto border-t border-border pt-3">
        <Link
          href={`/nail/clients/${client.id}`}
          className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          View and edit
        </Link>
      </div>
    </article>
  );
}

const CSV_TEMPLATE = `name,email,phone,notes
Jane Example,jane@example.com,07700900000,Prefers Saturday afternoons
John Example,john@example.com,+447700900111,
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
    a.download = "nail-clients-import-template.csv";
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
      const result = await importNailClientsFromCsv(salonId, text);
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
          <button type="button" onClick={downloadTemplate} className="rounded-lg border border-border px-3 py-1.5 text-sm">
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
        <span className="font-mono text-xs">phone</span>, <span className="font-mono text-xs">notes</span>. Each row
        needs at least one of name, email, or phone.
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

export function NailClientsView({ salonId, clients }: { salonId: string; clients: NailClientListRow[] }) {
  return (
    <section className="space-y-6">
      <ImportClientsPanel salonId={salonId} />

      <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-base font-semibold">Add a client</h2>
        <NailClientForm salonId={salonId} inlineOnCreate />
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
        <p className="text-sm text-muted">No clients yet. Import a CSV or use the form above to add your first client.</p>
      )}
    </section>
  );
}
