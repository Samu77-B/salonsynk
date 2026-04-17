"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MemberRow = { id: string; display_name: string | null; has_passcode: boolean };

export function StaffElevationModal({
  open,
  onClose,
  onSuccess,
  title = "Staff login",
  subtitle = "Select your name and enter your 4-digit PIN to continue.",
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberId, setMemberId] = useState("");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(false);
    setDigits(["", "", "", ""]);
    setMemberId("");
    (async () => {
      try {
        const res = await fetch("/api/auth/staff-members", { method: "GET" });
        const data = await res.json();
        if (res.ok) setMembers((data.members ?? []) as MemberRow[]);
        else setError(data.error ?? "Could not load staff list");
      } catch {
        setError("Could not load staff list");
      }
    })();
    setTimeout(() => inputsRef.current[0]?.focus(), 50);
  }, [open]);

  const pin = useMemo(() => digits.join(""), [digits]);

  async function handleSubmit() {
    if (!memberId) {
      setError("Choose your name");
      return;
    }
    if (pin.length !== 4) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/elevate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, pin }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Incorrect PIN");
        setDigits(["", "", "", ""]);
        inputsRef.current[0]?.focus();
      } else {
        onSuccess();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(index: number, value: string) {
    const val = value.replace(/\\D/g, "").slice(0, 1);
    const next = [...digits];
    next[index] = val;
    setDigits(next);
    if (val && index < 3) inputsRef.current[index + 1]?.focus();
    if (val && index === 3 && next.every((d) => d !== "")) {
      setTimeout(() => void handleSubmit(), 50);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus();
    if (e.key === "Enter") void handleSubmit();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted mt-1">{subtitle}</p>
        </div>

        <label className="block text-sm font-medium mb-1">Name</label>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-4"
        >
          <option value="">Select…</option>
          {members
            .filter((m) => m.has_passcode)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || "Unnamed"}
              </option>
            ))}
        </select>

        <label className="block text-sm font-medium mb-2">PIN</label>
        <div className="flex justify-center gap-3 mb-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-14 h-16 text-center text-3xl rounded-xl border-2 border-border bg-background focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              aria-label={`PIN digit ${i + 1}`}
            />
          ))}
        </div>

        {error ? <p className="text-sm text-red-400 mb-3" role="alert">{error}</p> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border px-4 py-2 text-sm"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-xl bg-accent text-white px-4 py-2 text-sm disabled:opacity-50"
            disabled={loading || pin.length !== 4 || !memberId}
          >
            {loading ? "Verifying…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

