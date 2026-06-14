import { redirect } from "next/navigation";
import { getBarberDashboardData } from "./data";
import { LiveQueueView } from "./live-queue-view";

export const dynamic = "force-dynamic";

export default async function BarberDashboardPage() {
  const data = await getBarberDashboardData();
  if (!data) redirect("/onboarding");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Live Queue</h1>
        <p className="text-xs text-muted">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>
      <p className="text-xs text-muted -mt-2">
        Walk-in customers from the join queue page appear here. Pre-booked appointments are on{" "}
        <a href="/barber/appointments" className="text-blue-400 hover:underline">
          Bookings
        </a>
        .
      </p>

      <LiveQueueView
        shopId={data.shop.id}
        shopName={data.shop.name}
        queue={JSON.parse(JSON.stringify(data.queue))}
        members={JSON.parse(JSON.stringify(data.members))}
        services={JSON.parse(JSON.stringify(data.services))}
        currentMemberId={data.member.id}
        stats={data.stats}
      />
    </div>
  );
}
