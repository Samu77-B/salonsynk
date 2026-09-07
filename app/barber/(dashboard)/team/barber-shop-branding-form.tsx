"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBarberShopBranding } from "@modules/barber/actions/team";

export function BarberShopBrandingForm({
  shopName,
  initialCompanyName,
  initialShowTitle,
  initialQueueBackgroundColor,
}: {
  shopName: string;
  initialCompanyName: string;
  initialShowTitle: boolean;
  initialQueueBackgroundColor: string;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [showTitle, setShowTitle] = useState(initialShowTitle);
  const [queueBackgroundColor, setQueueBackgroundColor] = useState(initialQueueBackgroundColor);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const result = await updateBarberShopBranding({
      company_name: companyName.trim() || shopName,
      show_title_on_queue: showTitle,
      queue_background_color: queueBackgroundColor.trim(),
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
      className="space-y-3 rounded border border-border p-4"
    >
      <div>
        <p className="text-sm font-medium">Queue page display</p>
        <p className="text-xs text-muted mt-1">
          Control how your shop name appears on the public walk-in queue page.
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
          placeholder={shopName}
          className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showTitle}
          onChange={(e) => setShowTitle(e.target.checked)}
        />
        Show shop title on public queue page
      </label>
      <p className="text-xs text-muted -mt-1">
        Turn off if your logo already includes the shop name.
      </p>
      <div>
        <label htmlFor="queueBackgroundColor" className="block text-xs text-muted mb-1">
          Queue page background colour
        </label>
        <div className="flex items-center gap-3">
          <input
            id="queueBackgroundColor"
            type="color"
            value={queueBackgroundColor || "#374151"}
            onChange={(e) => setQueueBackgroundColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-border bg-canvas"
          />
          <input
            type="text"
            value={queueBackgroundColor}
            onChange={(e) => setQueueBackgroundColor(e.target.value)}
            placeholder="#374151"
            className="flex-1 rounded border border-border bg-canvas px-3 py-2 text-sm font-mono"
          />
        </div>
        <p className="text-xs text-muted mt-1">
          Background behind the join queue page. Leave blank for the default.
        </p>
      </div>
      {message === "saved" && <p className="text-sm text-green-400">Saved.</p>}
      {message === "error" && <p className="text-sm text-red-400">{errorText}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save display settings"}
      </button>
    </form>
  );
}
