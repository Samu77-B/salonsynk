"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteNailSalon } from "../actions";

export function AdminNailSalonDangerZone({
  salonId,
  salonName,
}: {
  salonId: string;
  salonName: string;
}) {
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <section className="rounded-xl border border-red-400/30 bg-red-500/5 p-4">
      <h2 className="text-lg font-semibold mb-2 text-red-400">Danger zone</h2>
      <p className="text-sm text-muted mb-2">
        Permanently delete this nail salon and all its data (queue, appointments, team, services).
        This cannot be undone.
      </p>
      {deleteError && <p className="text-sm text-red-400 mb-2">{deleteError}</p>}
      <button
        type="button"
        onClick={async () => {
          if (
            !confirm(
              `Delete "${salonName}"? This will remove all queue entries, appointments, team members, and services.`
            )
          )
            return;
          setDeleteError(null);
          setDeleteLoading(true);
          const result = await adminDeleteNailSalon(salonId);
          setDeleteLoading(false);
          if (result.error) {
            setDeleteError(result.error);
          } else {
            router.push("/admin/nail-salons");
          }
        }}
        disabled={deleteLoading}
        className="rounded-lg border border-red-400/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
      >
        {deleteLoading ? "Deleting…" : "Delete nail salon"}
      </button>
    </section>
  );
}
