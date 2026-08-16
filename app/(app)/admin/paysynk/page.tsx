import Link from "next/link";
import {
  fetchPaysynkSignups,
  resolvePaysynkShopUrl,
} from "@core/paysynk/admin-api";
import type { PaysynkSignupStatus } from "@core/paysynk/types";
import { PaysynkSignupRowActions } from "./paysynk-signup-row-actions";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; status?: PaysynkSignupStatus }[] = [
  { label: "All" },
  { label: "Pending", status: "pending" },
  { label: "Approved", status: "approved" },
  { label: "Rejected", status: "rejected" },
];

function isSignupStatus(value: string | undefined): value is PaysynkSignupStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function statusClass(status: PaysynkSignupStatus): string {
  if (status === "approved") return "bg-emerald-500/20 text-emerald-400";
  if (status === "rejected") return "bg-red-500/20 text-red-400";
  return "bg-amber-500/20 text-amber-400";
}

export default async function AdminPaysynkPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = isSignupStatus(params.status) ? params.status : undefined;
  const result = await fetchPaysynkSignups(status);

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-muted hover:text-foreground">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">PaySynk</h1>
        </div>
        <Link
          href="/admin/paysynk/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Add client
        </Link>
      </div>

      <p className="mb-4 text-sm text-muted">
        PaySynk stores live in a separate app. Pending shops are not public until you approve them.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const href = f.status ? `/admin/paysynk?status=${f.status}` : "/admin/paysynk";
          const active = f.status === status || (!f.status && !status);
          return (
            <Link
              key={f.label}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                active
                  ? "bg-accent/20 font-medium text-accent"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {!result.ok ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">
            {result.availability === "unconfigured"
              ? "PaySynk is not configured"
              : "PaySynk is unavailable"}
          </p>
          <p className="mt-1 text-amber-200/80">{result.error}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Store</th>
                <th className="px-4 py-2 text-left font-medium">Owner</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Payments</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((s) => {
                const publicShop = s.signupStatus === "approved" && s.shopUrl;
                const shopHref = s.shopUrl ? resolvePaysynkShopUrl(s.shopUrl) : "";
                return (
                  <tr key={s.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.name || "—"}</p>
                      <p className="font-mono text-xs text-muted">{s.slug || "—"}</p>
                      {publicShop ? (
                        <a
                          href={shopHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs text-accent hover:underline"
                        >
                          Open shop
                        </a>
                      ) : s.shopUrl ? (
                        <p className="mt-1 text-xs text-muted">Not public until approved</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p>{s.owner?.name || "—"}</p>
                      <p className="text-xs text-muted">{s.owner?.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass(s.signupStatus)}`}
                      >
                        {s.signupStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {s.paymentsActive ? (
                        <span className="text-emerald-400">Active</span>
                      ) : (
                        "Off"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PaysynkSignupRowActions signup={s} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {result.data.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted">
              No PaySynk clients{status ? ` with status “${status}”` : ""} yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
