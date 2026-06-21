"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function textFromMessage(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type AiChatUiProps = {
  apiUrl: string;
  credentials?: RequestCredentials;
  title: string;
  subtitle: string;
  assistantLabel?: string;
  placeholder?: string;
  emptyPrompts?: string[];
  onFinish?: () => void;
  className?: string;
  enableVoice?: boolean;
};

export function AiChatUi({
  apiUrl,
  credentials = "same-origin",
  title,
  subtitle,
  assistantLabel = "Assistant",
  placeholder = "Type your message…",
  emptyPrompts = [],
  onFinish,
  className = "",
  enableVoice = true,
}: AiChatUiProps) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiUrl,
        credentials,
      }),
    [apiUrl, credentials]
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    transport,
    onFinish,
  });

  const [input, setInput] = useState("");
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "simulated">("idle");
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const submitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      setVoiceHint(null);
      clearError?.();
      await sendMessage({ text: trimmed });
    },
    [busy, clearError, sendMessage]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitText(input);
  }

  function runSimulatedVoice() {
    setVoiceState("simulated");
    setVoiceHint("Listening… (simulated voice input)");
    window.setTimeout(() => {
      const phrase = emptyPrompts[0] ?? "Hello";
      setInput(phrase);
      setVoiceState("idle");
      setVoiceHint("Voice captured — review and send, or edit the message.");
    }, 1600);
  }

  function toggleVoiceInput() {
    if (!enableVoice) return;
    if (busy || voiceState === "listening" || voiceState === "simulated") {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setVoiceState("idle");
      setVoiceHint(null);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      runSimulatedVoice();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setInput(transcript);
        setVoiceHint("Voice captured — review and send, or edit the message.");
      } else {
        setVoiceHint("I didn't catch that. Please try again or type your message.");
      }
      setVoiceState("idle");
    };

    recognition.onerror = () => {
      setVoiceState("idle");
      setVoiceHint("Voice input failed. Try again or type your message.");
    };

    recognition.onend = () => {
      setVoiceState((prev) => (prev === "listening" ? "idle" : prev));
    };

    try {
      setVoiceState("listening");
      setVoiceHint("Listening… speak your message.");
      recognition.start();
    } catch {
      setVoiceState("idle");
      runSimulatedVoice();
    }
  }

  return (
    <div
      className={`flex min-h-[min(72vh,640px)] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white/5 ${className}`}
    >
      <header className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {messages.length === 0 && emptyPrompts.length > 0 && (
          <div className="rounded-lg border border-dashed border-border bg-background/40 p-4 text-sm text-muted">
            <p className="font-medium text-foreground">Try saying or typing:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {emptyPrompts.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m) => {
          const text = textFromMessage(m);
          if (!text.trim()) return null;
          return (
            <div
              key={m.id}
              className={`max-w-[92%] rounded-xl px-3 py-2.5 sm:max-w-[85%] ${
                m.role === "user"
                  ? "ml-auto bg-accent/15 text-foreground"
                  : "mr-auto border border-border bg-background/80 text-foreground"
              }`}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {m.role === "user" ? "You" : assistantLabel}
              </p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{text}</p>
            </div>
          );
        })}

        {busy && (
          <p className="text-xs text-muted" aria-live="polite">
            Assistant is thinking…
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error.message}
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border p-3 sm:p-4">
        {voiceHint && (
          <p className="mb-2 text-xs text-muted" aria-live="polite">
            {voiceHint}
          </p>
        )}
        <div className="flex items-end gap-2">
          {enableVoice && (
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={busy}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-white/5 disabled:opacity-50 ${
                voiceState === "listening" || voiceState === "simulated"
                  ? "border-accent bg-accent/15 text-accent"
                  : "text-muted"
              }`}
              aria-label={
                voiceState === "listening" || voiceState === "simulated"
                  ? "Stop voice input"
                  : "Start voice input"
              }
              title="Voice input"
            >
              <svg
                className={`h-5 w-5 ${voiceState === "listening" || voiceState === "simulated" ? "animate-pulse" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
                />
              </svg>
            </button>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitText(input);
              }
            }}
            placeholder={placeholder}
            disabled={busy}
            rows={2}
            className="min-h-[44px] min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Message"
          />

          <div className="flex shrink-0 flex-col gap-2">
            {busy && (
              <button
                type="button"
                onClick={() => stop()}
                className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-white/5"
              >
                Stop
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
