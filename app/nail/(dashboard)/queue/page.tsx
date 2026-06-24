import { redirect } from "next/navigation";
import { getNailQueueData } from "./data";
import { LiveQueueView } from "./live-queue-view";

export const dynamic = "force-dynamic";

export default async function NailQueuePage() {
  const data = await getNailQueueData();
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
        Walk-in customers from the join queue page appear here in real time. Tap Start to notify the next clients by text.
      </p>

      <LiveQueueView
        salonId={data.salon.id}
        salonName={data.salon.name}
        queue={JSON.parse(JSON.stringify(data.queue))}
        members={JSON.parse(JSON.stringify(data.members))}
        services={JSON.parse(JSON.stringify(data.services))}
        currentMemberId={data.member.id}
        stats={data.stats}
      />
    </div>
  );
}
