"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PinEntryView({ displayName }: { displayName: string }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  async function handleSubmit() {
    const pin = digits.join("");
    if (pin.length !== 4) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const body = await res.json();
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(body.error || "Incorrect PIN");
        setDigits(["", "", "", ""]);
        inputsRef.current[0]?.focus();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(index: number, value: string) {
    const val = value.replace(/\D/g, "").slice(0, 1);
    const next = [...digits];
    next[index] = val;
    setDigits(next);
    if (val && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }
    if (val && index === 3 && next.every((d) => d !== "")) {
      setTimeout(() => {
        const pin = next.join("");
        if (pin.length === 4) handleSubmit();
      }, 100);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleSubmit();
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-1">Enter your PIN</h1>
          <p className="text-sm text-muted">{displayName}</p>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
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

        {error && (
          <p className="text-sm text-red-400 mb-4 animate-pulse">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || digits.some((d) => !d)}
          className="w-full rounded-xl bg-accent text-white py-3 text-sm font-medium disabled:opacity-50 transition-opacity"
        >
          {loading ? "Verifying…" : "Unlock"}
        </button>
      </div>
    </div>
  );
}
