import Link from "next/link";
import { redirect } from "next/navigation";
import { getBarberDashboardData } from "./data";
import { LiveQueueView } from "./live-queue-view";

export const dynamic = "force-dynamic";

export default async function BarberDashboardPage() {
  const data = await getBarberDashboardData();
  if (!data) redirect("/onboarding");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Live Queue</h1>
          <p className="text-xs text-muted">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <Link
          href="/barber/appointments"
          className="btn-accent shrink-0 px-4 py-2.5 text-sm text-center"
        >
          Future bookings
          {data.futureBookingsCount > 0 ? ` (${data.futureBookingsCount})` : ""}
        </Link>
      </div>
      <LiveQueueView
        shopId={data.shop.id}
        shopName={data.shop.name}
        queue={JSON.parse(JSON.stringify(data.queue))}
        todayAppointments={JSON.parse(JSON.stringify(data.todayAppointments))}
        members={JSON.parse(JSON.stringify(data.members))}
        services={JSON.parse(JSON.stringify(data.services))}
        currentMemberId={data.member.id}
        stats={data.stats}
      />
    </div>
  );
}
