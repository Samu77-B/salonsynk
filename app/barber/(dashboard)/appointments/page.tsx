import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getBarberAppointmentsData } from "./data";
import { AppointmentsView } from "./appointments-view";

export const dynamic = "force-dynamic";

export default async function BarberAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const data = await getBarberAppointmentsData(date ?? today);
  if (!data) redirect("/barber/access");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Bookings</h1>
        <p className="text-xs text-muted">
          {new Date(data.date + "T12:00:00").toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <AppointmentsView
          date={data.date}
          appointments={JSON.parse(JSON.stringify(data.appointments))}
          upcomingAppointments={JSON.parse(JSON.stringify(data.upcomingAppointments))}
          members={JSON.parse(JSON.stringify(data.members))}
          services={JSON.parse(JSON.stringify(data.services))}
        />
      </Suspense>
    </div>
  );
}
