"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import { countMarketingRecipientsAction, sendMarketingCampaignAction } from "./actions";
import { CampaignRichEditor } from "./campaign-rich-editor";
import {
  CAMPAIGN_AUDIENCE_LABELS,
  CAMPAIGN_AUDIENCE_SEGMENTS,
  audienceSummaryLine,
  type CampaignAudienceSegment,
} from "@/lib/campaign-audience";

function isHtmlBodyEmpty(html: string): boolean {
  const stripped = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u200b/g, "")
    .trim();
  return stripped.length === 0;
}

type EditorMode = "design" | "html" | "preview";
type WizardStep = 1 | 2 | 3;

const STEPS: { step: WizardStep; label: string; hint: string }[] = [
  { step: 1, label: "Audience", hint: "Who receives this send" },
  { step: 2, label: "Email", hint: "Subject & content" },
  { step: 3, label: "Review", hint: "Check and send" },
];

export function CampaignComposer({
  salonId,
  salonName,
  services,
}: {
  salonId: string;
  salonName: string;
  services: { id: string; name: string }[];
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [audienceSegment, setAudienceSegment] = useState<CampaignAudienceSegment>("all");
  const [audienceServiceId, setAudienceServiceId] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [mode, setMode] = useState<EditorMode>("design");
  const [designMountKey, setDesignMountKey] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<string | null>(null);
  const [pendingCount, startCount] = useTransition();
  const [pendingSend, startSend] = useTransition();

  const selectedServiceName = useMemo(
    () => services.find((s) => s.id === audienceServiceId)?.name ?? null,
    [services, audienceServiceId]
  );

  const audienceReady =
    audienceSegment !== "service_booked" || Boolean(audienceServiceId.trim());

  const loadRecipientCount = useCallback(() => {
    setCountError(null);
    if (audienceSegment === "service_booked" && !audienceServiceId.trim()) {
      setCount(null);
      return;
    }
    startCount(async () => {
      const r = await countMarketingRecipientsAction({
        segment: audienceSegment,
        serviceId: audienceSegment === "service_booked" ? audienceServiceId.trim() || null : null,
      });
      if (r.error) setCountError(r.error);
      setCount(r.count);
    });
  }, [audienceSegment, audienceServiceId]);

  useEffect(() => {
    loadRecipientCount();
  }, [loadRecipientCount]);

  function goDesign(fromHtml: boolean) {
    if (fromHtml) setDesignMountKey((k) => k + 1);
    setMode("design");
  }

  function canGoToReview(): boolean {
    return subject.trim().length > 0 && !isHtmlBodyEmpty(bodyHtml);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendError(null);
    setSendOk(null);
    if (!canGoToReview()) {
      setSendError("Add a subject and message body before sending.");
      return;
    }
    if (!audienceReady) {
      setSendError("Choose a service for the “Booked a specific service” audience.");
      return;
    }
    const fd = new FormData();
    fd.set("subject", subject.trim());
    fd.set("preheader", preheader.trim());
    fd.set("bodyHtml", bodyHtml);
    fd.set("audienceSegment", audienceSegment);
    fd.set(
      "audienceServiceId",
      audienceSegment === "service_booked" ? audienceServiceId.trim() : ""
    );
    startSend(async () => {
      const r = await sendMarketingCampaignAction(fd);
      if (r.error) setSendError(r.error);
      else if (r.sent != null) {
        setSendOk(`Sent to ${r.sent} recipient(s).`);
        setStep(1);
        setSubject("");
        setPreheader("");
        setBodyHtml("");
        setMode("design");
        setDesignMountKey((k) => k + 1);
        setAudienceSegment("all");
        setAudienceServiceId("");
        loadRecipientCount();
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-white/[0.03] shadow-sm overflow-hidden">
      {/* Step header — Brevo/Mailchimp-style progress */}
      <div className="border-b border-border bg-white/[0.04] px-4 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-foreground">New campaign</h2>
        <p className="text-xs text-muted mt-1">Step {step} of 3 — {STEPS.find((s) => s.step === step)?.hint}</p>
        <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
          {STEPS.map(({ step: n, label }, i) => {
            const active = step === n;
            const done = step > n;
            return (
              <li key={n} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-0">
                <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                      active
                        ? "bg-accent text-background ring-2 ring-accent/40"
                        : done
                          ? "bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/40"
                          : "bg-muted/30 text-muted ring-1 ring-border"
                    }`}
                  >
                    {done ? "✓" : n}
                  </span>
                  <span className={`min-w-0 text-sm font-medium ${active ? "text-foreground" : "text-muted"}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`hidden h-px flex-1 mx-2 sm:block min-w-[12px] ${step > n ? "bg-emerald-500/40" : "bg-border"}`}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {step === 1 && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-background/50 p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Marketing audience</h3>
                <p className="text-sm text-muted mt-2 leading-relaxed">
                  Only clients with an <strong className="text-foreground">email address</strong> and{" "}
                  <strong className="text-foreground">marketing opt-in</strong> are eligible. Pick a segment, then check
                  the count. Each send includes an unsubscribe link.
                </p>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Segment</legend>
                <div className="space-y-2">
                  {CAMPAIGN_AUDIENCE_SEGMENTS.map((seg) => {
                    const meta = CAMPAIGN_AUDIENCE_LABELS[seg];
                    return (
                      <label
                        key={seg}
                        className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                          audienceSegment === seg
                            ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                            : "border-border bg-white/[0.02] hover:bg-white/5"
                        }`}
                      >
                        <input
                          type="radio"
                          name="audience-segment"
                          checked={audienceSegment === seg}
                          onChange={() => {
                            setAudienceSegment(seg);
                            if (seg !== "service_booked") setAudienceServiceId("");
                          }}
                          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">{meta.title}</span>
                          <span className="block text-xs text-muted mt-0.5 leading-snug">{meta.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {audienceSegment === "service_booked" && (
                <div>
                  <label htmlFor="audience-service" className="mb-1 block text-sm font-medium">
                    Service <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="audience-service"
                    value={audienceServiceId}
                    onChange={(e) => setAudienceServiceId(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a service…</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {services.length === 0 && (
                    <p className="text-xs text-amber-400 mt-2">
                      Add services under Settings first, or choose another segment.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="rounded-lg border border-border bg-white/5 px-4 py-3 min-w-[140px]">
                  <p className="text-[11px] uppercase tracking-wide text-muted font-medium">Recipients</p>
                  {!audienceReady ? (
                    <p className="text-sm text-muted mt-0.5">Select a service to see the count.</p>
                  ) : pendingCount ? (
                    <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">…</p>
                  ) : countError ? (
                    <p className="text-sm text-red-400 mt-0.5">{countError}</p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{count ?? "—"}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadRecipientCount}
                  disabled={pendingCount || !audienceReady}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  Refresh count
                </button>
              </div>
              <Link
                href="/clients"
                className="inline-flex text-sm font-medium text-accent hover:underline"
              >
                Manage clients & opt-in →
              </Link>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
              >
                Continue to email
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">Write your email</h3>
              <p className="text-sm text-muted max-w-2xl">
                Set how the message appears in the inbox, then compose the body. Use Design for formatting and layout
                blocks, or HTML if you prefer to paste markup.
              </p>
            </div>

            <div className="flex flex-col gap-8">
              <section className="space-y-5 rounded-2xl border border-border bg-gradient-to-b from-white/[0.06] to-transparent p-5 sm:p-6 shadow-sm w-full min-w-0">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Inbox appearance</h4>
                  <p className="text-xs text-muted mt-1.5 leading-relaxed">
                    The sender name uses your salon. For a custom sending domain, configure DNS in your Resend project.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="camp-from"
                      className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted"
                    >
                      Sending as
                    </label>
                    <p
                      id="camp-from"
                      className="rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-sm font-medium text-foreground"
                    >
                      {salonName}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="camp-subject" className="mb-1.5 block text-sm font-medium text-foreground">
                      Subject line <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="camp-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                      placeholder="February colour event — book your patch test"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label htmlFor="camp-preheader" className="mb-1.5 block text-sm font-medium text-foreground">
                      Preview text <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <input
                      id="camp-preheader"
                      value={preheader}
                      onChange={(e) => setPreheader(e.target.value.slice(0, 140))}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                      placeholder="Shown after the subject in many inboxes"
                      maxLength={140}
                      autoComplete="off"
                    />
                    <div className="mt-1.5 flex justify-end">
                      <span className="text-[11px] tabular-nums text-muted">{preheader.length} / 140</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="min-w-0 w-full space-y-4">
                <div className="rounded-2xl border border-border bg-background/30 shadow-sm overflow-hidden">
                  <div className="flex flex-col gap-4 border-b border-border bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Message body</p>
                      <p className="text-xs text-muted mt-0.5 hidden sm:block">
                        Rich editor, raw HTML, or a quick layout check before review.
                      </p>
                    </div>
                    <div className="inline-flex w-full min-w-0 rounded-xl border border-border bg-muted/20 p-1 sm:w-auto">
                      <button
                        type="button"
                        onClick={() => goDesign(mode === "html")}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-none sm:min-w-[5.5rem] ${
                          mode === "design"
                            ? "bg-accent text-background shadow-sm"
                            : "text-muted hover:text-foreground hover:bg-white/5"
                        }`}
                      >
                        Design
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("html")}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-none sm:min-w-[5.5rem] ${
                          mode === "html"
                            ? "bg-accent text-background shadow-sm"
                            : "text-muted hover:text-foreground hover:bg-white/5"
                        }`}
                      >
                        HTML
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("preview")}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:flex-none sm:min-w-[5.5rem] ${
                          mode === "preview"
                            ? "bg-accent text-background shadow-sm"
                            : "text-muted hover:text-foreground hover:bg-white/5"
                        }`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    {mode === "design" && (
                      <CampaignRichEditor
                        key={designMountKey}
                        salonId={salonId}
                        initialHtml={bodyHtml}
                        onHtmlChange={setBodyHtml}
                      />
                    )}
                    {mode === "html" && (
                      <div className="space-y-2">
                        <label htmlFor="camp-body" className="text-xs font-medium text-muted">
                          Raw HTML (advanced)
                        </label>
                        <textarea
                          id="camp-body"
                          value={bodyHtml}
                          onChange={(e) => setBodyHtml(e.target.value)}
                          rows={16}
                          className="w-full min-h-[280px] rounded-xl border border-border bg-background px-3.5 py-3 font-mono text-sm leading-relaxed text-zinc-900 shadow-inner dark:text-zinc-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                          placeholder="<p>Hi,</p><p>We have new retail in stock…</p>"
                        />
                      </div>
                    )}
                    {mode === "preview" && (
                      <div className="rounded-xl border border-dashed border-border/80 bg-zinc-100/80 p-4 dark:bg-zinc-950/40">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted mb-3">
                          Approximate email body
                        </p>
                        <div
                          className="mx-auto max-w-[600px] rounded-xl border border-zinc-200 bg-white p-6 shadow-md text-zinc-900 text-[15px] leading-relaxed dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 [&_a]:text-green-700 [&_a]:underline"
                          dangerouslySetInnerHTML={{
                            __html:
                              bodyHtml.trim() ||
                              '<p class="text-zinc-400 italic">Nothing to preview yet — switch to Design or HTML.</p>',
                          }}
                        />
                        <p className="text-[11px] text-muted mt-4 max-w-[600px] mx-auto text-center">
                          The unsubscribe footer is added automatically when you send.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                ← Audience
              </button>
              <button
                type="button"
                disabled={!canGoToReview()}
                onClick={() => canGoToReview() && setStep(3)}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
              >
                Review & send →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleSend} className="space-y-6">
            <div className="rounded-lg border border-border bg-background/40 p-4 sm:p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Send checklist</h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-[140px_1fr]">
                <dt className="text-muted">Segment</dt>
                <dd className="font-medium text-foreground break-words">
                  {audienceSummaryLine(audienceSegment, selectedServiceName)}
                </dd>
                <dt className="text-muted">Recipients</dt>
                <dd className="font-medium text-foreground">
                  {count !== null && !countError && audienceReady ? (
                    <>
                      {count} recipient{count === 1 ? "" : "s"}{" "}
                      <span className="text-muted font-normal">(opt-in + email)</span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </dd>
                <dt className="text-muted">Sending as</dt>
                <dd className="font-medium text-foreground">{salonName}</dd>
                <dt className="text-muted">Subject</dt>
                <dd className="font-medium text-foreground break-words">{subject.trim() || "—"}</dd>
                <dt className="text-muted">Preview text</dt>
                <dd className="text-foreground break-words">{preheader.trim() || <span className="text-muted italic">None</span>}</dd>
              </dl>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Final preview</h4>
              <div className="rounded-lg border border-border bg-zinc-100 dark:bg-zinc-900/40 p-4">
                <div className="mx-auto max-w-[600px] rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 border-b-0 rounded-b-none">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Inbox</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{subject || "(no subject)"}</p>
                  {preheader.trim() && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{preheader.trim()}</p>
                  )}
                </div>
                <div
                  className="mx-auto max-w-[600px] rounded-md rounded-t-none border border-t-0 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-5 text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 [&_a]:text-green-700 [&_a]:underline"
                  dangerouslySetInnerHTML={{
                    __html:
                      bodyHtml.trim() ||
                      '<p class="text-zinc-400 italic">No body content.</p>',
                  }}
                />
                <p className="text-[11px] text-muted mt-2 max-w-[600px] mx-auto">
                  + standard unsubscribe footer on send.
                </p>
              </div>
            </div>

            {sendError && <p className="text-sm text-red-400">{sendError}</p>}
            {sendOk && <p className="text-sm text-emerald-400">{sendOk}</p>}

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                ← Edit email
              </button>
              <button
                type="submit"
                disabled={pendingSend || !canGoToReview() || !audienceReady}
                className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {pendingSend ? "Sending…" : "Send campaign"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
