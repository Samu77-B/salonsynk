"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNailStationAssignment } from "@modules/nail/actions/team";
import { QUEUE_SETUP_LIMITS } from "@core/queue/platform-queue-access";

type Member = {
  id: string;
  display_name: string | null;
  station_number: number | null;
};

export function NailStationsView({ members }: { members: Member[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function occupantForStation(stationNumber: number): string {
    const match = members.find((m) => m.station_number === stationNumber);
    return match?.id ?? "";
  }

  function handleAssign(stationNumber: number, memberId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setNailStationAssignment(
        stationNumber,
        memberId.trim() === "" ? null : memberId
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Assign up to {QUEUE_SETUP_LIMITS.maxStations} stations. Each technician can only occupy one
        station at a time.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <ul className="space-y-2">
        {Array.from({ length: QUEUE_SETUP_LIMITS.maxStations }, (_, i) => i + 1).map(
          (stationNumber) => (
            <li
              key={stationNumber}
              className="rounded-lg border border-border bg-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-semibold">Station {stationNumber}</span>
              <select
                className="w-full sm:max-w-xs h-11 rounded-lg border border-border px-3 text-sm bg-background"
                value={occupantForStation(stationNumber)}
                disabled={isPending}
                onChange={(e) => handleAssign(stationNumber, e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name ?? "Technician"}
                  </option>
                ))}
              </select>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
