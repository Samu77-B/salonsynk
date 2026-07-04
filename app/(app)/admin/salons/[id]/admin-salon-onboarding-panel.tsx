"use client";

import { useState } from "react";
import { adminSendSalonWelcomeEmail, adminStartSalonFreeTrial } from "../actions";

export function AdminSalonOnboardingPanel({
  salonId,
  ownerEmails,
  welcomeSentAt,
  subscriptionRequired,
  subscriptionStatus,
}: {
  salonId: string;
  ownerEmails: string[];
  welcomeSentAt: string | null;
  subscriptionRequired: boolean;
  subscriptionStatus: string;
}) {
  const [email, setEmail] = useState(ownerEmails[0] ?? "");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const status = subscriptionStatus.toLowerCase();
  const onFreeTrial = status === "trialing" || status === "active";
  const canStartTrial = !onFreeTrial && welcomeSentAt;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMsg(null);
    const result = await adminSendSalonWelcomeEmail(salonId, email.trim(), name.trim() || undefined);
    setLoading(false);
    if (result.error) {
      setMsg({ type: "err", text: result.error });
    } else {
      setMsg({
        type: "ok",
        text: "Welcome email sent. The owner gets 30 days free — dashboard opens after they set their password.",
      });
    }
  }

  async function handleStartTrial() {
    setTrialLoading(true);
    setMsg(null);
    const result = await adminStartSalonFreeTrial(salonId);
    setTrialLoading(false);
    if (result.error) {
      setMsg({ type: "err", text: result.error });
    } else {
      setMsg({
        type: "ok",
        text: "30-day free trial activated. The owner can log in and use the dashboard without paying yet.",
      });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-1">Client onboarding</h2>
      <p className="text-sm text-muted mb-4">
        Send the welcome email after saving the plan tier. New clients get <strong>30 days free</strong> —
        they set a password and can use the dashboard straight away. Payment is only required after the
        free month (optional payment link in the email adds their card with no charge today).
      </p>

      <dl className="grid gap-2 text-sm mb-4 sm:grid-cols-3">
        <div>
          <dt className="text-muted">Welcome email</dt>
          <dd className="font-medium">{welcomeSentAt ? "Sent" : "Not sent yet"}</dd>
        </div>
        <div>
          <dt className="text-muted">Free trial</dt>
          <dd className="font-medium capitalize">{onFreeTrial ? status : "Not started"}</dd>
        </div>
        <div>
          <dt className="text-muted">Billing after trial</dt>
          <dd className="font-medium">{subscriptionRequired ? "Required" : "Off"}</dd>
        </div>
      </dl>

      {canStartTrial && (
        <div className="mb-4">
          <button
            type="button"
            disabled={trialLoading}
            onClick={() => void handleStartTrial()}
            className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {trialLoading ? "Activating…" : "Start 30-day free trial (existing client)"}
          </button>
          <p className="text-xs text-muted mt-1">
            Use this for salons that already received a welcome email before the free-trial rollout.
          </p>
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label htmlFor="welcome-owner-email" className="block text-sm font-medium mb-1">
              Owner email
            </label>
            <input
              id="welcome-owner-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
              placeholder="owner@salon.com"
            />
          </div>
          <div>
            <label htmlFor="welcome-owner-name" className="block text-sm font-medium mb-1">
              Name (optional)
            </label>
            <input
              id="welcome-owner-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-40"
              placeholder="Jane"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {loading ? "Sending…" : welcomeSentAt ? "Resend welcome email" : "Send welcome email"}
          </button>
        </div>
        {msg && (
          <p className={`text-sm ${msg.type === "ok" ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
        )}
      </form>
    </section>
  );
}
