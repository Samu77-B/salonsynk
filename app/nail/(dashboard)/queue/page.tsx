import { redirect } from "next/navigation";
import { getNailQueueData } from "./data";
import { LiveQueueView } from "./live-queue-view";

export const dynamic = "force-dynamic";

export default async function NailQueuePage() {
  const data = await getNailQueueData();
  if (!data) redirect("/onboarding");

  const memberName = data.member.display_name?.trim() || "My queue";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {data.isManagerView ? "Live Queue" : memberName}
          </h1>
          <p className="text-xs text-muted">
            {data.isManagerView
              ? new Date().toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "Clients assigned to you"}
          </p>
        </div>
      </div>
      {data.isManagerView ? (
        <p className="text-xs text-muted -mt-2">
          Walk-in customers from the join queue page appear here in real time. Tap Start to notify
          the next clients by text.
        </p>
      ) : null}

      <LiveQueueView
        salonId={data.salon.id}
        salonName={data.salon.name}
        queue={JSON.parse(JSON.stringify(data.queue))}
        members={JSON.parse(JSON.stringify(data.members))}
        services={JSON.parse(JSON.stringify(data.services))}
        currentMemberId={data.member.id}
        isManagerView={data.isManagerView}
        stats={data.stats}
      />
    </div>
  );
}
