import { redirect } from "next/navigation";
import { getBarberDashboardData } from "./data";
import { LiveQueueView } from "./live-queue-view";

export const dynamic = "force-dynamic";

export default async function BarberDashboardPage() {
  const data = await getBarberDashboardData();
  if (!data) redirect("/onboarding");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Live Queue</h1>
        <p className="text-xs text-muted">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>
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
