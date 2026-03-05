"use client";

export function SettingsView({
  salonId,
  salonName,
  stripeConnectAccountId,
  subscriptionStatus,
  formatFlatFee,
}: {
  salonId: string;
  salonName: string;
  stripeConnectAccountId: string | null;
  subscriptionStatus: string;
  formatFlatFee: string;
}) {
  const connectUrl = `/api/stripe/connect?salonId=${encodeURIComponent(salonId)}`;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-2">Business</h2>
        <p className="text-muted text-sm">{salonName}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Payments (Stripe Connect)</h2>
        <p className="text-muted text-sm mb-4">
          Connect your Stripe account to receive in-salon payments and deposits.
        </p>
        {stripeConnectAccountId ? (
          <p className="text-green-400 text-sm">Connected</p>
        ) : (
          <a
            href={connectUrl}
            className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Connect Stripe account
          </a>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Subscription</h2>
        <p className="text-muted text-sm mb-2">
          SalonSynk flat fee: {formatFlatFee}
        </p>
        <p className="text-sm">
          Status: <span className="capitalize">{subscriptionStatus}</span>
        </p>
      </section>
    </div>
  );
}
