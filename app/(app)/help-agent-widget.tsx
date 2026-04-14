"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import { getPageHelpContext } from "@/lib/help/page-context";

function textFromMessage(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function HelpAgentWidget() {
  const pathname = usePathname() ?? "/";
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/help-agent",
        credentials: "same-origin",
        body: () => ({ pathname: pathnameRef.current }),
      }),
    []
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({ transport });

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const page = getPageHelpContext(pathname);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, busy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    clearError?.();
    await sendMessage({ text });
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-background shadow-lg ring-2 ring-background/80 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
          aria-label="Open SalonSynk help chat"
        >
          ?
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[100] flex h-[min(80vh,28rem)] w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-white/5 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Help — {page.pageLabel}</p>
              <p className="text-[11px] text-muted leading-snug line-clamp-2">{page.helpPrompt}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {busy && (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/30"
                >
                  Stop
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/30"
                aria-label="Close help chat"
              >
                Close
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <p className="text-xs text-muted">
                Ask how to do something on this page, or what a button does. Answers use SalonSynk features only.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg px-2.5 py-2 ${
                  m.role === "user"
                    ? "ml-6 bg-accent/15 text-foreground"
                    : "mr-4 bg-white/5 text-foreground"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                  {m.role === "user" ? "You" : "SalonSynk Help"}
                </p>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{textFromMessage(m)}</p>
              </div>
            ))}
            {error && (
              <p className="text-xs text-red-400 rounded-lg border border-red-500/30 bg-red-500/10 p-2">
                {error.message}
              </p>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-border p-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              aria-label="Message to help assistant"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
