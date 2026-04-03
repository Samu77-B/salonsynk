"use client";

import { useState, useTransition } from "react";
import { countMarketingRecipientsAction, sendMarketingCampaignAction } from "./actions";

export function CampaignComposer() {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<string | null>(null);
  const [pendingCount, startCount] = useTransition();
  const [pendingSend, startSend] = useTransition();

  function refreshCount() {
    setCountError(null);
    startCount(async () => {
      const r = await countMarketingRecipientsAction();
      if (r.error) setCountError(r.error);
      setCount(r.count);
    });
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendError(null);
    setSendOk(null);
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("bodyHtml", bodyHtml);
    startSend(async () => {
      const r = await sendMarketingCampaignAction(fd);
      if (r.error) setSendError(r.error);
      else if (r.sent != null) setSendOk(`Sent to ${r.sent} recipient(s).`);
    });
  }

  return (
    <section className="rounded-lg border border-border p-4 space-y-4">
      <h2 className="text-lg font-semibold">Compose campaign</h2>
      <p className="text-sm text-muted">
        Sends only to clients with an email address who have <strong>marketing opt-in</strong> enabled. Each message
        includes an unsubscribe link.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={refreshCount}
          disabled={pendingCount}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
        >
          {pendingCount ? "Loading…" : "Preview recipient count"}
        </button>
        {count !== null && <span className="text-sm text-muted">{count} recipient(s)</span>}
        {countError && <span className="text-sm text-red-400">{countError}</span>}
      </div>
      <form onSubmit={handleSend} className="space-y-3">
        <div>
          <label htmlFor="camp-subject" className="mb-1 block text-sm font-medium">
            Subject
          </label>
          <input
            id="camp-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label htmlFor="camp-body" className="mb-1 block text-sm font-medium">
            Body (HTML)
          </label>
          <textarea
            id="camp-body"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            placeholder="<p>Hi,</p><p>We have new retail in stock…</p>"
            required
          />
        </div>
        {sendError && <p className="text-sm text-red-400">{sendError}</p>}
        {sendOk && <p className="text-sm text-emerald-400">{sendOk}</p>}
        <button
          type="submit"
          disabled={pendingSend}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pendingSend ? "Sending…" : "Send campaign"}
        </button>
      </form>
    </section>
  );
}
