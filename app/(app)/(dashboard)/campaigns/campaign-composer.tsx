"use client";

import { useState, useTransition } from "react";
import { countMarketingRecipientsAction, sendMarketingCampaignAction } from "./actions";
import { CampaignRichEditor } from "./campaign-rich-editor";

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

export function CampaignComposer({ salonId }: { salonId: string }) {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [mode, setMode] = useState<EditorMode>("design");
  const [designMountKey, setDesignMountKey] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendOk, setSendOk] = useState<string | null>(null);
  const [pendingCount, startCount] = useTransition();
  const [pendingSend, startSend] = useTransition();

  function goDesign(fromHtml: boolean) {
    if (fromHtml) setDesignMountKey((k) => k + 1);
    setMode("design");
  }

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
    if (isHtmlBodyEmpty(bodyHtml)) {
      setSendError("Add some content to your campaign body.");
      return;
    }
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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="text-sm font-medium">Message body</label>
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => goDesign(mode === "html")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  mode === "design" ? "bg-accent text-background" : "bg-background hover:bg-white/10"
                }`}
              >
                Design
              </button>
              <button
                type="button"
                onClick={() => setMode("html")}
                className={`px-3 py-1.5 font-medium border-l border-border transition-colors ${
                  mode === "html" ? "bg-accent text-background" : "bg-background hover:bg-white/10"
                }`}
              >
                HTML
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`px-3 py-1.5 font-medium border-l border-border transition-colors ${
                  mode === "preview" ? "bg-accent text-background" : "bg-background hover:bg-white/10"
                }`}
              >
                Preview
              </button>
            </div>
          </div>

          <p className="text-xs text-muted mb-2">
            <strong>Design</strong> — visual editor, image upload, and layout blocks. <strong>HTML</strong> — raw markup.
            <strong> Preview</strong> — approximates how content sits in an email (footer is added when sent).
          </p>

          {mode === "design" && (
            <CampaignRichEditor
              key={designMountKey}
              salonId={salonId}
              initialHtml={bodyHtml}
              onHtmlChange={setBodyHtml}
            />
          )}

          {mode === "html" && (
            <textarea
              id="camp-body"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={14}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-zinc-900"
              placeholder="<p>Hi,</p><p>We have new retail in stock…</p>"
            />
          )}

          {mode === "preview" && (
            <div className="rounded-lg border border-border bg-zinc-100 p-4">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Approximate email body</p>
              <div
                className="mx-auto max-w-[600px] rounded-lg border border-zinc-200 bg-white p-6 shadow-sm text-zinc-900 text-[15px] leading-relaxed [&_a]:text-green-700 [&_a]:underline"
                dangerouslySetInnerHTML={{
                  __html:
                    bodyHtml.trim() ||
                    '<p class="text-zinc-400 italic">Nothing to preview yet — switch to Design or HTML.</p>',
                }}
              />
              <p className="text-[11px] text-zinc-500 mt-3 max-w-[600px] mx-auto">
                Unsubscribe footer is appended automatically when the campaign is sent.
              </p>
            </div>
          )}
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
