import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSalonFeature } from "@/lib/salon-features.server";
import { getSalonQueueData } from "./data";
import { LiveQueueView } from "./live-queue-view";
import { WalkInQrPanel } from "@/components/walk-in/walk-in-qr-panel";
import { salonWalkInUrl } from "@core/config/platform-urls";

export const dynamic = "force-dynamic";

export default async function SalonQueuePage() {
  await requireSalonFeature("walk_in_queue");
  const data = await getSalonQueueData();
  if (!data) redirect("/onboarding");

  const joinPath = `/walk-in/${data.salon.slug}`;
  const joinUrl = salonWalkInUrl(data.salon.slug);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Walk-in queue</h1>
          <p className="text-xs text-muted mt-1">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <WalkInQrPanel joinUrl={joinUrl} joinPath={joinPath} salonName={data.salon.name} />
      </div>
      <p className="text-xs text-muted -mt-2">
        Customers who scan your QR code or open{" "}
        <a href={joinPath} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          {joinPath}
        </a>{" "}
        appear here in real time. Pre-booked appointments stay on the{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Diary
        </Link>
        .
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
