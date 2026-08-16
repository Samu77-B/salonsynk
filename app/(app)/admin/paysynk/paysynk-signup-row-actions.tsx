"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminPatchPaysynkSignup } from "./actions";
import type { PaysynkSignup, PaysynkSignupStatus } from "@core/paysynk/types";

type PaysynkSignupRowActionsProps = {
  signup: PaysynkSignup;
};

export function PaysynkSignupRowActions({ signup }: PaysynkSignupRowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<PaysynkSignupStatus | "notes" | "name" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(signup.adminNotes ?? "");
  const [name, setName] = useState(signup.name);

  async function setStatus(status: PaysynkSignupStatus) {
    setError(null);
    setBusy(status);
    const result = await adminPatchPaysynkSignup(signup.id, {
      status,
      adminNotes: notes.trim() || undefined,
    });
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function saveName() {
    setError(null);
    setBusy("name");
    const result = await adminPatchPaysynkSignup(signup.id, {
      name: name.trim(),
    });
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function saveNotes() {
    setError(null);
    setBusy("notes");
    const result = await adminPatchPaysynkSignup(signup.id, {
      adminNotes: notes.trim(),
    });
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const pending = signup.signupStatus === "pending";
  const approved = signup.signupStatus === "approved";
  const rejected = signup.signupStatus === "rejected";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {pending && (
          <>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setStatus("approved")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy === "approved" ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setStatus("rejected")}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
            >
              {busy === "rejected" ? "Rejecting…" : "Reject"}
            </button>
          </>
        )}
        {approved && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => setStatus("rejected")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
          >
            {busy === "rejected" ? "Rejecting…" : "Reject"}
          </button>
        )}
        {rejected && (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => setStatus("pending")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {busy === "pending" ? "Saving…" : "Set pending"}
          </button>
        )}
      </div>
      <div className="flex w-full min-w-[12rem] max-w-xs items-center gap-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Store name"
          aria-label="Store name"
          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={Boolean(busy) || name.trim() === signup.name.trim() || !name.trim()}
          onClick={saveName}
          className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-40"
        >
          {busy === "name" ? "…" : "Rename"}
        </button>
      </div>
      <div className="flex w-full min-w-[12rem] max-w-xs items-center gap-1">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Admin notes"
          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={Boolean(busy) || notes.trim() === (signup.adminNotes ?? "").trim()}
          onClick={saveNotes}
          className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-40"
        >
          {busy === "notes" ? "…" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
