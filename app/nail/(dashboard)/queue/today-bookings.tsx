"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { updateNailAppointmentStatus } from "../appointments/actions";
import type { NailMember, NailService, TodayAppointment } from "./data";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function TodayBookings({
  appointments,
  members,
  services,
}: {
  appointments: TodayAppointment[];
  members: NailMember[];
  services: NailService[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStatus(id: string, status: "completed" | "no_show") {
    setError(null);
    startTransition(async () => {
      const result = await updateNailAppointmentStatus(id, status);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Booked today ({appointments.length})
      </h2>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <ul className="space-y-2">
        {appointments.map((appt) => {
          const technician = members.find((m) => m.id === appt.technician_id);
          const service = services.find((s) => s.id === appt.service_id);
          return (
            <li
              key={appt.id}
              className="rounded-xl border border-border bg-surface p-3.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {appt.guest_name ?? "Booking"}{" "}
                    <span className="text-[10px] uppercase tracking-wide font-medium text-muted border border-border rounded px-1.5 py-0.5 ml-1">
                      Booked
                    </span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {formatTime(appt.start_time)}
                    {technician ? ` · ${technician.display_name ?? "Technician"}` : ""}
                    {service ? ` · ${service.name}` : ""}
                  </p>
                  {appt.guest_phone && (
                    <p className="text-xs font-mono text-foreground/80 mt-0.5">{appt.guest_phone}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatus(appt.id, "completed")}
                  disabled={isPending}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                >
                  Complete
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus(appt.id, "no_show")}
                  disabled={isPending}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-canvas disabled:opacity-50"
                >
                  No-show
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
