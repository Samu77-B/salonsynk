"use client";

import { useState } from "react";

const SUPPORT_EMAIL = "hello@salonsynk.com";

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
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold mb-2">Help &amp; Support</h1>
        <p className="text-muted">
          What SalonSynk can do and how to use it. Need more help? Contact us below.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">What SalonSynk does</h2>
        <p className="text-sm text-muted mb-2">
          SalonSynk is a flat-fee salon management platform. It helps you run your diary, manage your team and clients, take payments, and let clients book online.
        </p>
        <ul className="text-sm text-muted list-disc list-inside space-y-1">
          <li>Day diary (per stylist) and week list view with appointments</li>
          <li>Team members with roles and profile photos</li>
          <li>Client database with notes and colour formulas</li>
          <li>In-salon checkout (Stripe payments)</li>
          <li>Online booking page for clients</li>
          <li>Email reminders and review requests</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Menu &amp; buttons</h2>

        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium text-foreground">Diary</h3>
            <p className="text-muted">
              Your appointment calendar. <strong>Day</strong> shows one time column per stylist (with profile photos); drag a booking to another column or time to reschedule or reassign. <strong>Week</strong> lists each day in order—drag onto another day to move (same time of day). Filter by stylist, use <strong>Add appointment</strong> to book, click to edit. Appointment blocks are colour-coded by service category.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Team</h3>
            <p className="text-muted mb-2">
              Manage your team members. Each member can have a role and profile photo.
            </p>
            <ul className="text-muted list-disc list-inside space-y-1">
              <li><strong>Add team member</strong> – Add someone with or without an email (invite later)</li>
              <li><strong>Edit</strong> – Change name, role, profile photo, employment type</li>
              <li><strong>Deactivate</strong> – Hide from diary but keep their record</li>
              <li><strong>Reactivate</strong> – Bring back a deactivated member</li>
              <li><strong>Delete</strong> – Permanently remove (only if they have no appointments)</li>
            </ul>
            <p className="text-muted mt-2">
              <em>Login: email</em> means they have an account. <em>No account (display only)</em> means they&apos;re in the diary but can&apos;t log in yet.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Clients</h3>
            <p className="text-muted mb-2">
              Your client database. Add clients with name, email, phone, notes, and colour formulas.
            </p>
            <ul className="text-muted list-disc list-inside space-y-1">
              <li><strong>Add client</strong> – Create a new client</li>
              <li><strong>Edit</strong> – Update client details</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Checkout</h3>
            <p className="text-muted">
              In-salon payment screen. Select stylist, client (or walk-in), services, and process payment via Stripe. Use <strong>Silent appointment</strong> for clients who prefer a quiet session.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground">Settings</h3>
            <p className="text-muted">
              Salon branding (logo, colours), booking page settings, and your public booking URL. Clients use this link to book online.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border p-6 bg-muted/20">
        <h2 className="text-lg font-semibold mb-2">Contact us</h2>
        <p className="text-sm text-muted mb-4">
          Questions, feedback, or need help? Email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          or send a message below. We&apos;ll get back to you as soon as we can.
        </p>

        {sent ? (
          <p className="text-sm text-green-500">Message sent. We&apos;ll reply to your email.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="support-subject" className="block text-sm font-medium mb-1">Subject</label>
              <input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. How do I add a new stylist?"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="support-message" className="block text-sm font-medium mb-1">Message</label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or issue..."
                rows={4}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
