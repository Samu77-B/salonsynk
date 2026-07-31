"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBarberChairAssignment } from "@modules/barber/actions/team";
import { QUEUE_SETUP_LIMITS } from "@core/queue/platform-queue-access";

type Member = {
  id: string;
  display_name: string | null;
  chair_number: number | null;
};

export function BarberChairsView({ members }: { members: Member[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function occupantForChair(chairNumber: number): string {
    const match = members.find((m) => m.chair_number === chairNumber);
    return match?.id ?? "";
  }

  function handleAssign(chairNumber: number, memberId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setBarberChairAssignment(
        chairNumber,
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
        Assign up to {QUEUE_SETUP_LIMITS.maxStations} chairs. Each barber can only occupy one chair
        at a time.
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <ul className="space-y-2">
        {Array.from({ length: QUEUE_SETUP_LIMITS.maxStations }, (_, i) => i + 1).map(
          (chairNumber) => (
            <li
              key={chairNumber}
              className="barber-panel flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-semibold text-foreground">Chair {chairNumber}</span>
              <select
                className="w-full sm:max-w-xs h-11 rounded border border-border px-3 text-sm bg-background"
                value={occupantForChair(chairNumber)}
                disabled={isPending}
                onChange={(e) => handleAssign(chairNumber, e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name ?? "Barber"}
                    {m.chair_number != null && m.chair_number !== chairNumber
                      ? ` (was Chair ${m.chair_number})`
                      : ""}
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
