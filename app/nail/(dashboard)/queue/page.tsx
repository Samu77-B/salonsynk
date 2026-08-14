import { redirect } from "next/navigation";
import Link from "next/link";
import { getNailQueueData } from "./data";
import { LiveQueueView } from "./live-queue-view";
import { TodayBookings } from "./today-bookings";
import { fetchNailBillingState } from "@core/billing/platform-onboarding";
import { shouldShowPlatformSubscribeBanner } from "@core/billing/platform-billing";
import { PlatformSubscribeButtons } from "@/components/billing/platform-subscribe-buttons";

export const dynamic = "force-dynamic";

export default async function NailQueuePage() {
  const data = await getNailQueueData();
  if (!data) redirect("/onboarding");

  const memberName = data.member.display_name?.trim() || "My queue";
  const isOwner = (data.member.role ?? "").toLowerCase() === "owner";
  const billing = isOwner ? await fetchNailBillingState(data.salon.id) : null;
  const showSubscribe =
    isOwner && billing != null && shouldShowPlatformSubscribeBanner(billing);

  return (
    <div className="space-y-4">
      {showSubscribe ? (
        <PlatformSubscribeButtons
          platform="nail"
          useAuthenticatedCheckout
          paymentInviteToken={billing.payment_invite_token as string | null}
          welcomeSentAt={billing.onboarding_welcome_sent_at as string | null}
          variant="banner"
          productBlurb="Live queue, diary, and client tools for your nail salon."
        />
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        {data.isManagerView ? (
          <Link
            href="/nail/appointments"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background text-center shrink-0 hover:opacity-90"
          >
            Future bookings
            {data.futureBookingsCount > 0 ? ` (${data.futureBookingsCount})` : ""}
          </Link>
        ) : null}
      </div>
      {data.isManagerView ? (
        <p className="text-xs text-muted -mt-2">
          Walk-in customers from the join queue page appear here in real time. Tap Start to notify
          the next clients by text.
        </p>
      ) : null}

      {data.isManagerView && data.todayAppointments.length > 0 ? (
        <TodayBookings
          appointments={JSON.parse(JSON.stringify(data.todayAppointments))}
          members={JSON.parse(JSON.stringify(data.members))}
          services={JSON.parse(JSON.stringify(data.services))}
        />
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
