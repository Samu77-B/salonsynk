"use client";

import { useState } from "react";
import { adminSendSalonWelcomeEmail } from "../actions";

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
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
        text: "Welcome email sent with login and payment links. Dashboard access is locked until they pay.",
      });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-1">Client onboarding</h2>
      <p className="text-sm text-muted mb-4">
        After you&apos;ve saved the plan tier, send the welcome email. The owner gets a link to set their
        password and a link to pay their first month. They cannot use the dashboard until payment is
        complete.
      </p>

      <dl className="grid gap-2 text-sm mb-4 sm:grid-cols-3">
        <div>
          <dt className="text-muted">Welcome email</dt>
          <dd className="font-medium">{welcomeSentAt ? "Sent" : "Not sent yet"}</dd>
        </div>
        <div>
          <dt className="text-muted">Payment required</dt>
          <dd className="font-medium">{subscriptionRequired ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted">Subscription</dt>
          <dd className="font-medium capitalize">{subscriptionStatus}</dd>
        </div>
      </dl>

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
