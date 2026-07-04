"use client";

import { useState } from "react";
import { adminSendPlatformWelcomeEmail } from "@core/billing/admin-welcome-email";

export function AdminPlatformOnboardingPanel({
  platform,
  tenantId,
  ownerEmails,
  welcomeSentAt,
  subscriptionRequired,
  subscriptionStatus,
  productName,
}: {
  platform: "barber" | "nail";
  tenantId: string;
  ownerEmails: string[];
  welcomeSentAt: string | null;
  subscriptionRequired: boolean;
  subscriptionStatus: string;
  productName: string;
}) {
  const [email, setEmail] = useState(ownerEmails[0] ?? "");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const status = subscriptionStatus.toLowerCase();
  const onFreeTrial = status === "trialing" || status === "active";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMsg(null);
    const result = await adminSendPlatformWelcomeEmail(
      platform,
      tenantId,
      email.trim(),
      name.trim() || undefined
    );
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

  return (
    <section className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-1">Client onboarding</h2>
      <p className="text-sm text-muted mb-4">
        Send the welcome email. New {productName} clients get <strong>30 days free</strong> — they set a
        password and can use the dashboard straight away. Payment is only required after the free month.
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

      <form onSubmit={handleSend} className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label htmlFor={`welcome-owner-email-${platform}`} className="block text-sm font-medium mb-1">
              Owner email
            </label>
            <input
              id={`welcome-owner-email-${platform}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-64"
              placeholder="owner@example.com"
            />
          </div>
          <div>
            <label htmlFor={`welcome-owner-name-${platform}`} className="block text-sm font-medium mb-1">
              Owner name (optional)
            </label>
            <input
              id={`welcome-owner-name-${platform}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm w-48"
              placeholder="Alex"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send welcome email"}
          </button>
        </div>
        {msg?.type === "ok" && <p className="text-sm text-green-400">{msg.text}</p>}
        {msg?.type === "err" && <p className="text-sm text-red-400">{msg.text}</p>}
      </form>
    </section>
  );
}
