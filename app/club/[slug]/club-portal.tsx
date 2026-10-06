"use client";

import { useState } from "react";
import { requestClubCode, signOutClub, verifyClubCode } from "./actions";
import { useRouter } from "next/navigation";

export type ClubClient = {
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type ClubLoyalty = {
  servicePoints: number;
  productPoints: number;
  totalVisits: number;
  tier: string;
};

export type ClubVisit = {
  id: string;
  startTime: string;
  status: string;
  serviceName: string | null;
};

export function ClubLoginForm({
  slug,
  clubName,
}: {
  slug: string;
  clubName: string;
}) {
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"contact" | "code">("contact");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await requestClubCode(slug, contact);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStep("code");
    setInfo(
      result.sentTo === "email"
        ? "We sent a 6-digit code to your email."
        : "We sent a 6-digit code to your phone."
    );
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await verifyClubCode(slug, contact, code);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={step === "contact" ? handleRequest : handleVerify} className="space-y-4">
      <p className="text-sm text-muted">
        Sign in to {clubName} with the email or mobile number the salon has for you.
      </p>
      <div>
        <label className="mb-1 block text-sm font-medium">Email or mobile</label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      {step === "code" ? (
        <div>
          <label className="mb-1 block text-sm font-medium">6-digit code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm tracking-[0.3em]"
          />
        </div>
      ) : null}
      {info ? <p className="text-sm text-green-400">{info}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Please wait…" : step === "contact" ? "Send code" : "View my club"}
      </button>
    </form>
  );
}

export function ClubPortalView({
  clubName,
  salonName,
  client,
  loyalty,
  visits,
}: {
  clubName: string;
  salonName: string;
  client: ClubClient;
  loyalty: ClubLoyalty | null;
  visits: ClubVisit[];
}) {
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setSigningOut(true);
    await signOutClub();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{clubName}</p>
          <h2 className="text-xl font-semibold">{client.name || "Welcome"}</h2>
          <p className="text-sm text-muted">{salonName}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="text-xs text-muted underline hover:text-foreground"
        >
          Sign out
        </button>
      </div>

      <section className="rounded-lg border border-border p-4 space-y-1">
        <h3 className="text-sm font-medium">Your details</h3>
        {client.email ? <p className="text-sm">{client.email}</p> : null}
        {client.phone ? <p className="text-sm">{client.phone}</p> : null}
        {!client.email && !client.phone ? <p className="text-sm text-muted">Ask the salon to add your contact details.</p> : null}
      </section>

      <section className="rounded-lg border border-border p-4 space-y-2">
        <h3 className="text-sm font-medium">Points &amp; visits</h3>
        {loyalty ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-2xl font-semibold">{loyalty.servicePoints}</p>
              <p className="text-xs text-muted">Service points</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{loyalty.productPoints}</p>
              <p className="text-xs text-muted">Product points</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">{loyalty.totalVisits}</p>
              <p className="text-xs text-muted">Loyalty visits</p>
            </div>
            <div>
              <p className="text-2xl font-semibold capitalize">{loyalty.tier}</p>
              <p className="text-xs text-muted">Tier</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Points start after a paid visit at checkout.</p>
        )}
      </section>

      <section className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-sm font-medium">Recent visits</h3>
        {visits.length === 0 ? (
          <p className="text-sm text-muted">No visits recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {visits.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p>{v.serviceName || "Appointment"}</p>
                  <p className="text-xs text-muted capitalize">{v.status.replace("_", " ")}</p>
                </div>
                <p className="shrink-0 text-xs text-muted">
                  {new Date(v.startTime).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
