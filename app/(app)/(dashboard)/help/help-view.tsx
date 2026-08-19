"use client";

import { useState } from "react";
import { DashboardDisclosure, DashboardSection } from "@/components/dashboard/page-layout";
import { dashboardBtnPrimaryClass, dashboardInputClass, dashboardTextareaClass, dashboardFlowClass } from "@/components/dashboard/ui";
import { SITE } from "@core/config/site";

export function HelpView({ salonName, userEmail }: { salonName: string; userEmail?: string }) {
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salonName,
          userEmail: userEmail ?? undefined,
          subject: subject.trim() || "Support request",
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send");
        setLoading(false);
        return;
      }
      setSent(true);
      setMessage("");
      setSubject("");
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div className={`${dashboardFlowClass} space-y-6`}>
      <DashboardDisclosure title="What SalonSynk does" defaultOpen>
        <p className="text-sm text-muted">
          Flat-fee salon management: diary, team, clients, checkout, online booking, and client communications — no
          per-booking commissions.
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
          <li>Day &amp; week diary views</li>
          <li>Team roles &amp; profile photos</li>
          <li>Client records &amp; colour formulas</li>
          <li>In-salon checkout</li>
          <li>Branded online booking</li>
          <li>Email reminders &amp; review requests</li>
        </ul>
      </DashboardDisclosure>

      <DashboardDisclosure title="Diary">
        <p className="text-sm text-muted">
          Drag bookings to reschedule or reassign. Use <strong className="text-foreground">Day</strong> for stylist
          columns or <strong className="text-foreground">Week</strong> for a list by day. Filter by stylist and tap{" "}
          <strong className="text-foreground">Add appointment</strong> to book.
        </p>
      </DashboardDisclosure>

      <DashboardDisclosure title="Team">
        <p className="text-sm text-muted mb-2">Manage stylists and roles. Owners can invite, edit, deactivate, or delete members.</p>
        <ul className="text-sm text-muted space-y-1 list-disc list-inside">
          <li><strong className="text-foreground">Add team member</strong> — with or without login email</li>
          <li><strong className="text-foreground">Edit</strong> — name, role, photo, employment type</li>
          <li><strong className="text-foreground">Deactivate</strong> — hide from diary without deleting history</li>
        </ul>
      </DashboardDisclosure>

      <DashboardDisclosure title="Clients &amp; Checkout">
        <p className="text-sm text-muted">
          Store client details, notes, and colour history. At checkout, pick stylist and client (or walk-in), add
          services, and record payment. Use <strong className="text-foreground">Silent appointment</strong> when the
          client prefers minimal chat.
        </p>
      </DashboardDisclosure>

      <DashboardDisclosure title="Settings">
        <p className="text-sm text-muted">
          Branding, booking page URL, deposits, reminders, and marketing options. Your public booking link lives under{" "}
          <strong className="text-foreground">Settings → Business</strong>.
        </p>
      </DashboardDisclosure>

      <DashboardSection title="Contact us">
        <p className="text-sm text-muted mb-4">
          Questions or feedback? Email{" "}
          <a href={`mailto:${SITE.email}`} className="text-accent hover:underline">
            {SITE.email}
          </a>{" "}
          or send a message below.
        </p>

        {sent ? (
          <p className="text-sm text-green-600 dark:text-green-400">Message sent. We&apos;ll reply to your email.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="support-subject" className="mb-1.5 block text-sm font-medium">
                Subject
              </label>
              <input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. How do I add a new stylist?"
                className={dashboardInputClass}
              />
            </div>
            <div>
              <label htmlFor="support-message" className="mb-1.5 block text-sm font-medium">
                Message
              </label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or issue..."
                rows={4}
                required
                className={dashboardTextareaClass}
              />
            </div>
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading || !message.trim()} className={dashboardBtnPrimaryClass}>
              {loading ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </DashboardSection>
    </div>
  );
}
