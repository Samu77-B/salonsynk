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
  if (!data) redirect("/onboarding");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Bookings</h1>
        <p className="text-sm text-muted mt-1">
          Pre-booked appointments for {data.shop.name}. Walk-ins are managed on the{" "}
          <a href="/barber/dashboard" className="text-blue-400 hover:underline">
            live queue
          </a>
          .
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <AppointmentsView
          date={data.date}
          appointments={JSON.parse(JSON.stringify(data.appointments))}
          members={JSON.parse(JSON.stringify(data.members))}
          services={JSON.parse(JSON.stringify(data.services))}
        />
      </Suspense>
    </div>
  );
}
