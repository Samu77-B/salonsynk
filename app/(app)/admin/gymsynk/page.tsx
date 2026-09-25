import Link from "next/link";
import { fetchGymsynkTenants, gymsynkClientStatus } from "@core/gymsynk/admin-api";

export const dynamic = "force-dynamic";

export default async function AdminGymsynkPage() {
  const result = await fetchGymsynkTenants();
  const client = gymsynkClientStatus();

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-muted hover:text-foreground">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">GymSynk</h1>
        </div>
        <Link
          href="/admin/gymsynk/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
        >
          Add gym
        </Link>
      </div>

      <p className="mb-4 text-sm text-muted">
        Gyms live in the GymSynk app. Creating one here sets up the gym and an owner login.
        Logo and brand colours are set later inside that gym under Gym settings → Branding.
        Use the join and schedule links when this gym should be the public demo on gymsynk.net.
      </p>

      {!result.ok ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">
            {result.availability === "unconfigured"
              ? "GymSynk is not configured"
              : "GymSynk is unavailable"}
          </p>
          <p className="mt-1 text-amber-200/80">{result.error}</p>
          <p className="mt-2 font-mono text-xs text-amber-200/70">
            Calling {client.url} · API key {client.keySet ? `set (${client.keyLength} chars)` : "missing"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Gym</th>
                <th className="px-4 py-2 text-left font-medium">Owner</th>
                <th className="px-4 py-2 text-left font-medium">Public links</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((gym) => (
                <tr key={gym.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{gym.name}</p>
                    <p className="font-mono text-xs text-muted">{gym.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{gym.owner?.name || "—"}</p>
                    <p className="text-xs text-muted">{gym.owner?.email || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={gym.loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-accent hover:underline"
                    >
                      Owner login
                    </a>
                    <a
                      href={gym.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-accent hover:underline"
                    >
                      Join page
                    </a>
                    <a
                      href={gym.embedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-accent hover:underline"
                    >
                      Schedule embed
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {gym.createdAt
                      ? new Date(gym.createdAt).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.data.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted">No GymSynk clients yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
