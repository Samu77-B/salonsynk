"use client";

import { useState } from "react";
import { completeStaffOnboarding, updateTeamMember } from "./actions";

export function StaffOnboardingWizard({
  salonId,
  member,
  onComplete,
}: {
  salonId: string;
  member: { id: string; display_name: string | null; role: string };
  onComplete?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(member.display_name ?? "");
  const [showOnDiary, setShowOnDiary] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function finish() {
    setError(null);
    setLoading(true);
    const updateRes = await updateTeamMember(member.id, {
      display_name: displayName.trim() || member.display_name || member.role,
      show_on_diary: showOnDiary,
    });
    if (updateRes.error) {
      setLoading(false);
      setError(updateRes.error);
      return;
    }
    const doneRes = await completeStaffOnboarding(salonId, member.id);
    setLoading(false);
    if (doneRes.error) setError(doneRes.error);
    else onComplete?.();
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Welcome — staff onboarding</h2>
        <p className="text-sm text-muted mt-1">
          Set up <span className="font-medium text-foreground">{member.display_name || member.role}</span> before they
          appear on the diary and reports.
        </p>
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Step 1 — Profile</p>
          <label className="block text-sm">
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-muted">Role: {member.role}</p>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Step 2 — Diary &amp; visibility</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showOnDiary}
              onChange={(e) => setShowOnDiary(e.target.checked)}
              className="rounded border-border"
            />
            Show on diary (bookable stylist column)
          </label>
          <p className="text-xs text-muted">
            Turn off for reception-only or admin accounts that should not receive appointments.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-border px-4 py-2 text-sm">
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Step 3 — Ready to go</p>
          <ul className="text-sm text-muted list-disc pl-5 space-y-1">
            <li>Owner can set a staff PIN under Team → edit member for sensitive diary changes.</li>
            <li>Service timing overrides can be configured per stylist in Team settings.</li>
            <li>Invite email (if provided) lets them log in to SalonSynk.</li>
          </ul>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-border px-4 py-2 text-sm">
              Back
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void finish()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {loading ? "Saving…" : "Complete onboarding"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
