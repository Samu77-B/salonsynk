"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateNailSalonBranding } from "@modules/nail/actions/team";

export function NailSalonBrandingForm({
  salonName,
  initialCompanyName,
  initialShowTitle,
}: {
  salonName: string;
  initialCompanyName: string;
  initialShowTitle: boolean;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [showTitle, setShowTitle] = useState(initialShowTitle);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const result = await updateNailSalonBranding({
      company_name: companyName.trim() || salonName,
      show_title_on_queue: showTitle,
    });
    setLoading(false);
    if (result.error) {
      setErrorText(result.error);
      setMessage("error");
      return;
    }
    setMessage("saved");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <div>
        <p className="text-sm font-medium">Queue page display</p>
        <p className="text-xs text-muted mt-1">
          Control how your salon name appears on the public walk-in queue page.
        </p>
      </div>
      <div>
        <label htmlFor="queueDisplayName" className="block text-xs text-muted mb-1">
          Display name
        </label>
        <input
          id="queueDisplayName"
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={salonName}
          className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showTitle}
          onChange={(e) => setShowTitle(e.target.checked)}
        />
        Show salon title on public queue page
      </label>
      <p className="text-xs text-muted -mt-1">
        Turn off if your logo already includes the salon name.
      </p>
      {message === "saved" && <p className="text-sm text-green-400">Saved.</p>}
      {message === "error" && <p className="text-sm text-red-400">{errorText}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save display settings"}
      </button>
    </form>
  );
}
