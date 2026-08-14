"use client";

import { useState } from "react";
import { NAIL_SITE } from "@core/config/nail-site";
import { JoinQueueForm } from "./join-queue-form";
import { BookAppointmentForm } from "./book-appointment-form";

type TechnicianOption = {
  id: string;
  display_name: string | null;
  station_number: number | null;
  avatar_url: string | null;
  role: string;
};
type ServiceOption = { id: string; name: string; duration_minutes: number; price_minor: number };
type BookingTechnicianOption = {
  id: string;
  display_name: string | null;
  station_number: number | null;
  avatar_url: string | null;
};

type Props = {
  salonId: string;
  salonName: string;
  queueLength: number;
  walkInTechnicians: TechnicianOption[];
  bookingTechnicians: BookingTechnicianOption[];
  services: ServiceOption[];
  nextAvailableOnly?: boolean;
  showServicesOnQueue?: boolean;
};

type Mode = "queue" | "book";

export function SalonClientPortal({
  salonId,
  salonName,
  queueLength,
  walkInTechnicians,
  bookingTechnicians,
  services,
  nextAvailableOnly = false,
  showServicesOnQueue = true,
}: Props) {
  const [mode, setMode] = useState<Mode>("queue");

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("queue")}
          className={
            mode === "queue"
              ? "rounded-lg bg-accent py-3 text-sm font-semibold text-background"
              : "rounded-lg border border-border py-3 text-sm font-semibold hover:border-accent/50"
          }
        >
          Join queue
        </button>
        <button
          type="button"
          onClick={() => setMode("book")}
          className={
            mode === "book"
              ? "rounded-lg bg-accent py-3 text-sm font-semibold text-background"
              : "rounded-lg border border-border py-3 text-sm font-semibold hover:border-accent/50"
          }
        >
          Book later
        </button>
      </div>

      {mode === "queue" ? (
        <JoinQueueForm
          salonId={salonId}
          salonName={salonName}
          queueLength={queueLength}
          technicians={walkInTechnicians}
          services={services}
          nextAvailableOnly={nextAvailableOnly}
          showServicesOnQueue={showServicesOnQueue}
        />
      ) : (
        <BookAppointmentForm
          salonId={salonId}
          salonName={salonName}
          technicians={bookingTechnicians}
          services={services}
          showServices={showServicesOnQueue}
        />
      )}

      <p className="text-center text-xs text-muted pt-2">
        Powered by <span className="font-semibold">{NAIL_SITE.name}</span>
      </p>
    </div>
  );
}
