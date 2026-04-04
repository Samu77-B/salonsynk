import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/marketing-unsubscribe";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token || typeof token !== "string") {
    return (
      <main className="animate-entry-up mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Unsubscribe</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link is invalid.</p>
      </main>
    );
  }

  const verified = verifyUnsubscribeToken(token);
  if (!verified) {
    return (
      <main className="animate-entry-up mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Unsubscribe</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link is invalid or has expired.</p>
      </main>
    );
  }

  try {
    const admin = createAdminClient();
    await admin
      .from("clients")
      .update({ marketing_opt_in: false })
      .eq("id", verified.clientId)
      .eq("salon_id", verified.salonId);
  } catch {
    return (
      <main className="animate-entry-up mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Unsubscribe</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Please try again later.</p>
      </main>
    );
  }

  return (
    <main className="animate-entry-up mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">You are unsubscribed</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You will no longer receive marketing emails from this salon. Service messages (e.g. booking confirmations) may
        still be sent when relevant.
      </p>
    </main>
  );
}
