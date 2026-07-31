"use client";

import { useState } from "react";
import { JoinQueueForm } from "./join-queue-form";
import { BookAppointmentForm } from "./book-appointment-form";

type BarberOption = {
  id: string;
  display_name: string | null;
  chair_number: number | null;
  avatar_url: string | null;
  role: string;
};
type ServiceOption = { id: string; name: string; duration_minutes: number; price_minor: number };
type BookingBarberOption = {
  id: string;
  display_name: string | null;
  chair_number: number | null;
};

type Props = {
  shopId: string;
  shopName: string;
  queueLength: number;
  walkInBarbers: BarberOption[];
  bookingBarbers: BookingBarberOption[];
  services: ServiceOption[];
  nextAvailableOnly?: boolean;
  showServicesOnQueue?: boolean;
};

type Mode = "queue" | "book";

export function ShopClientPortal({
  shopId,
  shopName,
  queueLength,
  walkInBarbers,
  bookingBarbers,
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
          className={mode === "queue" ? "btn-accent py-3 text-sm font-semibold" : "btn-outline py-3 text-sm font-semibold"}
        >
          Join queue
        </button>
        <button
          type="button"
          onClick={() => setMode("book")}
          className={mode === "book" ? "btn-accent py-3 text-sm font-semibold" : "btn-outline py-3 text-sm font-semibold"}
        >
          Book later
        </button>
      </div>

      {mode === "queue" ? (
        <JoinQueueForm
          shopId={shopId}
          shopName={shopName}
          queueLength={queueLength}
          barbers={walkInBarbers}
          services={services}
          nextAvailableOnly={nextAvailableOnly}
          showServicesOnQueue={showServicesOnQueue}
        />
      ) : (
        <BookAppointmentForm
          shopId={shopId}
          shopName={shopName}
          barbers={bookingBarbers}
          services={services}
          showServices={showServicesOnQueue}
        />
      )}

      <p className="text-center text-xs text-muted pt-2">
        Powered by <span className="font-semibold">Barber Synk</span>
      </p>
    </div>
  );
}
