"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardDisclosure, DashboardSection } from "@/components/dashboard/page-layout";
import { dashboardBtnPrimaryClass, dashboardBtnSecondaryClass, dashboardCardClass } from "@/components/dashboard/ui";
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
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-background/50">
      <Image
        src={src}
        alt={client.name || "Client"}
        fill
        className={`object-cover ${hasPhoto ? "" : "opacity-40"}`}
        sizes="56px"
      />
    </div>
  );
}

function ClientCard({ client }: { client: ClientListRow }) {
  const display = client.name?.trim() || client.email?.trim() || client.phone?.trim() || "No name";
  const contact = [client.email, client.phone].filter(Boolean).join(" · ");

  return (
    <article className={`flex min-w-0 flex-col ${dashboardCardClass}`}>
      <div className="flex items-center gap-3">
        <ClientAvatar client={client} />
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug">{display}</h3>
          {contact ? <p className="mt-0.5 truncate text-sm text-muted">{contact}</p> : null}
        </div>
      </div>
      {client.patch_test_due_at ? (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
          Patch test due: {new Date(client.patch_test_due_at).toLocaleDateString("en-GB")}
        </p>
      ) : null}
      {client.last_skin_test_at && (() => {
        const monthsSince = Math.floor((Date.now() - new Date(client.last_skin_test_at!).getTime()) / (30.44 * 24 * 60 * 60 * 1000));
        if (monthsSince >= 12) return <p className="mt-3 text-sm text-red-500 dark:text-red-400">Skin test expired ({monthsSince} months ago)</p>;
        return null;
      })()}
      <div className="mt-4 border-t border-border pt-4">
        <Link href={`/clients/${client.id}`} className={`${dashboardBtnPrimaryClass} self-start`}>
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
    <DashboardDisclosure
      title="Import clients (CSV)"
      summary="Bulk import from a spreadsheet — optional if you add clients one at a time."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <button type="button" onClick={downloadTemplate} className={dashboardBtnSecondaryClass}>
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
          className={dashboardBtnPrimaryClass}
        >
          {loading ? "Importing…" : "Import CSV"}
        </button>
      </div>

      <p className="mt-4 text-sm text-muted">
        Columns: name, email, phone, sex (male/female), notes, marketing_opt_in (yes/no). Each row needs at least
        one of name, email, or phone. Up to 2,000 rows.
      </p>
      {summary ? <p className="mt-2 text-sm text-foreground">{summary}</p> : null}
      {rowErrors.length > 0 ? (
        <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs text-red-500 dark:text-red-400">
          {rowErrors.slice(0, 20).map((r) => (
            <li key={`${r.line}-${r.message}`}>
              Line {r.line}: {r.message}
            </li>
          ))}
          {rowErrors.length > 20 ? <li>…and {rowErrors.length - 20} more</li> : null}
        </ul>
      ) : null}
    </DashboardDisclosure>
  );
}

export function ClientsView({ salonId, clients }: { salonId: string; clients: ClientListRow[] }) {
  return (
    <section className="space-y-6">
      <ImportClientsPanel salonId={salonId} />

      <DashboardSection title="Add a client">
        <ClientForm salonId={salonId} inlineOnCreate />
      </DashboardSection>

      {clients.length > 0 ? (
        <div>
          <h2 className="mb-4 text-base font-semibold sm:text-lg">Your clients ({clients.length})</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted">
          No clients yet. Use import above or add your first client in the form.
        </p>
      )}
    </section>
  );
}
